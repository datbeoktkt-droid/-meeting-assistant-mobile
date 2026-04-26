const { getCurrentPricePerHour } = require('./pricingService');
const { toNumber } = require('../utils/common');

function createBackgroundJobs({ pool, notificationHub }) {
  const walletAlertCache = new Map();

  async function processBookings() {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const reservedResult = await client.query(
        `UPDATE public.table_bookings
         SET status = 'RESERVED'
         WHERE status = 'PENDING'
           AND booking_start <= NOW()
           AND NOW() <= booking_start + INTERVAL '15 minutes'
         RETURNING booking_id, table_id, user_id, customer_name, customer_phone, booking_start, booking_end`
      );

      for (const booking of reservedResult.rows) {
        await client.query(
          `UPDATE public.billiard_tables
           SET status = 'RESERVED'
           WHERE table_id = $1 AND status = 'AVAILABLE'`,
          [booking.table_id]
        );
      }

      const expiredResult = await client.query(
        `UPDATE public.table_bookings
         SET status = 'EXPIRED', expired_at = NOW()
         WHERE status IN ('PENDING', 'RESERVED')
           AND NOW() > booking_start + INTERVAL '15 minutes'
         RETURNING booking_id, table_id, user_id, customer_name, customer_phone, booking_start, booking_end`
      );

      for (const booking of expiredResult.rows) {
        await client.query(
          `UPDATE public.billiard_tables
           SET status = 'AVAILABLE'
           WHERE table_id = $1 AND status = 'RESERVED'`,
          [booking.table_id]
        );
      }

      await client.query('COMMIT');

      for (const booking of reservedResult.rows) {
        notificationHub.broadcast('booking:reserved', booking);
      }

      for (const booking of expiredResult.rows) {
        notificationHub.broadcast('booking:expired', booking);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('booking scheduler error:', error.message);
    } finally {
      client.release();
    }
  }

  async function monitorWallets() {
    const client = await pool.connect();

    try {
      const pricePerHour = await getCurrentPricePerHour(client);
      const activeSessions = await client.query(
        `SELECT s.session_id, s.table_id, s.user_id, s.start_time, u.wallet_balance, u.full_name
         FROM public.billiard_sessions s
         JOIN public.users u ON u.user_id = s.user_id
         WHERE s.status = 'ACTIVE'`
      );

      for (const session of activeSessions.rows) {
        const remainingMinutes = Math.floor((toNumber(session.wallet_balance) / pricePerHour) * 60);
        const now = Date.now();
        const lastSentAt = walletAlertCache.get(session.session_id) || 0;

        if (remainingMinutes <= 10) {
          if (now - lastSentAt >= 5 * 60 * 1000) {
            walletAlertCache.set(session.session_id, now);
            notificationHub.broadcast('wallet:low', {
              session_id: session.session_id,
              table_id: session.table_id,
              user_id: session.user_id,
              full_name: session.full_name,
              wallet_balance: toNumber(session.wallet_balance),
              remaining_minutes: remainingMinutes,
            });
          }
        } else {
          walletAlertCache.delete(session.session_id);
        }
      }
    } catch (error) {
      console.error('wallet monitor error:', error.message);
    } finally {
      client.release();
    }
  }

  function start() {
    setInterval(() => {
      processBookings().catch((error) => console.error(error.message));
    }, 60 * 1000);

    setInterval(() => {
      monitorWallets().catch((error) => console.error(error.message));
    }, 60 * 1000);
  }

  return {
    start,
    processBookings,
    monitorWallets,
  };
}

module.exports = { createBackgroundJobs };
