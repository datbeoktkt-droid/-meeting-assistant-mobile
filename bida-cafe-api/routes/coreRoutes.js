const express = require('express');
const { getUserMembership, syncUserRank } = require('../services/membershipService');
const { getCurrentPricePerHour } = require('../services/pricingService');
const { startTableSession } = require('../services/sessionService');
const { calculateDiscountAmount, toNumber } = require('../utils/common');
const { requireAuth, requireRoles } = require('../middlewares/authMiddleware');
const { writeActivityLog } = require('../services/activityLogService');

function createCoreRouter({ pool, notificationHub }) {
  const router = express.Router();

  router.get('/menu', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM public.products ORDER BY product_id ASC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/order', async (req, res) => {
    const { userId, productId, quantity } = req.body;
    const client = await pool.connect();

    try {
      if (!userId || !productId || !quantity || Number(quantity) <= 0) {
        throw new Error('Thieu thong tin don hang hop le');
      }

      await client.query('BEGIN');

      const productResult = await client.query(
        'SELECT price, product_name FROM public.products WHERE product_id = $1',
        [productId]
      );

      if (productResult.rowCount === 0) {
        throw new Error('San pham khong ton tai');
      }

      const member = await getUserMembership(client, userId);
      const unitPrice = toNumber(productResult.rows[0].price);
      const subtotal = Math.round(unitPrice * Number(quantity));
      const discountPct = toNumber(member.discount_cafe_pct);
      const discountAmount = calculateDiscountAmount(subtotal, discountPct);
      const total = subtotal - discountAmount;

      const walletResult = await client.query(
        `UPDATE public.users
         SET wallet_balance = wallet_balance - $1::numeric
         WHERE user_id = $2 AND wallet_balance >= $1::numeric
         RETURNING wallet_balance`,
        [total, userId]
      );

      if (walletResult.rowCount === 0) {
        throw new Error('Vi khong du tien');
      }

      await client.query(
        `UPDATE public.ingredients i
         SET stock_quantity = i.stock_quantity - (r.quantity_needed * $2)
         FROM public.recipes r
         WHERE r.product_id = $1 AND r.ingredient_id = i.ingredient_id`,
        [productId, quantity]
      );

      const orderResult = await client.query(
        `INSERT INTO public.orders (user_id, total_amount, order_type, status)
         VALUES ($1, $2, $3, $4)
         RETURNING order_id`,
        [userId, total, 'CAFE', 'DONE']
      );

      await client.query(
        `INSERT INTO public.order_details (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [orderResult.rows[0].order_id, productId, quantity, unitPrice]
      );

      const lowInventoryResult = await client.query(
        `SELECT i.ingredient_id, i.ingredient_name, i.stock_quantity, i.min_stock_alert
         FROM public.ingredients i
         JOIN public.recipes r ON r.ingredient_id = i.ingredient_id
         WHERE r.product_id = $1
           AND i.stock_quantity < i.min_stock_alert`,
        [productId]
      );

      await client.query('COMMIT');

      notificationHub.broadcast('order:new', {
        order_id: orderResult.rows[0].order_id,
        user_id: userId,
        product_id: productId,
        product_name: productResult.rows[0].product_name,
        quantity: Number(quantity),
        subtotal,
        discount_pct: discountPct,
        discount_amount: discountAmount,
        total,
      });

      if (lowInventoryResult.rowCount > 0) {
        notificationHub.broadcast('inventory:low', {
          product_id: productId,
          items: lowInventoryResult.rows.map((row) => ({
            ingredient_id: row.ingredient_id,
            ingredient_name: row.ingredient_name,
            stock_quantity: toNumber(row.stock_quantity),
            min_stock_alert: toNumber(row.min_stock_alert),
          })),
        });
      }

      res.json({
        success: true,
        rank: member.rank_name,
        discount_pct: discountPct,
        subtotal,
        discount_amount: discountAmount,
        final_total: total,
        balance: walletResult.rows[0].wallet_balance,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  router.post('/deposit', requireAuth, requireRoles('ADMIN'), async (req, res) => {
    const { userId, amount, staffId = null, paymentMethod = 'CASH', referenceCode = null } = req.body;
    const client = await pool.connect();

    try {
      if (!userId || !amount || Number(amount) <= 0) {
        throw new Error('So tien nap khong hop le');
      }

      await client.query('BEGIN');

      const depositResult = await client.query(
        `UPDATE public.users
         SET wallet_balance = wallet_balance + $1::numeric,
             total_deposited = total_deposited + $1::numeric
         WHERE user_id = $2
         RETURNING wallet_balance, total_deposited`,
        [amount, userId]
      );

      if (depositResult.rowCount === 0) {
        throw new Error('Khong tim thay thanh vien');
      }

      await client.query(
        `INSERT INTO public.deposit_transactions (user_id, staff_id, amount, payment_method, reference_code)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, staffId, amount, paymentMethod, referenceCode]
      );

      const updatedRank = await syncUserRank(client, userId);
      await client.query('COMMIT');

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'DEPOSIT',
        description: `Nap ${amount} vao vi user ${userId}`,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        balance: depositResult.rows[0].wallet_balance,
        total_deposited: depositResult.rows[0].total_deposited,
        rank: updatedRank,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  router.get('/inventory/low', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM public.ingredients WHERE stock_quantity < min_stock_alert'
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/history/:userId', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM public.orders WHERE user_id = $1 ORDER BY created_at DESC',
        [req.params.userId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/table/start', requireAuth, requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    const { tableId, userId } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await startTableSession(client, { tableId, userId });
      await client.query('COMMIT');
      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'TABLE_START',
        description: `Mo ban ${tableId} cho user ${userId}`,
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Da mo ban' });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  router.post('/table/end', requireAuth, requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    const { tableId } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const sessionResult = await client.query(
        `SELECT s.session_id, s.user_id, s.start_time
         FROM public.billiard_sessions s
         WHERE s.table_id = $1 AND s.status = 'ACTIVE'
         LIMIT 1`,
        [tableId]
      );

      if (sessionResult.rowCount === 0) {
        throw new Error('Khong tim thay phien choi dang hoat dong');
      }

      const { session_id: sessionId, user_id: userId, start_time: startTime } = sessionResult.rows[0];
      const member = await getUserMembership(client, userId);
      const pricePerHour = await getCurrentPricePerHour(client);
      const diffMs = new Date() - new Date(startTime);
      const minutes = Math.ceil(diffMs / 60000);
      const subtotal = Math.round((minutes / 60) * pricePerHour);
      const discountPct = toNumber(member.discount_billiard_pct);
      const discountAmount = calculateDiscountAmount(subtotal, discountPct);
      const total = subtotal - discountAmount;

      const walletResult = await client.query(
        `UPDATE public.users
         SET wallet_balance = wallet_balance - $1::numeric
         WHERE user_id = $2 AND wallet_balance >= $1::numeric
         RETURNING wallet_balance`,
        [total, userId]
      );

      if (walletResult.rowCount === 0) {
        throw new Error('Vi khong du tien de thanh toan ban');
      }

        await client.query(
          'UPDATE public.billiard_sessions SET end_time = NOW(), total_amount = $1::numeric, status = $2 WHERE session_id = $3',
          [total, 'COMPLETED', sessionId]
        );
        await client.query(
          'UPDATE public.billiard_tables SET status = $1 WHERE table_id = $2',
          ['CLEANING', tableId]
        );
        await client.query(
          `UPDATE public.table_bookings
           SET status = 'COMPLETED'
           WHERE table_id = $1 AND status = 'CHECKED_IN'`,
          [tableId]
        );

        await client.query(
          `UPDATE public.orders
           SET status = 'DONE'
           WHERE user_id = $1
             AND order_type = 'CAFE'
             AND status = 'PENDING_PAYMENT'
             AND created_at >= $2`,
          [userId, startTime]
        );

        await client.query('COMMIT');

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'TABLE_END',
        description: `Dong ban ${tableId}, session ${sessionId}`,
        ipAddress: req.ip,
      });

        notificationHub.broadcast('session:completed', {
          session_id: sessionId,
          table_id: tableId,
          user_id: userId,
          total_minutes: minutes,
          total_price: total,
        });
        notificationHub.broadcast('table:cleaning', {
          table_id: Number(tableId),
          status: 'CLEANING',
        });

        res.json({
          success: true,
        rank: member.rank_name,
        discount_pct: discountPct,
        total_minutes: minutes,
        subtotal,
        discount_amount: discountAmount,
        total_price: total,
        balance: walletResult.rows[0].wallet_balance,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = { createCoreRouter };
