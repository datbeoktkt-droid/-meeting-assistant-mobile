const express = require('express');
const { requireAuth, requireRoles } = require('../middlewares/authMiddleware');
const { resolveDateFilter, toNumber } = require('../utils/common');
const { writeActivityLog } = require('../services/activityLogService');

const KITCHEN_FLOW = ['PENDING', 'PREPARING', 'DONE', 'SERVED'];
const ACTIVE_KITCHEN_STATUSES = ['PENDING', 'PREPARING', 'DONE'];

function normalizeKitchenStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function getNextKitchenStatus(currentStatus, requestedStatus) {
  const currentIndex = KITCHEN_FLOW.indexOf(currentStatus);
  const requestedIndex = KITCHEN_FLOW.indexOf(requestedStatus);

  if (currentIndex === -1 || requestedIndex === -1) {
    throw new Error('Trang thai khong hop le');
  }

  if (requestedIndex !== currentIndex + 1) {
    throw new Error('Chi duoc chuyen trang thai theo thu tu');
  }

  return KITCHEN_FLOW[requestedIndex];
}

function groupKitchenOrders(rows) {
  const orderMap = new Map();

  for (const row of rows) {
    if (!orderMap.has(row.order_id)) {
      orderMap.set(row.order_id, {
        order_id: row.order_id,
        user_id: row.user_id,
        full_name: row.full_name,
        phone: row.phone,
        session_id: row.session_id,
        table_id: row.table_id,
        table_number: row.table_number,
        order_type: row.order_type,
        payment_status: row.payment_status,
        kitchen_status: row.kitchen_status,
        total_amount: toNumber(row.total_amount),
        created_at: row.created_at,
        items: [],
      });
    }

    if (row.detail_id) {
      orderMap.get(row.order_id).items.push({
        detail_id: row.detail_id,
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        image_url: row.image_url,
        quantity: toNumber(row.quantity),
        unit_price: toNumber(row.unit_price),
        status: row.item_status,
      });
    }
  }

  const grouped = new Map();

  for (const order of orderMap.values()) {
    const key = order.table_id ? `table-${order.table_id}` : 'walk-in';
    if (!grouped.has(key)) {
      grouped.set(key, {
        table_id: order.table_id,
        table_number: order.table_number,
        label: order.table_number ? `Ban ${order.table_number}` : 'Khach le',
        orders: [],
      });
    }

    grouped.get(key).orders.push(order);
  }

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    orders: group.orders.sort((left, right) => new Date(left.created_at) - new Date(right.created_at)),
  }));
}

async function syncOrderKitchenStatus(client, orderId) {
  const aggregateResult = await client.query(
    `SELECT CASE
            WHEN COUNT(*) FILTER (WHERE status = 'PENDING') > 0 THEN 'PENDING'
            WHEN COUNT(*) FILTER (WHERE status = 'PREPARING') > 0 THEN 'PREPARING'
            WHEN COUNT(*) FILTER (WHERE status = 'DONE') > 0 THEN 'DONE'
            ELSE 'SERVED'
          END AS kitchen_status
     FROM public.order_details
     WHERE order_id = $1`,
    [orderId]
  );

  const kitchenStatus = aggregateResult.rows[0]?.kitchen_status || 'SERVED';
  await client.query(
    `UPDATE public.orders
     SET kitchen_status = $1
     WHERE order_id = $2`,
    [kitchenStatus, orderId]
  );

  return kitchenStatus;
}

