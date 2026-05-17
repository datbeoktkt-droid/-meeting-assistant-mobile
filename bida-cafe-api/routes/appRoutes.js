const express = require('express');
const { requireUserAuth } = require('../middlewares/authMiddleware');
const {
  signToken,
  verifyPassword,
  hashPassword,
  createRefreshToken,
  hashSha256,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
} = require('../services/authService');
const { getUserMembership } = require('../services/membershipService');
const { getCurrentPricePerHour } = require('../services/pricingService');
const { calculateDiscountAmount, parseDateTime, toNumber } = require('../utils/common');

function sanitizeUser(user) {
  return {
    user_id: user.user_id,
    phone: user.phone,
    full_name: user.full_name,
    wallet_balance: user.wallet_balance,
    total_deposited: user.total_deposited,
    rank_id: user.rank_id,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}

function createAppRouter({ pool, notificationHub }) {
  const router = express.Router();

  // [LENH CHOT]: GOI NHAN VIEN - KHONG CAN AUTH DE TRANH LOI 404
  router.post('/request-staff-checkout', async (req, res) => {
    console.log('[DEBUG] Server nhan duoc tin hieu GOI NHAN VIEN');
    const { tableNumber, userName } = req.body;
    console.log('[DEBUG] --- BAT DAU GUI TIN NHAN DEN ADMIN ---');
    notificationHub.broadcast('checkout:requested', {
      table_number: tableNumber || '?',
      user_name: userName || 'Khach hang',
      at: new Date()
    });
    console.log('[DEBUG] --- DA GUI TIN NHAN XONG ---');
    res.json({ success: true });
  });

  router.post('/auth/register', async (req, res) => {
    const { phone, fullName = null, pin, avatarUrl = null } = req.body;
    const client = await pool.connect();

    try {
      if (!phone || !pin || String(pin).length < 4) {
        throw new Error('Thieu phone hoac pin khong hop le');
      }

      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT user_id FROM public.users WHERE phone = $1',
        [phone]
      );

      if (existing.rowCount > 0) {
        throw new Error('So dien thoai da ton tai');
      }

      const pinHash = await hashPassword(String(pin));
      const result = await client.query(
        `INSERT INTO public.users (phone, full_name, pin_hash, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, phone, full_name, wallet_balance, total_deposited, rank_id, avatar_url, created_at`,
        [phone, fullName, pinHash, avatarUrl]
      );

      await client.query('COMMIT');
      res.json({ success: true, user: sanitizeUser(result.rows[0]) });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.post('/auth/login', async (req, res) => {
    console.log('[TEST] CO NGUOI DANG NHAP');
    const { phone, pin, deviceName = null } = req.body;

    try {
      if (!phone || !pin) {
        throw new Error('Thieu phone hoac pin');
      }

      const userResult = await pool.query(
        `SELECT user_id, phone, full_name, wallet_balance, total_deposited, rank_id, pin_hash, avatar_url, created_at
         FROM public.users
         WHERE phone = $1`,
        [phone]
      );

      if (userResult.rowCount === 0) {
        throw new Error('So dien thoai hoac PIN khong dung');
      }

      const user = userResult.rows[0];
      const passwordCheck = await verifyPassword(String(pin), user.pin_hash);
      if (!passwordCheck.match) {
        throw new Error('So dien thoai hoac PIN khong dung');
      }

      if (passwordCheck.needsUpgrade) {
        const nextHash = await hashPassword(String(pin));
        await pool.query(
          'UPDATE public.users SET pin_hash = $1 WHERE user_id = $2',
          [nextHash, user.user_id]
        );
      }

      const accessToken = signToken(
        {
          user_id: user.user_id,
          phone: user.phone,
          full_name: user.full_name,
          type: 'user_access',
        },
        ACCESS_TOKEN_TTL
      );
      const refreshToken = createRefreshToken();

      await pool.query(
        `INSERT INTO public.user_auth_refresh_tokens (user_id, token_hash, expires_at, device_name, user_agent)
         VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval, $4, $5)`,
        [user.user_id, hashSha256(refreshToken), String(REFRESH_TOKEN_TTL), deviceName, req.headers['user-agent'] || null]
      );

      res.json({
        success: true,
        access_token: accessToken,
        access_token_expires_in: ACCESS_TOKEN_TTL,
        refresh_token: refreshToken,
        refresh_token_expires_in: REFRESH_TOKEN_TTL,
        user: sanitizeUser(user),
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  router.post('/auth/refresh', async (req, res) => {
    const { refreshToken, deviceName = null } = req.body;

    try {
      if (!refreshToken) {
        throw new Error('Thieu refreshToken');
      }

      const tokenResult = await pool.query(
        `SELECT rt.refresh_id, rt.user_id, rt.expires_at, rt.revoked_at,
                u.phone, u.full_name
         FROM public.user_auth_refresh_tokens rt
         JOIN public.users u ON u.user_id = rt.user_id
         WHERE rt.token_hash = $1`,
        [hashSha256(refreshToken)]
      );

      if (tokenResult.rowCount === 0) {
        throw new Error('Refresh token khong hop le');
      }

      const tokenRow = tokenResult.rows[0];
      if (tokenRow.revoked_at) {
        throw new Error('Refresh token da bi thu hoi');
      }
      if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
        throw new Error('Refresh token da het han');
      }

      const nextAccessToken = signToken(
        {
          user_id: tokenRow.user_id,
          phone: tokenRow.phone,
          full_name: tokenRow.full_name,
          type: 'user_access',
        },
        ACCESS_TOKEN_TTL
      );
      const nextRefreshToken = createRefreshToken();

      await pool.query('BEGIN');
      await pool.query(
        `UPDATE public.user_auth_refresh_tokens
         SET revoked_at = NOW(), last_used_at = NOW()
         WHERE refresh_id = $1`,
        [tokenRow.refresh_id]
      );
      await pool.query(
        `INSERT INTO public.user_auth_refresh_tokens (user_id, token_hash, expires_at, device_name, user_agent)
         VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval, $4, $5)`,
        [tokenRow.user_id, hashSha256(nextRefreshToken), String(REFRESH_TOKEN_TTL), deviceName, req.headers['user-agent'] || null]
      );
      await pool.query('COMMIT');

      res.json({
        success: true,
        access_token: nextAccessToken,
        access_token_expires_in: ACCESS_TOKEN_TTL,
        refresh_token: nextRefreshToken,
        refresh_token_expires_in: REFRESH_TOKEN_TTL,
      });
    } catch (error) {
      try { await pool.query('ROLLBACK'); } catch (e) {}
      res.status(401).json({ error: error.message });
    }
  });

  router.post('/auth/logout', requireUserAuth, async (req, res) => {
    const { refreshToken = null, logoutAll = false } = req.body || {};

    try {
      if (logoutAll) {
        await pool.query(
          `UPDATE public.user_auth_refresh_tokens
           SET revoked_at = NOW(), last_used_at = NOW()
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [req.userAuth.user_id]
        );
      } else if (refreshToken) {
        await pool.query(
          `UPDATE public.user_auth_refresh_tokens
           SET revoked_at = NOW(), last_used_at = NOW()
           WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
          [req.userAuth.user_id, hashSha256(refreshToken)]
        );
      }

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/me', requireUserAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT user_id, phone, full_name, wallet_balance, total_deposited, rank_id, avatar_url, created_at
         FROM public.users
         WHERE user_id = $1`,
        [req.userAuth.user_id]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay user');
      }

      res.json(sanitizeUser(result.rows[0]));
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.patch('/me', requireUserAuth, async (req, res) => {
    try {
      const { fullName = null, avatarUrl = null } = req.body;
      const result = await pool.query(
        `UPDATE public.users
         SET full_name = COALESCE($1, full_name),
             avatar_url = COALESCE($2, avatar_url)
         WHERE user_id = $3
         RETURNING user_id, phone, full_name, wallet_balance, total_deposited, rank_id, avatar_url, created_at`,
        [fullName, avatarUrl, req.userAuth.user_id]
      );

      if (result.rowCount === 0) {
        throw new Error('Khong tim thay user');
      }

      res.json({ success: true, user: sanitizeUser(result.rows[0]) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/change-pin', requireUserAuth, async (req, res) => {
    const { currentPin, newPin } = req.body;

    try {
      if (!currentPin || !newPin || String(newPin).length < 4) {
        throw new Error('PIN moi phai co it nhat 4 ky tu');
      }

      const result = await pool.query(
        'SELECT pin_hash FROM public.users WHERE user_id = $1',
        [req.userAuth.user_id]
      );

      const check = await verifyPassword(String(currentPin), result.rows[0].pin_hash);
      if (!check.match) {
        throw new Error('PIN hien tai khong dung');
      }

      const nextHash = await hashPassword(String(newPin));
      await pool.query(
        'UPDATE public.users SET pin_hash = $1 WHERE user_id = $2',
        [nextHash, req.userAuth.user_id]
      );
      await pool.query(
        `UPDATE public.user_auth_refresh_tokens
         SET revoked_at = NOW(), last_used_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [req.userAuth.user_id]
      );

      res.json({ success: true, message: 'Da doi PIN. Vui long dang nhap lai.' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/menu', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT product_id, product_name, category, price, image_url, stock_quantity, is_available
         FROM public.products
         WHERE is_available = true
         ORDER BY category ASC, product_id ASC`
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/tables', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT bt.table_id, bt.table_number, bt.is_vip, bt.status, bt.qr_code_path,
                active.session_id AS active_session_id,
                active.user_id AS active_user_id,
                reserved.booking_id AS reserved_booking_id,
                reserved.booking_start AS reserved_booking_start
         FROM public.billiard_tables bt
         LEFT JOIN LATERAL (
           SELECT s.session_id, s.user_id
           FROM public.billiard_sessions s
           WHERE s.table_id = bt.table_id 
             AND s.status = 'ACTIVE' 
             AND bt.status = 'OCCUPIED'
           LIMIT 1
         ) active ON TRUE
         LEFT JOIN LATERAL (
           SELECT b.booking_id, b.booking_start
           FROM public.table_bookings b
           WHERE b.table_id = bt.table_id 
             AND b.status IN ('PENDING', 'RESERVED', 'CHECKED_IN')
           ORDER BY b.booking_start ASC
           LIMIT 1
         ) reserved ON TRUE
         ORDER BY bt.table_number ASC`
      );

      res.json(result.rows.map((row) => ({
        table_id: row.table_id,
        table_number: row.table_number,
        is_vip: row.is_vip,
        status: row.status,
        qr_code_path: row.qr_code_path,
        active_session_id: row.active_session_id,
        active_user_id: row.active_user_id,
        reserved_booking_id: row.reserved_booking_id,
        reserved_booking_start: row.reserved_booking_start,
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/tables/:tableId', async (req, res) => {
    const client = await pool.connect();
    try {
      const tableResult = await client.query(
        `SELECT table_id, table_number, is_vip, status, qr_code_path
         FROM public.billiard_tables
         WHERE table_id = $1`,
        [req.params.tableId]
      );

      if (tableResult.rowCount === 0) {
        throw new Error('Khong tim thay ban');
      }

      const table = tableResult.rows[0];
      const activeSessionResult = await client.query(
        `SELECT session_id, user_id, start_time, status
         FROM public.billiard_sessions
         WHERE table_id = $1 AND status = 'ACTIVE' AND $2 = 'OCCUPIED'
         LIMIT 1`,
        [req.params.tableId, table.status]
      );
      const upcomingBookingResult = await client.query(
        `SELECT booking_id, user_id, customer_name, customer_phone, booking_start, booking_end, status
         FROM public.table_bookings
         WHERE table_id = $1 AND status IN ('PENDING', 'RESERVED', 'CHECKED_IN')
         ORDER BY booking_start ASC
         LIMIT 1`,
        [req.params.tableId]
      );

      res.json({
        ...table,
        active_session: activeSessionResult.rowCount > 0 ? activeSessionResult.rows[0] : null,
        upcoming_booking: upcomingBookingResult.rowCount > 0 ? upcomingBookingResult.rows[0] : null,
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.get('/membership', requireUserAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const member = await getUserMembership(client, req.userAuth.user_id);
      const nextRank = await client.query(
        `SELECT rank_id, rank_name, min_deposit_threshold, discount_billiard_pct, discount_cafe_pct, rank_icon_url
         FROM public.membership_ranks
         WHERE min_deposit_threshold > $1::numeric
         ORDER BY min_deposit_threshold ASC
         LIMIT 1`,
        [member.total_deposited]
      );

      res.json({
        user_id: member.user_id,
        full_name: member.full_name,
        wallet_balance: member.wallet_balance,
        total_deposited: member.total_deposited,
        current_rank: {
          rank_id: member.rank_id,
          rank_name: member.rank_name,
          discount_billiard_pct: member.discount_billiard_pct,
          discount_cafe_pct: member.discount_cafe_pct,
          rank_icon_url: member.rank_icon_url,
        },
        next_rank: nextRank.rowCount > 0 ? nextRank.rows[0] : null,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.get('/wallet', requireUserAuth, async (req, res) => {
    try {
      const balanceResult = await pool.query(
        `SELECT wallet_balance, total_deposited
         FROM public.users
         WHERE user_id = $1`,
        [req.userAuth.user_id]
      );
      const depositsResult = await pool.query(
        `SELECT deposit_id, amount, payment_method, reference_code, created_at
         FROM public.deposit_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [req.userAuth.user_id]
      );

      res.json({
        wallet_balance: toNumber(balanceResult.rows[0].wallet_balance),
        total_deposited: toNumber(balanceResult.rows[0].total_deposited),
        recent_deposits: depositsResult.rows.map((row) => ({
          deposit_id: row.deposit_id,
          amount: toNumber(row.amount),
          payment_method: row.payment_method,
          reference_code: row.reference_code,
          created_at: row.created_at,
        })),
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/topup-requests', requireUserAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT request_id, amount, payment_method, note, status, reject_reason, reviewed_at, created_at
         FROM public.wallet_topup_requests
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.userAuth.user_id]
      );

      res.json(result.rows.map((row) => ({
        ...row,
        amount: toNumber(row.amount),
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/topup-requests', requireUserAuth, async (req, res) => {
    try {
      const { amount, paymentMethod = 'BANK_TRANSFER', note = null } = req.body;
      if (!amount || Number(amount) <= 0) {
        throw new Error('So tien nap khong hop le');
      }

      const result = await pool.query(
        `INSERT INTO public.wallet_topup_requests (user_id, amount, payment_method, note)
         VALUES ($1, $2, $3, $4)
         RETURNING request_id, user_id, amount, payment_method, note, status, created_at`,
        [req.userAuth.user_id, amount, paymentMethod, note]
      );

      notificationHub.broadcast('topup:new_request', {
        request_id: result.rows[0].request_id,
        user_id: req.userAuth.user_id,
        amount: toNumber(result.rows[0].amount),
        payment_method: result.rows[0].payment_method,
      });

      res.json({ success: true, request: { ...result.rows[0], amount: toNumber(result.rows[0].amount) } });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/history', requireUserAuth, async (req, res) => {
    try {
      const sessionsResult = await pool.query(
        `SELECT session_id, total_amount AS billiard_total, end_time AS created_at
         FROM public.billiard_sessions
         WHERE user_id = $1 AND status = 'COMPLETED'`,
        [req.userAuth.user_id]
      );

      const ordersResult = await pool.query(
        `SELECT order_id, session_id, total_amount, order_type, status, created_at
         FROM public.orders
         WHERE user_id = $1`,
        [req.userAuth.user_id]
      );

      const history = [];

      for (const o of ordersResult.rows) {
        if (!o.session_id) {
          history.push({
            order_id: o.order_id,
            session_id: null,
            total_amount: toNumber(o.total_amount),
            order_type: o.order_type,
            status: o.status,
            created_at: o.created_at
          });
        }
      }

      for (const s of sessionsResult.rows) {
        const sessionOrders = ordersResult.rows.filter(o => o.session_id === s.session_id);
        const cafeTotal = sessionOrders.reduce((sum, o) => sum + toNumber(o.total_amount), 0);
        const grandTotal = toNumber(s.billiard_total) + cafeTotal;
        
        history.push({
          order_id: -s.session_id,
          session_id: s.session_id,
          total_amount: grandTotal,
          order_type: 'BILLIARD',
          status: 'DONE',
          created_at: s.created_at
        });
      }

      history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/history/:orderId', requireUserAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId, 10);
      
      if (orderId < 0) {
        const sessionId = -orderId;
        const sessionResult = await pool.query(
          `SELECT session_id, total_amount, start_time, end_time, status
           FROM public.billiard_sessions
           WHERE session_id = $1 AND user_id = $2`,
          [sessionId, req.userAuth.user_id]
        );
        
        if (sessionResult.rowCount === 0) throw new Error('Khong tim thay hoa don');
        const session = sessionResult.rows[0];
        
        const cafeDetailsResult = await pool.query(
          `SELECT od.detail_id, od.product_id, p.product_name, od.quantity, od.unit_price
           FROM public.order_details od
           JOIN public.products p ON p.product_id = od.product_id
           JOIN public.orders o ON o.order_id = od.order_id
           WHERE o.session_id = $1`,
          [sessionId]
        );

        let items = [];
        const billiardTotal = toNumber(session.total_amount);
        
        items.push({
          detail_id: -1,
          product_id: 0,
          product_name: 'Tiền giờ chơi Bida',
          quantity: 1,
          unit_price: billiardTotal,
          line_total: billiardTotal
        });

        const cafeItems = cafeDetailsResult.rows.map((row) => ({
          detail_id: row.detail_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: toNumber(row.quantity),
          unit_price: toNumber(row.unit_price),
          line_total: Math.round(toNumber(row.quantity) * toNumber(row.unit_price)),
        }));
        
        items = items.concat(cafeItems);
        const grandTotal = items.reduce((sum, item) => sum + item.line_total, 0);

        res.json({
          order_id: orderId,
          user_id: req.userAuth.user_id,
          session_id: sessionId,
          total_amount: grandTotal,
          order_type: 'BILLIARD',
          status: 'DONE',
          created_at: session.end_time,
          items: items
        });
      } else {
        const orderResult = await pool.query(
          `SELECT order_id, user_id, session_id, total_amount, order_type, status, created_at
           FROM public.orders
           WHERE order_id = $1 AND user_id = $2`,
          [orderId, req.userAuth.user_id]
        );

        if (orderResult.rowCount === 0) {
          throw new Error('Khong tim thay don hang');
        }

        const detailResult = await pool.query(
          `SELECT od.detail_id, od.product_id, p.product_name, od.quantity, od.unit_price
           FROM public.order_details od
           JOIN public.products p ON p.product_id = od.product_id
           WHERE od.order_id = $1
           ORDER BY od.detail_id ASC`,
          [orderId]
        );

        res.json({
          ...orderResult.rows[0],
          total_amount: toNumber(orderResult.rows[0].total_amount),
          items: detailResult.rows.map((row) => ({
            detail_id: row.detail_id,
            product_id: row.product_id,
            product_name: row.product_name,
            quantity: toNumber(row.quantity),
            unit_price: toNumber(row.unit_price),
            line_total: Math.round(toNumber(row.quantity) * toNumber(row.unit_price)),
          })),
        });
      }
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.get('/sessions/active', requireUserAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const sessionResult = await client.query(
        `SELECT s.session_id, s.table_id, s.start_time, s.status, bt.table_number, bt.is_vip
         FROM public.billiard_sessions s
         JOIN public.billiard_tables bt ON bt.table_id = s.table_id
         WHERE s.user_id = $1 AND s.status = 'ACTIVE' AND bt.status = 'OCCUPIED'
         ORDER BY s.start_time DESC
         LIMIT 1`,
        [req.userAuth.user_id]
      );

      if (sessionResult.rowCount === 0) {
        return res.json({ active_session: null });
      }

      const session = sessionResult.rows[0];
      const member = await getUserMembership(client, req.userAuth.user_id);
      const pricePerHour = await getCurrentPricePerHour(client);
      const minutes = Math.ceil((Date.now() - new Date(session.start_time).getTime()) / 60000);
      const billiardSubtotal = Math.round((minutes / 60) * pricePerHour);
      const discountPct = toNumber(member.discount_billiard_pct);
      const billiardDiscountAmount = calculateDiscountAmount(billiardSubtotal, discountPct);
      const billiardTotal = billiardSubtotal - billiardDiscountAmount;

      const ordersResult = await client.query(
        `SELECT o.order_id, o.total_amount, o.created_at, o.status,
                COALESCE(SUM(od.quantity * od.unit_price), 0) as calculated_subtotal,
                json_agg(json_build_object(
                  'product_name', p.product_name,
                  'quantity', od.quantity,
                  'unit_price', od.unit_price,
                  'line_total', (od.quantity * od.unit_price)
                )) FILTER (WHERE od.detail_id IS NOT NULL) as items
         FROM public.orders o
         LEFT JOIN public.order_details od ON od.order_id = o.order_id
         LEFT JOIN public.products p ON p.product_id = od.product_id
         WHERE o.session_id = $1 AND o.status != 'CANCELLED'
         GROUP BY o.order_id, o.total_amount, o.created_at, o.status
         ORDER BY o.created_at ASC`,
        [session.session_id]
      );

      const cafeItems = ordersResult.rows.map(row => ({
        order_id: row.order_id,
        subtotal: toNumber(row.calculated_subtotal),
        total: toNumber(row.total_amount),
        status: row.status,
        created_at: row.created_at,
        items: row.items || []
      }));

      // Only sum items that are NOT DONE and NOT CANCELLED for the final grandTotal
      const cafeTotal = cafeItems
        .filter(item => item.status !== 'DONE' && item.status !== 'CANCELLED')
        .reduce((sum, item) => sum + item.total, 0);
      const grandTotal = billiardTotal + cafeTotal;

      res.json({
        active_session: {
          session_id: session.session_id,
          table_id: session.table_id,
          table_number: session.table_number,
          is_vip: session.is_vip,
          start_time: session.start_time,
          status: session.status,
          minutes: Number(minutes),
          price_per_hour: Number(pricePerHour),
          // Send multiple variants of keys to be 100% sure the app catches it
          billiard_subtotal: Number(billiardSubtotal),
          subtotal_billiard: Number(billiardSubtotal),
          billiardSubtotal: Number(billiardSubtotal),
          
          discount_pct: Number(discountPct),
          discount_amount: Number(billiardDiscountAmount),
          billiard_discount: Number(billiardDiscountAmount),
          
          billiard_total: Number(billiardTotal),
          total_billiard: Number(billiardTotal),
          
          cafe_items: cafeItems || [],
          cafe_total: Number(cafeTotal),
          
          estimated_total: Number(grandTotal),
          grand_total: Number(grandTotal),
          total_amount: Number(grandTotal)
        },
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.post('/sessions/active/checkout', requireUserAuth, async (req, res) => {
    const { paymentMethod = 'WALLET' } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const sessionResult = await client.query(
        `SELECT s.session_id, s.table_id, s.start_time
         FROM public.billiard_sessions s
         JOIN public.billiard_tables bt ON bt.table_id = s.table_id
         WHERE s.user_id = $1 AND s.status = 'ACTIVE' AND bt.status = 'OCCUPIED'
         LIMIT 1`,
        [req.userAuth.user_id]
      );

      if (sessionResult.rowCount === 0) {
        throw new Error('Khong tim thay phien choi dang hoat dong');
      }

      const { session_id: sessionId, table_id: tableId, start_time: startTime } = sessionResult.rows[0];
      const member = await getUserMembership(client, req.userAuth.user_id);
      const pricePerHour = await getCurrentPricePerHour(client);
      const diffMs = new Date() - new Date(startTime);
      const minutes = Math.ceil(diffMs / 60000);
      const billiardSubtotal = Math.round((minutes / 60) * pricePerHour);
      const discountPct = toNumber(member.discount_billiard_pct);
      const discountAmount = calculateDiscountAmount(billiardSubtotal, discountPct);
      const billiardTotal = billiardSubtotal - discountAmount;

      const ordersResult = await client.query(
        `SELECT o.order_id, o.total_amount, 
                COALESCE(SUM(od.quantity * od.unit_price), 0) as subtotal
         FROM public.orders o
         LEFT JOIN public.order_details od ON od.order_id = o.order_id
         WHERE o.session_id = $1 AND o.status = 'PENDING_PAYMENT'
         GROUP BY o.order_id, o.total_amount`,
        [sessionId]
      );
      
      const cafeTotal = ordersResult.rows.reduce((sum, row) => sum + toNumber(row.total_amount), 0);
      const cafeSubtotal = ordersResult.rows.reduce((sum, row) => sum + toNumber(row.subtotal), 0);
      const cafeDiscountAmount = Math.max(0, cafeSubtotal - cafeTotal);
      
      const grandTotal = billiardTotal + cafeTotal;

      let newWalletBalance = null;

      if (paymentMethod === 'WALLET') {
        const walletResult = await client.query(
          `UPDATE public.users
           SET wallet_balance = wallet_balance - $1::numeric
           WHERE user_id = $2 AND wallet_balance >= $1::numeric
           RETURNING wallet_balance`,
          [grandTotal, req.userAuth.user_id]
        );

        if (walletResult.rowCount === 0) {
          throw new Error('Vi khong du tien de thanh toan ban va do uong');
        }
        newWalletBalance = walletResult.rows[0].wallet_balance;
      }

      await client.query(
        'UPDATE public.billiard_sessions SET end_time = NOW(), total_amount = $1::numeric, status = $2 WHERE session_id = $3',
        [billiardTotal, 'COMPLETED', sessionId]
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
         WHERE session_id = $1
           AND order_type = 'CAFE'
           AND status != 'DONE'
           AND status != 'CANCELLED'`,
        [sessionId]
      );

      await client.query('COMMIT');

      notificationHub.broadcast('session:completed', {
        session_id: sessionId,
        table_id: tableId,
        user_id: req.userAuth.user_id,
        total_minutes: minutes,
        billiard_total: billiardTotal,
        cafe_total: cafeTotal,
        grand_total: grandTotal,
        payment_method: paymentMethod
      });
      notificationHub.broadcast('table:cleaning', {
        table_id: Number(tableId),
        status: 'CLEANING',
      });

      res.json({
        success: true,
        rank: member.rank_name,
        billiard: {
          minutes,
          subtotal: billiardSubtotal,
          discount_pct: discountPct,
          discount_amount: discountAmount,
          total: billiardTotal,
        },
        cafe: {
          subtotal: cafeSubtotal,
          discount_amount: cafeDiscountAmount,
          total: cafeTotal,
        },
        grand_total: grandTotal,
        payment_method: paymentMethod,
        balance: newWalletBalance,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  router.get('/bookings', requireUserAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT tb.*, bt.table_number
         FROM public.table_bookings tb
         JOIN public.billiard_tables bt ON bt.table_id = tb.table_id
         WHERE tb.user_id = $1
         ORDER BY tb.booking_start DESC`,
        [req.userAuth.user_id]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/bookings', requireUserAuth, async (req, res) => {
    const {
      tableId,
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
      const meResult = await client.query(
        `SELECT full_name, phone
         FROM public.users
         WHERE user_id = $1`,
        [req.userAuth.user_id]
      );

      await client.query('BEGIN');
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

      const bookingResult = await client.query(
        `INSERT INTO public.table_bookings (
           table_id, user_id, customer_name, customer_phone, booking_start, booking_end, status, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
         RETURNING *`,
        [tableId, req.userAuth.user_id, meResult.rows[0].full_name, meResult.rows[0].phone, startAt, endAt, notes]
      );
      await client.query('COMMIT');

      notificationHub.broadcast('booking:new', {
        booking_id: bookingResult.rows[0].booking_id,
        table_id: bookingResult.rows[0].table_id,
        user_id: req.userAuth.user_id,
      });

      res.json({ success: true, booking: bookingResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.patch('/bookings/:bookingId/extend', requireUserAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const extraMinutes = Math.max(15, Number(req.body?.extraMinutes) || 0);
      if (!extraMinutes) {
        throw new Error('Thieu extraMinutes hop le');
      }

      await client.query('BEGIN');
      const bookingResult = await client.query(
        `SELECT booking_id, table_id, booking_start, booking_end, status
         FROM public.table_bookings
         WHERE booking_id = $1 AND user_id = $2
           AND status IN ('PENDING', 'RESERVED', 'CHECKED_IN')
         LIMIT 1`,
        [req.params.bookingId, req.userAuth.user_id]
      );

      if (bookingResult.rowCount === 0) {
        throw new Error('Booking khong ton tai hoac khong the gia han');
      }

      const booking = bookingResult.rows[0];
      const nextEndAt = new Date(
        new Date(booking.booking_end).getTime() + extraMinutes * 60000
      );

      const overlapResult = await client.query(
        `SELECT booking_id
         FROM public.table_bookings
         WHERE table_id = $1
           AND booking_id <> $2
           AND status IN ('PENDING', 'RESERVED', 'CHECKED_IN')
           AND NOT ($4::timestamp <= booking_start OR $3::timestamp >= booking_end)
         LIMIT 1`,
        [booking.table_id, booking.booking_id, booking.booking_end, nextEndAt]
      );

      if (overlapResult.rowCount > 0) {
        throw new Error('Khong the gia han vi trung lich dat tiep theo');
      }

      const updatedResult = await client.query(
        `UPDATE public.table_bookings
         SET booking_end = $1
         WHERE booking_id = $2
         RETURNING *`,
        [nextEndAt, booking.booking_id]
      );

      await client.query('COMMIT');
      notificationHub.broadcast('booking:extended', {
        booking_id: booking.booking_id,
        table_id: booking.table_id,
        user_id: req.userAuth.user_id,
        booking_end: nextEndAt,
      });

      res.json({ success: true, booking: updatedResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.patch('/bookings/:bookingId/cancel', requireUserAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE public.table_bookings
         SET status = 'CANCELLED', cancelled_at = NOW()
         WHERE booking_id = $1
           AND user_id = $2
           AND status IN ('PENDING', 'RESERVED')
         RETURNING *`,
        [req.params.bookingId, req.userAuth.user_id]
      );

      if (result.rowCount === 0) {
        throw new Error('Booking khong the huy');
      }

      await client.query(
        `UPDATE public.billiard_tables
         SET status = 'AVAILABLE'
         WHERE table_id = $1 AND status = 'RESERVED'`,
        [result.rows[0].table_id]
      );
      await client.query('COMMIT');

      res.json({ success: true, booking: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.post('/orders', requireUserAuth, async (req, res) => {
    const { productId, quantity, paymentMethod = 'CASH', tableId = null } = req.body;
    const client = await pool.connect();

    try {
      if (!productId || !quantity || Number(quantity) <= 0) {
        throw new Error('Thieu thong tin don hang hop le');
      }

      await client.query('BEGIN');
      const productResult = await client.query(
        'SELECT price, product_name FROM public.products WHERE product_id = $1 AND is_available = true',
        [productId]
      );

      if (productResult.rowCount === 0) {
        throw new Error('San pham khong ton tai');
      }

      const member = await getUserMembership(client, req.userAuth.user_id);
      const unitPrice = toNumber(productResult.rows[0].price);
      const subtotal = Math.round(unitPrice * Number(quantity));
      const discountPct = toNumber(member.discount_cafe_pct);
      const discountAmount = calculateDiscountAmount(subtotal, discountPct);
      const total = subtotal - discountAmount;
      const normalizedPaymentMethod = String(paymentMethod).toUpperCase();
      
      let sessionId = null;
      let orderStatus = 'DONE';
      let balance = null;

      // Tu dong tim session dang hoat dong cho user nay neu khong co tableId
      const sessionQuery = tableId 
        ? [`SELECT session_id FROM public.billiard_sessions WHERE table_id = $1 AND status = 'ACTIVE' LIMIT 1`, [tableId]]
        : [`SELECT session_id FROM public.billiard_sessions WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`, [req.userAuth.user_id]];

      const sessionResult = await client.query(sessionQuery[0], sessionQuery[1]);
      
      if (sessionResult.rowCount > 0) {
        sessionId = sessionResult.rows[0].session_id;
        // Moi don hang trong phien deu la PENDING_PAYMENT de thanh toan khi checkout
        orderStatus = 'PENDING_PAYMENT';
      }

      // Individual payment processing only for walk-in orders (no session)
      if (orderStatus === 'DONE' && !sessionId) {
        if (normalizedPaymentMethod === 'WALLET') {
          const walletResult = await client.query(
            `UPDATE public.users
             SET wallet_balance = wallet_balance - $1::numeric
             WHERE user_id = $2 AND wallet_balance >= $1::numeric
             RETURNING wallet_balance`,
            [total, req.userAuth.user_id]
          );
          if (walletResult.rowCount === 0) {
            throw new Error('Vi khong du tien');
          }
          balance = toNumber(walletResult.rows[0].wallet_balance);
        } else {
          orderStatus = 'PENDING_PAYMENT';
        }
      }

      await client.query(
        `UPDATE public.ingredients i
         SET stock_quantity = i.stock_quantity - (r.quantity_needed * $2)
         FROM public.recipes r
         WHERE r.product_id = $1 AND r.ingredient_id = i.ingredient_id`,
        [productId, quantity]
      );

      const orderResult = await client.query(
        `INSERT INTO public.orders (user_id, session_id, total_amount, order_type, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING order_id`,
        [req.userAuth.user_id, sessionId, total, 'CAFE', orderStatus]
      );

      await client.query(
        `INSERT INTO public.order_details (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [orderResult.rows[0].order_id, productId, quantity, unitPrice]
      );

      await client.query('COMMIT');

      notificationHub.broadcast('order:new', {
        order_id: orderResult.rows[0].order_id,
        user_id: req.userAuth.user_id,
        product_id: productId,
        product_name: productResult.rows[0].product_name,
        quantity: Number(quantity),
        subtotal,
        discount_pct: discountPct,
        discount_amount: discountAmount,
        total,
        payment_method: normalizedPaymentMethod,
        payment_status: orderStatus,
      });

      res.json({
        success: true,
        order_id: orderResult.rows[0].order_id,
        subtotal,
        discount_pct: discountPct,
        discount_amount: discountAmount,
        final_total: total,
        payment_method: normalizedPaymentMethod,
        payment_status: orderStatus,
        balance,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = { createAppRouter };
