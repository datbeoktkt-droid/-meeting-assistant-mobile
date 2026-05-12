/**
 * [REPORT SERVICE]
 */
const { resolveDateFilter, resolveMonthFilter, toNumber } = require('../utils/common');

const reportService = {
  async getOverview(pool, { period = 'day', date, month }) {
    let clause;
    let label;
    let params = [];

    if (period === 'day') {
      label = resolveDateFilter(date);
      clause = `created_at::date = $1::date`;
      params = [label];
    } else if (period === 'month') {
      label = resolveMonthFilter(month);
      clause = `TO_CHAR(created_at, 'YYYY-MM') = $1`;
      params = [label];
    } else if (period === 'week') {
      label = resolveDateFilter(date);
      clause = `DATE_TRUNC('week', created_at) = DATE_TRUNC('week', $1::date)`;
      params = [label];
    } else {
      throw new Error('period chi ho tro day, week, month');
    }

    const ordersResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM public.orders WHERE status = 'DONE' AND ${clause}`,
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
       FROM public.deposit_transactions WHERE ${clause}`,
      params
    );

    return {
      period,
      label,
      cafe_revenue: toNumber(ordersResult.rows[0].total),
      billiard_revenue: toNumber(billiardResult.rows[0].total),
      total_deposits: toNumber(depositsResult.rows[0].total),
      total_revenue: toNumber(ordersResult.rows[0].total) + toNumber(billiardResult.rows[0].total),
    };
  },

  async getTopProducts(pool, { date }) {
    const resolvedDate = resolveDateFilter(date);
    const result = await pool.query(
      `SELECT p.product_id, p.product_name,
              SUM(od.quantity) AS total_quantity,
              SUM(od.quantity * od.unit_price) AS total_revenue
       FROM public.order_details od
       JOIN public.orders o ON o.order_id = od.order_id
       JOIN public.products p ON p.product_id = od.product_id
       WHERE o.status = 'DONE' AND o.created_at::date = $1::date
       GROUP BY p.product_id, p.product_name
       ORDER BY total_quantity DESC, total_revenue DESC
       LIMIT 10`,
      [resolvedDate]
    );
    return {
      date: resolvedDate,
      items: result.rows.map(row => ({
        ...row,
        total_quantity: toNumber(row.total_quantity),
        total_revenue: toNumber(row.total_revenue),
      }))
    };
  },

  async getOccupancy(pool, { date }) {
    const resolvedDate = resolveDateFilter(date);
    const tables = await pool.query(
      `SELECT bt.table_id, bt.table_number,
              COUNT(bs.session_id) AS total_sessions,
              COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(bs.end_time, NOW()) - bs.start_time)) / 60.0), 0) AS total_minutes
       FROM public.billiard_tables bt
       LEFT JOIN public.billiard_sessions bs ON bs.table_id = bt.table_id AND bs.start_time::date = $1::date
       GROUP BY bt.table_id, bt.table_number
       ORDER BY total_minutes DESC`,
      [resolvedDate]
    );

    const hours = await pool.query(
      `SELECT EXTRACT(HOUR FROM start_time)::int AS hour_slot, COUNT(*) AS total_sessions
       FROM public.billiard_sessions WHERE start_time::date = $1::date
       GROUP BY hour_slot ORDER BY hour_slot ASC`,
      [resolvedDate]
    );

    return {
      date: resolvedDate,
      tables: tables.rows.map(row => ({
        ...row,
        total_sessions: toNumber(row.total_sessions),
        total_minutes: Math.round(toNumber(row.total_minutes)),
      })),
      peak_hours: hours.rows.map(row => ({
        hour_slot: toNumber(row.hour_slot),
        total_sessions: toNumber(row.total_sessions),
      }))
    };
  },

  async getSystemBalance(pool) {
    const result = await pool.query(
      `SELECT COALESCE(SUM(wallet_balance), 0) AS total_wallet_balance, COUNT(*) AS total_users
       FROM public.users`
    );
    return {
      total_wallet_balance: toNumber(result.rows[0].total_wallet_balance),
      total_users: toNumber(result.rows[0].total_users),
    };
  }
};

module.exports = reportService;