function createKitchenRouter({ pool, notificationHub }) {
  const router = express.Router();

  router.use(requireAuth);

  router.get('/orders', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    try {
      const date = resolveDateFilter(req.query.date);
      const rawStatus = req.query.status || '';
      const statusList = rawStatus
        ? rawStatus.split(',').map((value) => normalizeKitchenStatus(value)).filter(Boolean)
        : ACTIVE_KITCHEN_STATUSES;

      const invalidStatus = statusList.find((status) => !KITCHEN_FLOW.includes(status));
      if (invalidStatus) {
        throw new Error(`Trang thai khong hop le: ${invalidStatus}`);
      }

      const result = await pool.query(
        `SELECT o.order_id, o.user_id, o.session_id, o.total_amount, o.order_type,
                o.status AS payment_status, o.kitchen_status, o.created_at,
                u.full_name, u.phone,
                bt.table_id, bt.table_number,
                od.detail_id, od.product_id, od.quantity, od.unit_price,
                od.status AS item_status,
                p.product_name, p.category, p.image_url
         FROM public.orders o
         LEFT JOIN public.users u ON u.user_id = o.user_id
         LEFT JOIN public.billiard_sessions bs ON bs.session_id = o.session_id
         LEFT JOIN public.billiard_tables bt ON bt.table_id = bs.table_id
         LEFT JOIN public.order_details od ON od.order_id = o.order_id
         LEFT JOIN public.products p ON p.product_id = od.product_id
         WHERE o.order_type = 'CAFE'
           AND o.created_at::date = $1::date
           AND o.kitchen_status = ANY($2::varchar[])
         ORDER BY COALESCE(bt.table_number, 9999) ASC, o.created_at ASC, o.order_id ASC, od.detail_id ASC`,
        [date, statusList]
      );

      const groups = groupKitchenOrders(result.rows);

      res.json({
        date,
        statuses: statusList,
        total_orders: groups.reduce((sum, group) => sum + group.orders.length, 0),
        groups,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/orders/:orderId/status', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    const client = await pool.connect();
    try {
      const nextStatus = normalizeKitchenStatus(req.body.status);
      await client.query('BEGIN');

      const orderResult = await client.query(
        `SELECT order_id, kitchen_status, order_type
         FROM public.orders
         WHERE order_id = $1
         FOR UPDATE`,
        [req.params.orderId]
      );

      if (orderResult.rowCount === 0) {
        throw new Error('Khong tim thay don hang');
      }

      const order = orderResult.rows[0];
      if (order.order_type !== 'CAFE') {
        throw new Error('Chi ho tro don cafe trong bep');
      }

      const currentStatus = normalizeKitchenStatus(order.kitchen_status || 'PENDING');
      const allowedNextStatus = getNextKitchenStatus(currentStatus, nextStatus);

      await client.query(
        `UPDATE public.orders
         SET kitchen_status = $1
         WHERE order_id = $2`,
        [allowedNextStatus, order.order_id]
      );
      await client.query(
        `UPDATE public.order_details
         SET status = $1
         WHERE order_id = $2`,
        [allowedNextStatus, order.order_id]
      );

      await client.query('COMMIT');

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'KITCHEN_ORDER_STATUS',
        description: `Cap nhat don ${order.order_id} sang ${allowedNextStatus}`,
        ipAddress: req.ip,
      });

      notificationHub.broadcast('kitchen:order_updated', {
        order_id: Number(order.order_id),
        status: allowedNextStatus,
      });

      res.json({ success: true, order_id: Number(order.order_id), status: allowedNextStatus });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  router.patch('/order-items/:detailId/status', requireRoles('ADMIN', 'STAFF', 'BARISTA'), async (req, res) => {
    const client = await pool.connect();
    try {
      const nextStatus = normalizeKitchenStatus(req.body.status);
      await client.query('BEGIN');

      const detailResult = await client.query(
        `SELECT od.detail_id, od.order_id, od.status AS item_status, o.order_type
         FROM public.order_details od
         JOIN public.orders o ON o.order_id = od.order_id
         WHERE od.detail_id = $1
         FOR UPDATE`,
        [req.params.detailId]
      );

      if (detailResult.rowCount === 0) {
        throw new Error('Khong tim thay mon an');
      }

      const detail = detailResult.rows[0];
      if (detail.order_type !== 'CAFE') {
        throw new Error('Chi ho tro mon cafe trong bep');
      }

      const currentStatus = normalizeKitchenStatus(detail.item_status || 'PENDING');
      const allowedNextStatus = getNextKitchenStatus(currentStatus, nextStatus);

      await client.query(
        `UPDATE public.order_details
         SET status = $1
         WHERE detail_id = $2`,
        [allowedNextStatus, detail.detail_id]
      );

      const syncedStatus = await syncOrderKitchenStatus(client, detail.order_id);
      await client.query('COMMIT');

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'KITCHEN_ITEM_STATUS',
        description: `Cap nhat mon ${detail.detail_id} cua don ${detail.order_id} sang ${allowedNextStatus}`,
        ipAddress: req.ip,
      });

      notificationHub.broadcast('kitchen:item_updated', {
        order_id: Number(detail.order_id),
        detail_id: Number(detail.detail_id),
        status: allowedNextStatus,
        order_status: syncedStatus,
      });

      res.json({
        success: true,
        order_id: Number(detail.order_id),
        detail_id: Number(detail.detail_id),
        status: allowedNextStatus,
        order_status: syncedStatus,
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

module.exports = { createKitchenRouter };
