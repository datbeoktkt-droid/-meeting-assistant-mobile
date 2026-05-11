const express = require('express');
const { requireAuth, requireRoles } = require('../middlewares/authMiddleware');
const { resolveDateFilter, resolveMonthFilter, toNumber, calculateDiscountAmount } = require('../utils/common');
const { writeActivityLog } = require('../services/activityLogService');
const { getCurrentPricePerHour } = require('../services/pricingService');
const { getUserMembership, syncUserRank } = require('../services/membershipService');
const { hashPassword } = require('../services/authService');
const { startTableSession } = require('../services/sessionService');

function createAdminRouter({ pool, notificationHub }) {
  const router = express.Router();

  router.use(requireAuth);

  router.get('/reports/overview', async (req, res) => {
    try {
      const period = req.query.period || 'day';
      let clause;
      let label;
      let params = [];

      if (period === 'day') {
        label = resolveDateFilter(req.query.date);
        clause = `created_at::date = $1::date`;
        params = [label];
      } else if (period === 'month') {
        label = resolveMonthFilter(req.query.month);
        clause = `TO_CHAR(created_at, 'YYYY-MM') = $1`;
        params = [label];
      } else if (period === 'week') {
        label = resolveDateFilter(req.query.date);
        clause = `DATE_TRUNC('week', created_at) = DATE_TRUNC('week', $1::date)`;
        params = [label];
      } else {
        throw new Error('period chi ho tro day, week, month');
      }

      const ordersResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM public.orders
         WHERE status = 'DONE' AND ${clause}`,
        params
      );
      const billiardResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM public.billiard_sessions
         WHERE status = 'COMPLETED' AND ${clause.replace(/created_at/g, "COALESCE(end_time, start_time)")}`,
        params
      );
      const depositsResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM public.deposit_transactions
         WHERE ${clause}`,
        params
      );

      res.json({
        period,
        label,
        cafe_revenue: toNumber(ordersResult.rows[0].total),
        billiard_revenue: toNumber(billiardResult.rows[0].total),
        total_deposits: toNumber(depositsResult.rows[0].total),
        total_revenue:
          toNumber(ordersResult.rows[0].total) + toNumber(billiardResult.rows[0].total),
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/reports/top-products', async (req, res) => {
    try {
      const date = resolveDateFilter(req.query.date);
      const result = await pool.query(
        `SELECT p.product_id, p.product_name,
                SUM(od.quantity) AS total_quantity,
                SUM(od.quantity * od.unit_price) AS total_revenue
         FROM public.order_details od
         JOIN public.orders o ON o.order_id = od.order_id
         JOIN public.products p ON p.product_id = od.product_id
         WHERE o.status = 'DONE'
           AND o.created_at::date = $1::date
         GROUP BY p.product_id, p.product_name
         ORDER BY total_quantity DESC, total_revenue DESC
         LIMIT 10`,
        [date]
      );

      res.json({
        date,
        items: result.rows.map((row) => ({
          product_id: row.product_id,
          product_name: row.product_name,
          total_quantity: toNumber(row.total_quantity),
          total_revenue: toNumber(row.total_revenue),
        })),
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/reports/occupancy', async (req, res) => {
    try {
      const date = resolveDateFilter(req.query.date);
      const tables = await pool.query(
        `SELECT bt.table_id, bt.table_number,
                COUNT(bs.session_id) AS total_sessions,
                COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(bs.end_time, NOW()) - bs.start_time)) / 60.0), 0) AS total_minutes
         FROM public.billiard_tables bt
         LEFT JOIN public.billiard_sessions bs
           ON bs.table_id = bt.table_id
          AND bs.start_time::date = $1::date
         GROUP BY bt.table_id, bt.table_number
         ORDER BY total_minutes DESC, total_sessions DESC, bt.table_number ASC`,
        [date]
      );

      const hours = await pool.query(
        `SELECT EXTRACT(HOUR FROM start_time)::int AS hour_slot,
                COUNT(*) AS total_sessions
         FROM public.billiard_sessions
         WHERE start_time::date = $1::date
         GROUP BY hour_slot
         ORDER BY total_sessions DESC, hour_slot ASC`,
        [date]
      );

      res.json({
        date,
        tables: tables.rows.map((row) => ({
          table_id: row.table_id,
          table_number: row.table_number,
          total_sessions: toNumber(row.total_sessions),
          total_minutes: Math.round(toNumber(row.total_minutes)),
        })),
        peak_hours: hours.rows.map((row) => ({
          hour_slot: toNumber(row.hour_slot),
          total_sessions: toNumber(row.total_sessions),
        })),
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/reports/system-balance', requireRoles('ADMIN'), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COALESCE(SUM(wallet_balance), 0) AS total_wallet_balance,
                COUNT(*) AS total_users
         FROM public.users`
      );

      res.json({
        total_wallet_balance: toNumber(result.rows[0].total_wallet_balance),
        total_users: toNumber(result.rows[0].total_users),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/members', requireRoles('ADMIN', 'STAFF'), async (req, res) => {
    try {
      const { q = '', rankId = null } = req.query;
      const values = [];
      const conditions = [];

      if (q) {
        values.push(`%${q}%`);
        conditions.push(`(u.full_name ILIKE $${values.length} OR u.phone ILIKE $${values.length})`);
      }

      if (rankId) {
        values.push(rankId);
        conditions.push(`u.rank_id = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query(
        `SELECT u.user_id, u.phone, u.full_name, u.wallet_balance, u.total_deposited, u.rank_id, u.avatar_url, u.created_at,
                mr.rank_name, mr.discount_billiard_pct, mr.discount_cafe_pct
         FROM public.users u
         LEFT JOIN public.membership_ranks mr ON mr.rank_id = u.rank_id
         ${whereClause}
         ORDER BY u.user_id DESC`,
        values
      );

      res.json(result.rows.map((row) => ({
        ...row,
        wallet_balance: toNumber(row.wallet_balance),
        total_deposited: toNumber(row.total_deposited),
      })));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/members/:userId', requireRoles('ADMIN', 'STAFF'), async (req, res) => {
    const client = await pool.connect();
    try {
      const member = await getUserMembership(client, req.params.userId);
      const orderStats = await client.query(
        `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_spent
         FROM public.orders
         WHERE user_id = $1 AND status = 'DONE'`,
        [req.params.userId]
      );

      res.json({
        ...member,
        wallet_balance: toNumber(member.wallet_balance),
        total_deposited: toNumber(member.total_deposited),
        total_orders: toNumber(orderStats.rows[0].total_orders),
        total_spent: toNumber(orderStats.rows[0].total_spent),
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.post('/members', requireRoles('ADMIN', 'STAFF'), async (req, res) => {
    try {
      const { phone, fullName = null, avatarUrl = null, rankId = 1 } = req.body;
      if (!phone) {
        throw new Error('Thieu phone');
      }

      const result = await pool.query(
        `INSERT INTO public.users (phone, full_name, avatar_url, rank_id)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, phone, full_name, wallet_balance, total_deposited, rank_id, avatar_url, created_at`,
        [phone, fullName, avatarUrl, rankId]
      );

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'MEMBER_CREATE',
        description: `Tao thanh vien ${phone}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, member: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/members/:userId', requireRoles('ADMIN', 'STAFF'), async (req, res) => {
    try {
      const { fullName = null, avatarUrl = null, rankId = null } = req.body;
      const result = await pool.query(
        `UPDATE public.users
         SET full_name = COALESCE($1, full_name),
             avatar_url = COALESCE($2, avatar_url),
             rank_id = COALESCE($3, rank_id)
         WHERE user_id = $4
         RETURNING user_id, phone, full_name, wallet_balance, total_deposited, rank_id, avatar_url, created_at`,
        [fullName, avatarUrl, rankId, req.params.userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay thanh vien');
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'MEMBER_UPDATE',
        description: `Cap nhat thanh vien ${req.params.userId}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, member: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/tables', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT bt.table_id, bt.table_number, bt.is_vip, bt.status,
                active.session_id AS active_session_id,
                active.user_id AS active_user_id,
                reserved.booking_id AS reserved_booking_id
         FROM public.billiard_tables bt
         LEFT JOIN LATERAL (
           SELECT s.session_id, s.user_id
           FROM public.billiard_sessions s
           WHERE s.table_id = bt.table_id AND s.status = 'ACTIVE'
           LIMIT 1
         ) active ON TRUE
         LEFT JOIN LATERAL (
           SELECT b.booking_id
           FROM public.table_bookings b
           WHERE b.table_id = bt.table_id AND b.status IN ('PENDING', 'RESERVED', 'CHECKED_IN')
           ORDER BY b.booking_start ASC
           LIMIT 1
         ) reserved ON TRUE
         ORDER BY bt.table_number ASC`
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/tables/:tableId/invoice-summary', async (req, res) => {
    const client = await pool.connect();

    try {
      const tableId = req.params.tableId;
      const tableResult = await client.query(
        `SELECT table_id, table_number, qr_code_path
         FROM public.billiard_tables
         WHERE table_id = $1
         LIMIT 1`,
        [tableId]
      );

        const activeSessionResult = await client.query(
          `SELECT session_id, user_id, start_time, status
           FROM public.billiard_sessions
           WHERE table_id = $1 AND status = 'ACTIVE'
           ORDER BY session_id DESC
           LIMIT 1`,
        [tableId]
      );

      const mergedOrdersResult = await client.query(
        `SELECT order_id, user_id, total_amount, order_type, status, created_at
         FROM public.orders
         WHERE session_id IN (
           SELECT session_id
           FROM public.billiard_sessions
           WHERE table_id = $1
         )
           AND status = 'DONE'
         ORDER BY created_at DESC`,
        [tableId]
      );

      let activeSessionCharge = null;
      let activeCafeItems = [];
      let cafeOutstandingTotal = 0;
      let cafeSettledTotal = 0;
      let customerRankName = null;

        if (activeSessionResult.rowCount > 0) {
          const activeSession = activeSessionResult.rows[0];
          const member = await getUserMembership(client, activeSession.user_id);
          customerRankName = member.rank_name;
          const pricePerHour = await getCurrentPricePerHour(client);
          const minutes = Math.ceil((Date.now() - new Date(activeSession.start_time).getTime()) / 60000);
          const subtotal = Math.round((minutes / 60) * pricePerHour);
          const discountPct = toNumber(member.discount_billiard_pct);
          const discountAmount = calculateDiscountAmount(subtotal, discountPct);
          const estimatedTotal = subtotal - discountAmount;

        activeSessionCharge = {
          session_id: activeSession.session_id,
          user_id: activeSession.user_id,
          start_time: activeSession.start_time,
          minutes,
          subtotal,
          discount_pct: discountPct,
          discount_amount: discountAmount,
          estimated_total: estimatedTotal,
        };

          const cafeOrdersResult = await client.query(
            `SELECT o.order_id, o.user_id, o.total_amount, o.order_type, o.status, o.created_at,
                    COALESCE(SUM(od.quantity * od.unit_price), 0) AS subtotal
             FROM public.orders o
             LEFT JOIN public.order_details od ON od.order_id = o.order_id
             WHERE o.user_id = $1
               AND o.created_at >= $2
               AND o.order_type = 'CAFE'
               AND o.status = 'PENDING_PAYMENT'
             GROUP BY o.order_id, o.user_id, o.total_amount, o.order_type, o.status, o.created_at
             ORDER BY o.created_at DESC`,
            [activeSession.user_id, activeSession.start_time]
          );

          activeCafeItems = cafeOrdersResult.rows.map((row) => {
            const subtotalAmount = toNumber(row.subtotal);
            const finalAmount = toNumber(row.total_amount);
            const cafeDiscountAmount = Math.max(0, subtotalAmount - finalAmount);

            return {
              order_id: row.order_id,
              user_id: row.user_id,
              subtotal_amount: subtotalAmount,
              total_amount: finalAmount,
              discount_pct: toNumber(member.discount_cafe_pct),
              discount_amount: cafeDiscountAmount,
              order_type: row.order_type,
              status: row.status,
              created_at: row.created_at,
            };
          });

          cafeOutstandingTotal = activeCafeItems
            .filter((item) => item.status === 'PENDING_PAYMENT')
            .reduce((sum, item) => sum + item.total_amount, 0);
          cafeSettledTotal = activeCafeItems
            .filter((item) => item.status === 'DONE')
            .reduce((sum, item) => sum + item.total_amount, 0);
        }

        const mergedItems = mergedOrdersResult.rows.map((row) => ({
          order_id: row.order_id,
          user_id: row.user_id,
          total_amount: toNumber(row.total_amount),
          order_type: row.order_type,
          status: row.status,
          created_at: row.created_at,
        }));

        const historicalTotal = mergedItems.reduce((sum, item) => sum + item.total_amount, 0);
        const currentEstimated = activeSessionCharge ? activeSessionCharge.estimated_total : 0;
        const cafeTotal = cafeOutstandingTotal + cafeSettledTotal;
        const cafeSubtotalTotal = activeCafeItems.reduce((sum, item) => sum + toNumber(item.subtotal_amount), 0);
        const cafeDiscountTotal = Math.max(0, cafeSubtotalTotal - cafeTotal);

        res.json({
          table_id: Number(tableId),
          table_number: tableResult.rows[0]?.table_number || null,
          table_qr_code_path: tableResult.rows[0]?.qr_code_path || null,
          customer_rank_name: customerRankName,
          active_session: activeSessionCharge,
          active_cafe_items: activeCafeItems,
          settled_items: mergedItems,
          historical_total: historicalTotal,
          cafe_outstanding_total: cafeOutstandingTotal,
          cafe_settled_total: cafeSettledTotal,
          cafe_subtotal_total: cafeSubtotalTotal,
          cafe_discount_total: cafeDiscountTotal,
          cafe_total: cafeTotal,
          current_estimated_total: currentEstimated,
          grand_total: currentEstimated + cafeOutstandingTotal,
        });
      } catch (error) {
        res.status(400).json({ error: error.message });
      } finally {
        client.release();
      }
  });

  router.get('/staffs', requireRoles('ADMIN'), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT staff_id, username, full_name, role, is_active, last_login
         FROM public.staff
         ORDER BY staff_id ASC`
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/products', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    try {
      const { q = '', category = null, isAvailable = null } = req.query;
      const values = [];
      const conditions = [];

      if (q) {
        values.push(`%${q}%`);
        conditions.push(`p.product_name ILIKE $${values.length}`);
      }
      if (category) {
        values.push(category);
        conditions.push(`p.category = $${values.length}`);
      }
      if (isAvailable !== null && isAvailable !== undefined && isAvailable !== '') {
        values.push(isAvailable === 'true');
        conditions.push(`p.is_available = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT product_id, product_name, category, price, image_url, stock_quantity, is_available
         FROM public.products p
         ${whereClause}
         ORDER BY product_id ASC`,
        values
      );
      res.json(result.rows.map((row) => ({ ...row, price: toNumber(row.price) })));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/recipes/:productId', requireRoles('ADMIN', 'BARISTA'), async (req, res) => {
    try {
      const productResult = await pool.query(
        `SELECT product_id, product_name, category, price, is_available
         FROM public.products
         WHERE product_id = $1`,
        [req.params.productId]
      );

      if (productResult.rowCount === 0) {
        throw new Error('Khong tim thay san pham');
      }

      const recipeResult = await pool.query(
        `SELECT r.product_id, r.ingredient_id, i.ingredient_name, i.unit, r.quantity_needed
         FROM public.recipes r
         JOIN public.ingredients i ON i.ingredient_id = r.ingredient_id
         WHERE r.product_id = $1
         ORDER BY r.ingredient_id ASC`,
        [req.params.productId]
      );

      res.json({
        product: productResult.rows[0],
        items: recipeResult.rows.map((row) => ({
          product_id: row.product_id,
          ingredient_id: row.ingredient_id,
          ingredient_name: row.ingredient_name,
          unit: row.unit,
          quantity_needed: toNumber(row.quantity_needed),
        })),
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.put('/recipes/:productId', requireRoles('ADMIN', 'BARISTA'), async (req, res) => {
    const { items = [] } = req.body;
    const client = await pool.connect();

    try {
      if (!Array.isArray(items)) {
        throw new Error('items phai la mang');
      }

      await client.query('BEGIN');

      const productResult = await client.query(
        'SELECT product_id, product_name FROM public.products WHERE product_id = $1',
        [req.params.productId]
      );

      if (productResult.rowCount === 0) {
        throw new Error('Khong tim thay san pham');
      }

      await client.query(
        'DELETE FROM public.recipes WHERE product_id = $1',
        [req.params.productId]
      );

      for (const item of items) {
        if (!item.ingredientId || !item.quantityNeeded || Number(item.quantityNeeded) <= 0) {
          throw new Error('ingredientId hoac quantityNeeded khong hop le');
        }

        await client.query(
          `INSERT INTO public.recipes (product_id, ingredient_id, quantity_needed)
           VALUES ($1, $2, $3::numeric)`,
          [req.params.productId, item.ingredientId, item.quantityNeeded]
        );
      }

      await client.query('COMMIT');

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'RECIPE_UPDATE',
        description: `Cap nhat cong thuc san pham ${req.params.productId}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, product_id: Number(req.params.productId), total_items: items.length });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.post('/products', requireRoles('ADMIN', 'BARISTA'), async (req, res) => {
    try {
      const { productName, category = null, price, imageUrl = null, stockQuantity = 0, isAvailable = true } = req.body;
      if (!productName || !price || Number(price) <= 0) {
        throw new Error('Thieu ten san pham hoac gia khong hop le');
      }

      const result = await pool.query(
        `INSERT INTO public.products (product_name, category, price, image_url, stock_quantity, is_available)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING product_id, product_name, category, price, image_url, stock_quantity, is_available`,
        [productName, category, price, imageUrl, stockQuantity, isAvailable]
      );

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'PRODUCT_CREATE',
        description: `Tao san pham ${productName}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, product: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/products/:productId', requireRoles('ADMIN', 'BARISTA'), async (req, res) => {
    try {
      const { productName = null, category = null, price = null, imageUrl = null, stockQuantity = null, isAvailable = null } = req.body;
      const result = await pool.query(
        `UPDATE public.products
         SET product_name = COALESCE($1, product_name),
             category = COALESCE($2, category),
             price = COALESCE($3::numeric, price),
             image_url = COALESCE($4, image_url),
             stock_quantity = COALESCE($5, stock_quantity),
             is_available = COALESCE($6, is_available)
         WHERE product_id = $7
         RETURNING product_id, product_name, category, price, image_url, stock_quantity, is_available`,
        [productName, category, price, imageUrl, stockQuantity, isAvailable, req.params.productId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay san pham');
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'PRODUCT_UPDATE',
        description: `Cap nhat san pham ${req.params.productId}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, product: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/products/:productId', requireRoles('ADMIN', 'BARISTA'), async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE public.products
         SET is_available = false
         WHERE product_id = $1
         RETURNING product_id, product_name, is_available`,
        [req.params.productId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay san pham');
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'PRODUCT_DISABLE',
        description: `An san pham ${req.params.productId}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, product: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/inventory', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    try {
      const { q = '' } = req.query;
      const values = [];
      let whereClause = '';
      if (q) {
        values.push(`%${q}%`);
        whereClause = `WHERE ingredient_name ILIKE $1`;
      }

      const result = await pool.query(
        `SELECT ingredient_id, ingredient_name, unit, stock_quantity, min_stock_alert, cost_price, last_imported_at
         FROM public.ingredients
         ${whereClause}
         ORDER BY ingredient_id ASC`,
        values
      );

      res.json(result.rows.map((row) => ({
        ...row,
        stock_quantity: toNumber(row.stock_quantity),
        min_stock_alert: toNumber(row.min_stock_alert),
        cost_price: toNumber(row.cost_price),
      })));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/inventory', requireRoles('ADMIN', 'BARISTA'), async (req, res) => {
    try {
      const { ingredientName, unit, stockQuantity = 0, minStockAlert = 5, costPrice = 0 } = req.body;
      if (!ingredientName || !unit) {
        throw new Error('Thieu ten nguyen lieu hoac don vi');
      }

      const result = await pool.query(
        `INSERT INTO public.ingredients (ingredient_name, unit, stock_quantity, min_stock_alert, cost_price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ingredient_id, ingredient_name, unit, stock_quantity, min_stock_alert, cost_price, last_imported_at`,
        [ingredientName, unit, stockQuantity, minStockAlert, costPrice]
      );

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'INGREDIENT_CREATE',
        description: `Tao nguyen lieu ${ingredientName}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, ingredient: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/inventory/:ingredientId', requireRoles('ADMIN', 'BARISTA'), async (req, res) => {
    try {
      const { ingredientName = null, unit = null, minStockAlert = null, costPrice = null } = req.body;
      const result = await pool.query(
        `UPDATE public.ingredients
         SET ingredient_name = COALESCE($1, ingredient_name),
             unit = COALESCE($2, unit),
             min_stock_alert = COALESCE($3::numeric, min_stock_alert),
             cost_price = COALESCE($4::numeric, cost_price)
         WHERE ingredient_id = $5
         RETURNING ingredient_id, ingredient_name, unit, stock_quantity, min_stock_alert, cost_price, last_imported_at`,
        [ingredientName, unit, minStockAlert, costPrice, req.params.ingredientId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay nguyen lieu');
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'INGREDIENT_UPDATE',
        description: `Cap nhat nguyen lieu ${req.params.ingredientId}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, ingredient: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/inventory/:ingredientId/restock', requireRoles('ADMIN', 'BARISTA'), async (req, res) => {
    try {
      const { amount, costPrice = null } = req.body;
      if (!amount || Number(amount) <= 0) {
        throw new Error('So luong nhap khong hop le');
      }

      const result = await pool.query(
        `UPDATE public.ingredients
         SET stock_quantity = stock_quantity + $1::numeric,
             cost_price = COALESCE($2::numeric, cost_price),
             last_imported_at = NOW()
         WHERE ingredient_id = $3
         RETURNING ingredient_id, ingredient_name, unit, stock_quantity, min_stock_alert, cost_price, last_imported_at`,
        [amount, costPrice, req.params.ingredientId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay nguyen lieu');
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'INGREDIENT_RESTOCK',
        description: `Nhap them ${amount} cho nguyen lieu ${req.params.ingredientId}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, ingredient: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/payment-receivers', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT receiver_id, display_name, bank_name, bank_code, account_name, account_number,
                qr_code_url, notes, is_active, sort_order, created_at, updated_at
         FROM public.payment_receivers
         ORDER BY is_active DESC, sort_order ASC, receiver_id ASC`
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/payment-receivers', requireRoles('ADMIN'), async (req, res) => {
    try {
      const {
        displayName,
        bankName,
        bankCode = '',
        accountName,
        accountNumber,
        qrCodeUrl = null,
        notes = null,
        isActive = true,
        sortOrder = 0,
      } = req.body;

      if (!displayName || !bankName || !accountName || !accountNumber) {
        throw new Error('Thiếu thông tin tài khoản thanh toán');
      }

      const result = await pool.query(
        `INSERT INTO public.payment_receivers (
           display_name, bank_name, bank_code, account_name, account_number, qr_code_url, notes, is_active, sort_order
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING receiver_id, display_name, bank_name, bank_code, account_name, account_number,
                   qr_code_url, notes, is_active, sort_order, created_at, updated_at`,
        [displayName, bankName, bankCode, accountName, accountNumber, qrCodeUrl, notes, Boolean(isActive), sortOrder]
      );

      res.json({ success: true, payment_receiver: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/payment-receivers/:receiverId', requireRoles('ADMIN'), async (req, res) => {
    try {
      const {
        displayName = null,
        bankName = null,
        bankCode = null,
        accountName = null,
        accountNumber = null,
        qrCodeUrl = null,
        notes = null,
        isActive = null,
        sortOrder = null,
      } = req.body;

      const result = await pool.query(
        `UPDATE public.payment_receivers
         SET display_name = COALESCE($1, display_name),
             bank_name = COALESCE($2, bank_name),
             bank_code = COALESCE($3, bank_code),
             account_name = COALESCE($4, account_name),
             account_number = COALESCE($5, account_number),
             qr_code_url = COALESCE($6, qr_code_url),
             notes = COALESCE($7, notes),
             is_active = COALESCE($8, is_active),
             sort_order = COALESCE($9, sort_order),
             updated_at = NOW()
         WHERE receiver_id = $10
         RETURNING receiver_id, display_name, bank_name, bank_code, account_name, account_number,
                    qr_code_url, notes, is_active, sort_order, created_at, updated_at`,
        [displayName, bankName, bankCode, accountName, accountNumber, qrCodeUrl, notes, isActive, sortOrder, req.params.receiverId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay tai khoan thanh toan');
      }

      res.json({ success: true, payment_receiver: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/payment-receivers/:receiverId', requireRoles('ADMIN'), async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM public.payment_receivers
         WHERE receiver_id = $1
         RETURNING receiver_id`,
        [req.params.receiverId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay tai khoan thanh toan');
      }

      res.json({ success: true, receiver_id: result.rows[0].receiver_id });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/bookings', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    try {
      const { date = null, status = null } = req.query;
      const values = [];
      const conditions = [];

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
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/bookings/:bookingId', requireRoles('ADMIN', 'STAFF'), async (req, res) => {
    try {
      const { status = null, notes = null } = req.body;
      const allowedStatuses = [null, 'PENDING', 'RESERVED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
      if (!allowedStatuses.includes(status)) {
        throw new Error('Trang thai booking khong hop le');
      }

      if (status) {
        const currentResult = await pool.query(
          `SELECT booking_id, status
           FROM public.table_bookings
           WHERE booking_id = $1`,
          [req.params.bookingId]
        );

        if (currentResult.rowCount === 0) {
          throw new Error('Khong tim thay booking');
        }

        const currentStatus = currentResult.rows[0].status;
        const allowedTransitions = {
          PENDING: ['RESERVED', 'CANCELLED', 'EXPIRED'],
          RESERVED: ['CANCELLED', 'EXPIRED'],
          CHECKED_IN: ['COMPLETED'],
          COMPLETED: [],
          CANCELLED: [],
          EXPIRED: [],
        };

        if (status !== currentStatus) {
          const nextStates = allowedTransitions[currentStatus] || [];
          if (!nextStates.includes(status)) {
            throw new Error(
              `Khong the chuyen booking tu ${currentStatus} sang ${status}`
            );
          }
        }
      }

      const currentBookingResult = await pool.query(
        `SELECT booking_id, table_id, user_id, status
         FROM public.table_bookings
         WHERE booking_id = $1`,
        [req.params.bookingId]
      );

      if (currentBookingResult.rowCount === 0) {
        throw new Error('Khong tim thay booking');
      }

      const currentBooking = currentBookingResult.rows[0];

      const result = await pool.query(
        `UPDATE public.table_bookings
         SET status = COALESCE($1, status),
             notes = COALESCE($2, notes)
         WHERE booking_id = $3
         RETURNING *`,
        [status, notes, req.params.bookingId]
      );

      if (status === 'RESERVED') {
        await pool.query(
          `UPDATE public.billiard_tables
           SET status = 'RESERVED'
           WHERE table_id = $1 AND status = 'AVAILABLE'`,
          [currentBooking.table_id]
        );
      }

      if (['CANCELLED', 'EXPIRED'].includes(status)) {
        await pool.query(
          `UPDATE public.billiard_tables
           SET status = 'AVAILABLE'
           WHERE table_id = $1 AND status = 'RESERVED'`,
          [currentBooking.table_id]
        );
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'BOOKING_UPDATE',
        description: `Cap nhat booking ${req.params.bookingId}`,
        ipAddress: req.ip,
      });

      const updatedBooking = result.rows[0];
      if (status === 'RESERVED') {
        notificationHub.broadcast('booking:reserved', updatedBooking);
      } else if (status === 'COMPLETED') {
        notificationHub.broadcast('booking:completed', updatedBooking);
      } else if (status === 'CANCELLED') {
        notificationHub.broadcast('booking:cancelled', updatedBooking);
      } else if (status === 'EXPIRED') {
        notificationHub.broadcast('booking:expired', updatedBooking);
      } else {
        notificationHub.broadcast('booking:updated', updatedBooking);
      }

      res.json({ success: true, booking: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/bookings/:bookingId/check-in', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
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

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'BOOKING_CHECKIN',
        description: `Check-in booking ${booking.booking_id} va mo ban ${booking.table_id}`,
        ipAddress: req.ip,
      });

      notificationHub.broadcast('booking:checked_in', {
        booking_id: booking.booking_id,
        table_id: booking.table_id,
        user_id: booking.user_id,
      });

      res.json({ success: true, booking_id: booking.booking_id, table_id: booking.table_id });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.patch('/staffs/:staffId/password', requireRoles('ADMIN'), async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || String(newPassword).length < 6) {
        throw new Error('Mat khau moi phai co it nhat 6 ky tu');
      }

      const passwordHash = await hashPassword(newPassword);
      const result = await pool.query(
        `UPDATE public.staff
         SET password_hash = $1
         WHERE staff_id = $2
         RETURNING staff_id, username, role`,
        [passwordHash, req.params.staffId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay staff');
      }

      await pool.query(
        `UPDATE public.auth_refresh_tokens
         SET revoked_at = NOW(), last_used_at = NOW()
         WHERE staff_id = $1 AND revoked_at IS NULL`,
        [req.params.staffId]
      );

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'PASSWORD_RESET',
        description: `Reset mat khau staff ${req.params.staffId}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, staff: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/price-configs', requireRoles('ADMIN'), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT config_id, start_time, end_time, price_per_hour, is_weekend
         FROM public.price_configs
         ORDER BY is_weekend ASC, start_time ASC, config_id ASC`
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch('/price-configs/:configId', requireRoles('ADMIN'), async (req, res) => {
    try {
      const { startTime, endTime, pricePerHour, isWeekend } = req.body;
      const result = await pool.query(
        `UPDATE public.price_configs
         SET start_time = COALESCE($1, start_time),
             end_time = COALESCE($2, end_time),
             price_per_hour = COALESCE($3::numeric, price_per_hour),
             is_weekend = COALESCE($4, is_weekend)
         WHERE config_id = $5
         RETURNING config_id, start_time, end_time, price_per_hour, is_weekend`,
        [startTime || null, endTime || null, pricePerHour ?? null, isWeekend ?? null, req.params.configId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay cau hinh gia');
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'PRICE_CONFIG_UPDATE',
        description: `Cap nhat bang gia ${req.params.configId}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, price_config: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/tables/:tableId/status', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    try {
      const allowedStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];
      const { status } = req.body;

      if (!allowedStatuses.includes(status)) {
        throw new Error('Trang thai khong hop le');
      }

      const result = await pool.query(
        `UPDATE public.billiard_tables
         SET status = $1
         WHERE table_id = $2
         RETURNING *`,
        [status, req.params.tableId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay ban');
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'TABLE_STATUS',
        description: `Cap nhat ban ${req.params.tableId} sang ${status}`,
        ipAddress: req.ip,
      });

      notificationHub.broadcast('table:status_changed', result.rows[0]);
      res.json({ success: true, table: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/tables/:tableId/mark-cleaning', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE public.billiard_tables
         SET status = 'CLEANING'
         WHERE table_id = $1
         RETURNING *`,
        [req.params.tableId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay ban');
      }

      notificationHub.broadcast('table:cleaning', result.rows[0]);
      res.json({ success: true, table: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/tables/:tableId/mark-available', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE public.billiard_tables
         SET status = 'AVAILABLE'
         WHERE table_id = $1
         RETURNING *`,
        [req.params.tableId]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay ban');
      }

      notificationHub.broadcast('table:available', result.rows[0]);
      res.json({ success: true, table: result.rows[0] });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/tables/transfer', requireRoles('ADMIN', 'STAFF'), async (req, res) => {
    const { fromTableId, toTableId } = req.body;
    const client = await pool.connect();

    try {
      if (!fromTableId || !toTableId) {
        throw new Error('Thieu fromTableId hoac toTableId');
      }

      await client.query('BEGIN');

      const fromSession = await client.query(
        `SELECT session_id
         FROM public.billiard_sessions
         WHERE table_id = $1 AND status = 'ACTIVE'
         LIMIT 1`,
        [fromTableId]
      );

      if (fromSession.rowCount === 0) {
        throw new Error('Ban nguon khong co session dang chay');
      }

      const targetTable = await client.query(
        `SELECT table_id, status
         FROM public.billiard_tables
         WHERE table_id = $1
         FOR UPDATE`,
        [toTableId]
      );

      if (targetTable.rowCount === 0) {
        throw new Error('Ban dich khong ton tai');
      }

      if (targetTable.rows[0].status !== 'AVAILABLE') {
        throw new Error('Ban dich khong trong');
      }

      await client.query(
        `UPDATE public.billiard_sessions
         SET table_id = $1
         WHERE session_id = $2`,
        [toTableId, fromSession.rows[0].session_id]
      );

      await client.query(`UPDATE public.billiard_tables SET status = 'AVAILABLE' WHERE table_id = $1`, [fromTableId]);
      const transferredTable = await client.query(
        `UPDATE public.billiard_tables
         SET status = 'OCCUPIED'
         WHERE table_id = $1
         RETURNING *`,
        [toTableId]
      );

      await client.query('COMMIT');

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'TABLE_TRANSFER',
        description: `Chuyen session tu ban ${fromTableId} sang ban ${toTableId}`,
        ipAddress: req.ip,
      });

      notificationHub.broadcast('table:transferred', {
        from_table_id: Number(fromTableId),
        to_table_id: Number(toTableId),
        session_id: fromSession.rows[0].session_id,
      });

      res.json({
        success: true,
        from_table_id: Number(fromTableId),
        to_table_id: Number(toTableId),
        table: transferredTable.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.post('/tables/merge-bill', requireRoles('ADMIN', 'STAFF'), async (req, res) => {
    const { sourceTableId, targetTableId } = req.body;
    const client = await pool.connect();

    try {
      if (!sourceTableId || !targetTableId) {
        throw new Error('Thieu sourceTableId hoac targetTableId');
      }

      if (Number(sourceTableId) === Number(targetTableId)) {
        throw new Error('Khong the gop cung mot ban');
      }

      await client.query('BEGIN');

      const sourceSessionResult = await client.query(
        `SELECT session_id, user_id, table_id, start_time
         FROM public.billiard_sessions
         WHERE table_id = $1 AND status = 'ACTIVE'
         LIMIT 1`,
        [sourceTableId]
      );
      const targetSessionResult = await client.query(
        `SELECT session_id, user_id, table_id, start_time
         FROM public.billiard_sessions
         WHERE table_id = $1 AND status = 'ACTIVE'
         LIMIT 1`,
        [targetTableId]
      );

      if (sourceSessionResult.rowCount === 0) {
        throw new Error('Ban nguon khong co session dang chay');
      }
      if (targetSessionResult.rowCount === 0) {
        throw new Error('Ban dich khong co session dang chay');
      }

      const sourceSession = sourceSessionResult.rows[0];
      const targetSession = targetSessionResult.rows[0];
      const sourceMember = await getUserMembership(client, sourceSession.user_id);
      const targetMember = await getUserMembership(client, targetSession.user_id);
      const pricePerHour = await getCurrentPricePerHour(client);
      const minutes = Math.ceil((Date.now() - new Date(sourceSession.start_time).getTime()) / 60000);
      const subtotal = Math.round((minutes / 60) * pricePerHour);
      const discountPct = toNumber(sourceMember.discount_billiard_pct);
      const discountAmount = calculateDiscountAmount(subtotal, discountPct);
      const mergedAmount = subtotal - discountAmount;

      const walletResult = await client.query(
        `UPDATE public.users
         SET wallet_balance = wallet_balance - $1::numeric
         WHERE user_id = $2 AND wallet_balance >= $1::numeric
         RETURNING wallet_balance`,
        [mergedAmount, targetSession.user_id]
      );

      if (walletResult.rowCount === 0) {
        throw new Error('Nguoi thanh toan o ban dich khong du tien');
      }

      await client.query(
        `UPDATE public.billiard_sessions
         SET end_time = NOW(), total_amount = $1::numeric, status = 'MERGED'
         WHERE session_id = $2`,
        [mergedAmount, sourceSession.session_id]
      );
      await client.query(
        `UPDATE public.billiard_tables
         SET status = 'CLEANING'
         WHERE table_id = $1`,
        [sourceTableId]
      );
      const mergedOrder = await client.query(
        `INSERT INTO public.orders (user_id, session_id, total_amount, order_type, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING order_id, total_amount`,
        [targetSession.user_id, targetSession.session_id, mergedAmount, 'BILLIARD_MERGE', 'DONE']
      );

      await client.query('COMMIT');

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'MERGE_BILL',
        description: `Gop tien ban ${sourceTableId} vao ban ${targetTableId}`,
        ipAddress: req.ip,
      });

      notificationHub.broadcast('table:merged_bill', {
        source_table_id: Number(sourceTableId),
        target_table_id: Number(targetTableId),
        source_session_id: sourceSession.session_id,
        target_session_id: targetSession.session_id,
        minutes,
        subtotal,
        discount_pct: discountPct,
        discount_amount: discountAmount,
        merged_amount: mergedAmount,
      });

      res.json({
        success: true,
        source_table_id: Number(sourceTableId),
        target_table_id: Number(targetTableId),
        payer_user_id: targetSession.user_id,
        payer_name: targetMember.full_name,
        merged_order_id: mergedOrder.rows[0].order_id,
        minutes,
        subtotal,
        discount_pct: discountPct,
        discount_amount: discountAmount,
        merged_amount: mergedAmount,
        balance: walletResult.rows[0].wallet_balance,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.get('/activity-logs', requireRoles('ADMIN'), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT log_id, staff_id, action_type, description, ip_address, created_at
         FROM public.activity_logs
         ORDER BY created_at DESC
         LIMIT 100`
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/topup-requests', requireRoles('ADMIN', 'STAFF'), async (req, res) => {
    try {
      const { status = null } = req.query;
      const values = [];
      let whereClause = '';

      if (status) {
        values.push(status);
        whereClause = `WHERE tr.status = $1`;
      }

      const result = await pool.query(
        `SELECT tr.request_id, tr.user_id, tr.amount, tr.payment_method, tr.note, tr.status,
                tr.reviewed_by, tr.reviewed_at, tr.reject_reason, tr.created_at,
                u.full_name, u.phone,
                s.username AS reviewed_by_username
         FROM public.wallet_topup_requests tr
         JOIN public.users u ON u.user_id = tr.user_id
         LEFT JOIN public.staff s ON s.staff_id = tr.reviewed_by
         ${whereClause}
         ORDER BY tr.created_at DESC`,
        values
      );

      res.json(result.rows.map((row) => ({
        ...row,
        amount: toNumber(row.amount),
      })));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/topup-requests/:requestId', requireRoles('ADMIN'), async (req, res) => {
    const { action, rejectReason = null, paymentMethod = 'MANUAL_APPROVAL', referenceCode = null } = req.body;
    const client = await pool.connect();

    try {
      if (!['APPROVE', 'REJECT'].includes(action)) {
        throw new Error('action phai la APPROVE hoac REJECT');
      }

      await client.query('BEGIN');

      const requestResult = await client.query(
        `SELECT request_id, user_id, amount, status
         FROM public.wallet_topup_requests
         WHERE request_id = $1
         FOR UPDATE`,
        [req.params.requestId]
      );

      if (requestResult.rowCount === 0) {
        throw new Error('Khong tim thay yeu cau nap tien');
      }

      const requestRow = requestResult.rows[0];
      if (requestRow.status !== 'PENDING') {
        throw new Error('Yeu cau nay da duoc xu ly');
      }

      if (action === 'REJECT') {
        await client.query(
          `UPDATE public.wallet_topup_requests
           SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), reject_reason = $2
           WHERE request_id = $3`,
          [req.auth.staff_id, rejectReason, req.params.requestId]
        );
      } else {
        const depositResult = await client.query(
          `UPDATE public.users
           SET wallet_balance = wallet_balance + $1::numeric,
               total_deposited = total_deposited + $1::numeric
           WHERE user_id = $2
           RETURNING wallet_balance, total_deposited`,
          [requestRow.amount, requestRow.user_id]
        );

        if (depositResult.rowCount === 0) {
          throw new Error('Khong tim thay thanh vien');
        }

        await client.query(
          `INSERT INTO public.deposit_transactions (user_id, staff_id, amount, payment_method, reference_code)
           VALUES ($1, $2, $3, $4, $5)`,
          [requestRow.user_id, req.auth.staff_id, requestRow.amount, paymentMethod, referenceCode]
        );

        await syncUserRank(client, requestRow.user_id);

        await client.query(
          `UPDATE public.wallet_topup_requests
           SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), reject_reason = NULL
           WHERE request_id = $2`,
          [req.auth.staff_id, req.params.requestId]
        );
      }

      await client.query('COMMIT');

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'TOPUP_REQUEST_REVIEW',
        description: `${action} yeu cau nap tien ${req.params.requestId}`,
        ipAddress: req.ip,
      });

      notificationHub.broadcast('topup:reviewed', {
        request_id: Number(req.params.requestId),
        action,
        user_id: requestRow.user_id,
        reviewed_by: req.auth.staff_id,
      });

      res.json({ success: true, request_id: Number(req.params.requestId), action });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = { createAdminRouter };
