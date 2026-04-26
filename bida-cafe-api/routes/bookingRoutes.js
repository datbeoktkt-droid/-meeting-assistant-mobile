const express = require('express');
const { parseDateTime, toNumber } = require('../utils/common');
const { startTableSession } = require('../services/sessionService');

function createBookingRouter({ pool, notificationHub }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const {
      tableId,
      userId = null,
      customerName = null,
      customerPhone = null,
      bookingStart,
      durationMinutes = 60,
      notes = null,
    } = req.body;

    const client = await pool.connect();

    try {
      if (!tableId) {
        throw new Error('Thieu tableId');
      }

      const startAt = parseDateTime(bookingStart, 'bookingStart');
      const duration = Math.max(15, Number(durationMinutes) || 60);
      const endAt = new Date(startAt.getTime() + duration * 60000);
      const now = new Date();

      await client.query('BEGIN');

      const tableResult = await client.query(
        'SELECT table_id FROM public.billiard_tables WHERE table_id = $1',
        [tableId]
      );

      if (tableResult.rowCount === 0) {
        throw new Error('Khong tim thay ban');
      }

      const overlapResult = await client.query(
        `SELECT booking_id
         FROM public.table_bookings
         WHERE table_id = $1
           AND status IN ('PENDING', 'RESERVED', 'CHECKED_IN')
           AND NOT ($3::timestamp <= booking_start OR $2::timestamp >= booking_end)
         LIMIT 1`,
        [tableId, startAt, endAt]
      );

      if (overlapResult.rowCount > 0) {
        throw new Error('Khung gio nay da co lich dat');
      }

      const initialStatus =
        startAt <= now && now <= new Date(startAt.getTime() + 15 * 60000) ? 'RESERVED' : 'PENDING';

      const bookingResult = await client.query(
        `INSERT INTO public.table_bookings (
           table_id, user_id, customer_name, customer_phone, booking_start, booking_end, status, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [tableId, userId, customerName, customerPhone, startAt, endAt, initialStatus, notes]
      );

      if (initialStatus === 'RESERVED') {
        await client.query(
          `UPDATE public.billiard_tables
           SET status = 'RESERVED'
           WHERE table_id = $1 AND status = 'AVAILABLE'`,
          [tableId]
        );
      }

      await client.query('COMMIT');

      if (initialStatus === 'RESERVED') {
        notificationHub.broadcast('booking:reserved', bookingResult.rows[0]);
      }

      res.json({ success: true, booking: bookingResult.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  router.get('/', async (req, res) => {
    try {
      const { date, status } = req.query;
      const conditions = [];
      const values = [];

      if (date) {
        values.push(date);
        conditions.push(`tb.booking_start::date = $${values.length}::date`);
      }

      if (status) {
        values.push(status);
        conditions.push(`tb.status = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query(
        `SELECT tb.*, bt.table_number, u.full_name AS user_name, u.phone AS user_phone
         FROM public.table_bookings tb
         JOIN public.billiard_tables bt ON bt.table_id = tb.table_id
         LEFT JOIN public.users u ON u.user_id = tb.user_id
         ${whereClause}
         ORDER BY tb.booking_start ASC`,
        values
      );

      res.json(result.rows);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/:bookingId/check-in', async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const bookingResult = await client.query(
        `SELECT *
         FROM public.table_bookings
         WHERE booking_id = $1
         FOR UPDATE`,
        [req.params.bookingId]
      );

      if (bookingResult.rowCount === 0) {
        throw new Error('Khong tim thay booking');
      }

      const booking = bookingResult.rows[0];

      if (!booking.user_id) {
        throw new Error('Booking nay chua gan userId de mo ban');
      }

      if (!['PENDING', 'RESERVED'].includes(booking.status)) {
        throw new Error('Booking khong the check-in');
      }

      await client.query(
        `UPDATE public.table_bookings
         SET status = 'CHECKED_IN', checked_in_at = NOW()
         WHERE booking_id = $1`,
        [booking.booking_id]
      );

      await startTableSession(client, {
        tableId: booking.table_id,
        userId: booking.user_id,
        allowReserved: true,
      });

      await client.query('COMMIT');

      notificationHub.broadcast('booking:checked_in', {
        booking_id: booking.booking_id,
        table_id: booking.table_id,
        user_id: booking.user_id,
      });

      res.json({ success: true, booking_id: booking.booking_id, table_id: booking.table_id });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  router.patch('/:bookingId/cancel', async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const bookingResult = await client.query(
        `UPDATE public.table_bookings
         SET status = 'CANCELLED', cancelled_at = NOW()
         WHERE booking_id = $1
           AND status IN ('PENDING', 'RESERVED')
         RETURNING *`,
        [req.params.bookingId]
      );

      if (bookingResult.rowCount === 0) {
        throw new Error('Booking khong the huy');
      }

      await client.query(
        `UPDATE public.billiard_tables
         SET status = 'AVAILABLE'
         WHERE table_id = $1 AND status = 'RESERVED'`,
        [bookingResult.rows[0].table_id]
      );

      await client.query('COMMIT');

      notificationHub.broadcast('booking:cancelled', bookingResult.rows[0]);
      res.json({ success: true, booking: bookingResult.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  router.get('/summary/daily', async (req, res) => {
    try {
      const date = req.query.date || new Date().toISOString().slice(0, 10);
      const result = await pool.query(
        `SELECT status, COUNT(*) AS total_bookings
         FROM public.table_bookings
         WHERE booking_start::date = $1::date
         GROUP BY status
         ORDER BY status ASC`,
        [date]
      );

      res.json({
        date,
        items: result.rows.map((row) => ({
          status: row.status,
          total_bookings: toNumber(row.total_bookings),
        })),
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createBookingRouter };
