const express = require('express');
const { resolveDateFilter, resolveMonthFilter, toNumber } = require('../utils/common');

function createDashboardRouter({ pool }) {
  const router = express.Router();

  router.get('/revenue', async (req, res) => {
    try {
      const date = resolveDateFilter(req.query.date);
      const cafeResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM public.orders
         WHERE status = 'DONE'
           AND created_at::date = $1::date`,
        [date]
      );
      const billiardResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM public.billiard_sessions
         WHERE status = 'COMPLETED'
           AND COALESCE(end_time, start_time)::date = $1::date`,
        [date]
      );
      const depositResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM public.deposit_transactions
         WHERE created_at::date = $1::date`,
        [date]
      );

      const cafeRevenue = toNumber(cafeResult.rows[0].total);
      const billiardRevenue = toNumber(billiardResult.rows[0].total);
      const depositTotal = toNumber(depositResult.rows[0].total);

      res.json({
        date,
        cafe_revenue: cafeRevenue,
        billiard_revenue: billiardRevenue,
        total_revenue: cafeRevenue + billiardRevenue,
        total_deposits: depositTotal,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/revenue/month', async (req, res) => {
    try {
      const month = resolveMonthFilter(req.query.month);
      const cafeResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM public.orders
         WHERE status = 'DONE'
           AND TO_CHAR(created_at, 'YYYY-MM') = $1`,
        [month]
      );
      const billiardResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM public.billiard_sessions
         WHERE status = 'COMPLETED'
           AND TO_CHAR(COALESCE(end_time, start_time), 'YYYY-MM') = $1`,
        [month]
      );
      const depositResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM public.deposit_transactions
         WHERE TO_CHAR(created_at, 'YYYY-MM') = $1`,
        [month]
      );

      const cafeRevenue = toNumber(cafeResult.rows[0].total);
      const billiardRevenue = toNumber(billiardResult.rows[0].total);
      const depositTotal = toNumber(depositResult.rows[0].total);

      res.json({
        month,
        cafe_revenue: cafeRevenue,
        billiard_revenue: billiardRevenue,
        total_revenue: cafeRevenue + billiardRevenue,
        total_deposits: depositTotal,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/top-products', async (req, res) => {
    try {
      const date = resolveDateFilter(req.query.date);
      const result = await pool.query(
        `SELECT p.product_id, p.product_name,
                COALESCE(SUM(od.quantity), 0) AS total_quantity,
                COALESCE(SUM(od.quantity * od.unit_price), 0) AS total_revenue
         FROM public.order_details od
         JOIN public.orders o ON o.order_id = od.order_id
         JOIN public.products p ON p.product_id = od.product_id
         WHERE o.status = 'DONE'
           AND o.created_at::date = $1::date
         GROUP BY p.product_id, p.product_name
         ORDER BY total_quantity DESC, total_revenue DESC, p.product_id ASC
         LIMIT 5`,
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
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/table-usage', async (req, res) => {
    try {
      const date = resolveDateFilter(req.query.date);
      const result = await pool.query(
        `SELECT bt.table_id, bt.table_number,
                COUNT(bs.session_id) AS total_sessions,
                COALESCE(SUM(CEIL(EXTRACT(EPOCH FROM (COALESCE(bs.end_time, NOW()) - bs.start_time)) / 60.0)), 0) AS total_minutes,
                COALESCE(SUM(bs.total_amount), 0) AS total_revenue
         FROM public.billiard_tables bt
         LEFT JOIN public.billiard_sessions bs
           ON bs.table_id = bt.table_id
          AND bs.start_time::date = $1::date
         GROUP BY bt.table_id, bt.table_number
         ORDER BY total_minutes DESC, total_sessions DESC, bt.table_number ASC`,
        [date]
      );

      res.json({
        date,
        items: result.rows.map((row) => ({
          table_id: row.table_id,
          table_number: row.table_number,
          total_sessions: toNumber(row.total_sessions),
          total_minutes: toNumber(row.total_minutes),
          total_revenue: toNumber(row.total_revenue),
        })),
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/deposits', async (req, res) => {
    try {
      const date = resolveDateFilter(req.query.date);
      const result = await pool.query(
        `SELECT COUNT(deposit_id) AS total_transactions,
                COALESCE(SUM(amount), 0) AS total_amount
         FROM public.deposit_transactions
         WHERE created_at::date = $1::date`,
        [date]
      );

      res.json({
        date,
        total_transactions: toNumber(result.rows[0].total_transactions),
        total_amount: toNumber(result.rows[0].total_amount),
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createDashboardRouter };
