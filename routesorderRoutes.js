const express = require('express');

function createOrderRouter({ pool, notificationHub }) {
  const router = express.Router();

  // API tạo order từ admin & attach vào session
  router.post('/order', async (req, res) => {
    const {
      userId = null,
      tableId = null,
      items = []
    } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Kiểm tra dữ liệu
      if (!items.length) {
        throw new Error('Khong co san pham nao');
      }

      // Kiểm tra bàn có session ACTIVE không
      let sessionId = null;

      if (tableId) {
        const sessionResult = await client.query(
          `SELECT session_id
           FROM public.billiard_sessions
           WHERE table_id = $1
             AND status = 'ACTIVE'
           LIMIT 1`,
          [tableId]
        );

        if (sessionResult.rowCount > 0) {
          sessionId = sessionResult.rows[0].session_id;
        }
      }

      // Tính tổng tiền
      let grandTotal = 0;

      for (const item of items) {
        const productResult = await client.query(
          `SELECT product_id, product_name, price
           FROM public.products
           WHERE product_id = $1`,
          [item.productId]
        );

        if (productResult.rowCount === 0) {
          throw new Error('San pham khong ton tai');
        }

        const product = productResult.rows[0];
        const subtotal = Number(product.price) * Number(item.quantity);

        grandTotal += subtotal;

        // Tự động trừ nguyên liệu trong kho
        await client.query(
          `UPDATE public.ingredients i
           SET stock_quantity = i.stock_quantity - (r.quantity_needed * $2)
           FROM public.recipes r
           WHERE r.product_id = $1
             AND r.ingredient_id = i.ingredient_id`,
          [item.productId, item.quantity]
        );
      }

      // Tạo order
      const orderResult = await client.query(
        `INSERT INTO public.orders
         (user_id, session_id, total_amount, order_type, status, kitchen_status)
         VALUES ($1, $2, $3, 'CAFE', 'PENDING_PAYMENT', 'PENDING')
         RETURNING order_id`,
        [userId, sessionId, grandTotal]
      );

      const orderId = orderResult.rows[0].order_id;

      // Tạo order details
      for (const item of items) {
        const productResult = await client.query(
          `SELECT price
           FROM public.products
           WHERE product_id = $1`,
          [item.productId]
        );

        const unitPrice = Number(productResult.rows[0].price);

        await client.query(
          `INSERT INTO public.order_details
           (order_id, product_id, quantity, unit_price, status)
           VALUES ($1, $2, $3, $4, 'PENDING')`,
          [
            orderId,
            item.productId,
            item.quantity,
            unitPrice
          ]
        );
      }

      await client.query('COMMIT');

      // Broadcast realtime
      notificationHub.broadcast('order:new', {
        order_id: orderId,
        session_id: sessionId,
        total_amount: grandTotal
      });

      res.json({
        success: true,
        order_id: orderId,
        session_id: sessionId,
        total_amount: grandTotal
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

module.exports = { createOrderRouter };
