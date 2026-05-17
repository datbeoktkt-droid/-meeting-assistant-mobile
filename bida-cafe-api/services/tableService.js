/**
 * [TABLE SERVICE]
 */
const { getUserMembership } = require('./membershipService');
const { getCurrentPricePerHour } = require('./pricingService');
const { toNumber, calculateDiscountAmount } = require('../utils/common');

const tableService = {
  async getAllTables(pool) {
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
    return result.rows;
  },

  async getTableInvoiceSummary(pool, tableId) {
    const client = await pool.connect();
    try {
      // 1. Lay thong tin ban
      const tableResult = await client.query(
        'SELECT table_id, table_number, qr_code_path, status FROM public.billiard_tables WHERE table_id = $1',
        [tableId]
      );
      if (tableResult.rowCount === 0) return null;
      const table = tableResult.rows[0];

      // 2. Lay TAT CA session dang hoat dong (De tranh loi zombie session)
      const activeSessionResult = await client.query(
        `SELECT session_id, user_id, start_time, status FROM public.billiard_sessions 
         WHERE table_id = $1 AND status = 'ACTIVE' ORDER BY session_id DESC`,
        [tableId]
      );

      let activeSessionCharge = null;
      let activeCafeItems = [];
      let customerRankName = null;
      let settledItems = [];

      if (activeSessionResult.rowCount > 0) {
        // Dung session moi nhat de tinh tien gio
        const mainSession = activeSessionResult.rows[0];
        const allSessionIds = activeSessionResult.rows.map(s => s.session_id);
        
        const member = await getUserMembership(client, mainSession.user_id);
        customerRankName = member.rank_name;
        
        const pricePerHour = await getCurrentPricePerHour(client);
        const startTime = new Date(mainSession.start_time);
        const minutes = Math.max(1, Math.ceil((Date.now() - startTime.getTime()) / 60000));
        const subtotal = Math.round((minutes / 60) * pricePerHour);
        const discountPct = toNumber(member.discount_billiard_pct);
        const discountAmount = calculateDiscountAmount(subtotal, discountPct);

        activeSessionCharge = {
          session_id: mainSession.session_id,
          user_id: mainSession.user_id,
          start_time: mainSession.start_time,
          minutes,
          subtotal,
          discount_pct: discountPct,
          discount_amount: discountAmount,
          estimated_total: subtotal - discountAmount,
        };

        // 3. Lay tat ca cafe items tu TAT CA session dang hoat dong cua ban nay
        const cafeOrdersResult = await client.query(
          `SELECT o.order_id, o.user_id, o.total_amount, o.order_type, o.status, o.created_at,
                  COALESCE(SUM(od.quantity * od.unit_price), 0) AS subtotal
           FROM public.orders o
           LEFT JOIN public.order_details od ON od.order_id = o.order_id
           WHERE o.session_id = ANY($1::int[]) AND o.status != 'CANCELLED'
           GROUP BY o.order_id, o.user_id, o.total_amount, o.order_type, o.status, o.created_at
           ORDER BY o.created_at DESC`,
          [allSessionIds]
        );

        activeCafeItems = cafeOrdersResult.rows.map(row => {
          const sub = toNumber(row.subtotal);
          const total = toNumber(row.total_amount);
          return {
            ...row,
            subtotal_amount: sub,
            total_amount: total,
            discount_pct: toNumber(member.discount_cafe_pct),
            discount_amount: Math.max(0, sub - total)
          };
        });

        settledItems = [];
      }

      return {
        table,
        customerRankName,
        activeSession: activeSessionCharge,
        activeCafeItems,
        settledItems
      };
    } finally {
      client.release();
    }
  },

  async updateTableStatus(pool, tableId, status) {
    const res = await pool.query(
      'UPDATE public.billiard_tables SET status = $1 WHERE table_id = $2 RETURNING table_id, table_number, status',
      [status, tableId]
    );
    return res.rows[0];
  }
};

module.exports = tableService;
