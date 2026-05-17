const express = require('express');

function createPaymentRouter({ pool, notificationHub }) {
  const router = express.Router();

  // Xem trước hóa đơn bàn
  router.get('/table/:tableId/invoice-preview', async (req, res) => {
    const { tableId } = req.params;

    try {
      // Lấy session ACTIVE
      const sessionResult = await pool.query(
        `SELECT session_id, user_id, start_time
         FROM public.billiard_sessions
         WHERE table_id = $1
           AND status = 'ACTIVE'
         LIMIT 1`,
        [tableId]
      );

      if (sessionResult.rowCount === 0) {
        return res.json({
          active: false,
          message: 'Khong co phien choi nao'
        });
      }

      const session = sessionResult.rows[0];

      // Tính thời gian chơi
      const diffMs = new Date() - new Date(session.start_time);
      const totalMinutes = Math.ceil(diffMs / 60000);

      // Giá bida
      const pricePerHour = 100000;

      const billiardTotal = Math.round(
        (totalMinutes / 60) * pricePerHour
      );

      // Tổng tiền cafe
      const orderResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS cafe_total
         FROM public.orders
         WHERE session_id = $1
           AND status = 'PENDING_PAYMENT'`,
        [session.session_id]
      );

      const cafeTotal = Number(orderResult.rows[0].cafe_total);

      // Tổng cộng
      const grandTotal = billiardTotal + cafeTotal;

      res.json({
        active: true,
        session_id: session.session_id,
        total_minutes: totalMinutes,
        billiard_total: billiardTotal,
        cafe_total: cafeTotal,
        grand_total: grandTotal
      });

    } catch (err) {
      res.status(400).json({
        error: err.message
      });
    }
  });

  // Thanh toán bàn
  router.post('/table/end', async (req, res) => {
    const {
      tableId,
      paymentMethod = 'CASH'
    } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lấy session ACTIVE
      const sessionResult = await client.query(
        `SELECT session_id, user_id, start_time
         FROM public.billiard_sessions
         WHERE table_id = $1
           AND status = 'ACTIVE'
         LIMIT 1`,
        [tableId]
      );

      if (sessionResult.rowCount === 0) {
        throw new Error('Khong tim thay phien choi');
      }

      const session = sessionResult.rows[0];

      // Tính thời gian chơi
      const diffMs = new Date() - new Date(session.start_time);
      const totalMinutes = Math.ceil(diffMs / 60000);

      // Giá bida
      const pricePerHour = 100000;

      const billiardTotal = Math.round(
        (totalMinutes / 60) * pricePerHour
      );

      // Tổng cafe
      const orderResult = await client.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS cafe_total
         FROM public.orders
         WHERE session_id = $1
           AND status = 'PENDING_PAYMENT'`,
        [session.session_id]
      );

      const cafeTotal = Number(orderResult.rows[0].cafe_total);

      // Tổng tiền
      const grandTotal = billiardTotal + cafeTotal;

      // Thanh toán ví
      if (paymentMethod === 'WALLET') {
        const walletResult = await client.query(
          `UPDATE public.users
           SET wallet_balance = wallet_balance - $1
           WHERE user_id = $2
             AND wallet_balance >= $1
           RETURNING wallet_balance`,
          [grandTotal, session.user_id]
        );

        if (walletResult.rowCount === 0) {
          throw new Error('Vi khong du tien');
        }
      }

      // Đóng session
      await client.query(
        `UPDATE public.billiard_sessions
         SET end_time = NOW(),
             total_amount = $1,
             status = 'COMPLETED'
         WHERE session_id = $2`,
        [billiardTotal, session.session_id]
      );

      // Update trạng thái bàn
      await client.query(
        `UPDATE public.billiard_tables
         SET status = 'CLEANING'
         WHERE table_id = $1`,
        [tableId]
      );

      // Update order DONE
      await client.query(
        `UPDATE public.orders
         SET status = 'DONE'
         WHERE session_id = $1`,
        [session.session_id]
      );

      await client.query('COMMIT');

      // Realtime
      notificationHub.broadcast('table:cleaning', {
        table_id: Number(tableId),
        status: 'CLEANING'
      });

      res.json({
        success: true,
        session_id: session.session_id,
        total_minutes: totalMinutes,
        billiard_total: billiardTotal,
        cafe_total: cafeTotal,
        grand_total: grandTotal,
        payment_method: paymentMethod
      });

    } catch (err) {
      await client.query('ROLLBACK');

      res.status(400).json({
        error: err.message
      });

    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = { createPaymentRouter };
