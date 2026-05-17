/**
 * [TOPUP SERVICE]
 * Business logic for wallet topup requests
 */
const topupService = {
  async getTopupRequests(pool, { status }) {
    const values = [];
    let query = `
      SELECT tr.*, u.phone, u.full_name 
      FROM public.wallet_topup_requests tr
      JOIN public.users u ON u.user_id = tr.user_id
    `;

    if (status) {
      values.push(status);
      query += ` WHERE tr.status = $${values.length}`;
    }

    query += ' ORDER BY tr.created_at DESC';
    const result = await pool.query(query, values);
    return result.rows;
  },

  async getTopupById(pool, id) {
    const result = await pool.query(
      'SELECT * FROM public.wallet_topup_requests WHERE request_id = $1',
      [id]
    );
    return result.rows[0];
  },

  async reviewRequest(client, id, { status, adminNote, staffId }) {
    // 1. Cap nhat trang thai request
    // Table: wallet_topup_requests
    // Columns: status, reject_reason, reviewed_at, reviewed_by
    const result = await client.query(
      `UPDATE public.wallet_topup_requests
       SET status = $1, reject_reason = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE request_id = $4 AND status = 'PENDING'
       RETURNING *`,
      [status, adminNote, staffId, id]
    );

    if (result.rowCount === 0) return null;
    const request = result.rows[0];

    // 2. Neu duoc duyet (APPROVED), cong tien vao vi user
    if (status === 'APPROVED') {
      await client.query(
        `UPDATE public.users 
         SET wallet_balance = wallet_balance + $1::numeric,
             total_deposited = total_deposited + $1::numeric
         WHERE user_id = $2`,
        [request.amount, request.user_id]
      );

      // Ghi vao lich su giao dich (deposit_transactions)
      // Gia dinh bang deposit_transactions co cac cot: user_id, staff_id, amount, payment_method, reference_code
      await client.query(
        `INSERT INTO public.deposit_transactions (user_id, staff_id, amount, payment_method, reference_code)
         VALUES ($1, $2, $3, $4, $5)`,
        [request.user_id, staffId, request.amount, request.payment_method, `TOPUP_${request.request_id}`]
      );
    }

    return request;
  }
};

module.exports = topupService;
