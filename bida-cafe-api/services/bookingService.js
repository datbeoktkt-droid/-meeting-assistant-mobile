/**
 * [BOOKING SERVICE]
 */
const { resolveDateFilter } = require('../utils/common');
const { startTableSession } = require('./sessionService');

const bookingService = {
  async getBookings(pool, { date, status }) {
    const resolvedDate = resolveDateFilter(date);
    const values = [resolvedDate];
    let query = `
      SELECT b.*, bt.table_number 
      FROM public.table_bookings b
      JOIN public.billiard_tables bt ON bt.table_id = b.table_id
      WHERE b.booking_start::date = $1::date
    `;

    if (status) {
      values.push(status);
      query += ` AND b.status = $${values.length}`;
    }

    query += ' ORDER BY b.booking_start ASC';
    const result = await pool.query(query, values);
    return result.rows;
  },

  async getBookingById(pool, id) {
    const result = await pool.query(
      'SELECT * FROM public.table_bookings WHERE booking_id = $1',
      [id]
    );
    return result.rows[0];
  },

  async updateBooking(pool, id, { status, tableId, bookingStart, bookingEnd, customerName, customerPhone }) {
    const result = await pool.query(
      `UPDATE public.table_bookings
       SET status = COALESCE($1, status),
           table_id = COALESCE($2, table_id),
           booking_start = COALESCE($3, booking_start),
           booking_end = COALESCE($4, booking_end),
           customer_name = COALESCE($5, customer_name),
           customer_phone = COALESCE($6, customer_phone)
       WHERE booking_id = $7
       RETURNING *`,
      [status, tableId, bookingStart, bookingEnd, customerName, customerPhone, id]
    );
    return result.rows[0];
  },

  async checkIn(client, bookingId) {
    // 1. Cap nhat booking thanh CHECKED_IN
    const bookingRes = await client.query(
      "UPDATE public.table_bookings SET status = 'CHECKED_IN' WHERE booking_id = $1 RETURNING *",
      [bookingId]
    );
    if (bookingRes.rowCount === 0) return null;
    const booking = bookingRes.rows[0];

    // 2. Mo session cho ban (Hàm startTableSession se tu dong UPDATE status ban thanh OCCUPIED)
    await startTableSession(client, { 
      tableId: booking.table_id, 
      userId: booking.user_id, 
      allowReserved: true 
    });

    return booking;
  }
};

module.exports = bookingService;
