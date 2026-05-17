/**
 * [MISC SERVICE]
 * Business logic & Database queries for Pricing, Payment Receivers, and Activity Logs
 */
const miscService = {
  // --- PRICING ---
  async getPriceConfigs(pool) {
    const result = await pool.query(
      'SELECT config_id, start_hour, end_hour, price_per_hour, is_weekend FROM public.price_configs ORDER BY start_hour ASC'
    );
    return result.rows;
  },

  async updatePriceConfig(pool, id, { pricePerHour }) {
    const result = await pool.query(
      'UPDATE public.price_configs SET price_per_hour = $1 WHERE config_id = $2 RETURNING *',
      [pricePerHour, id]
    );
    return result.rows[0];
  },

  // --- PAYMENT RECEIVERS ---
  async getPaymentReceivers(pool) {
    const result = await pool.query(
      `SELECT receiver_id, display_name, bank_name, bank_code, account_name, account_number, qr_code_url, is_active 
       FROM public.payment_receivers 
       ORDER BY sort_order ASC, receiver_id ASC`
    );
    return result.rows;
  },

  async updatePaymentReceiver(pool, id, { display_name, bank_name, bank_code, account_name, account_number, qr_code_url, is_active }) {
    const result = await pool.query(
      `UPDATE public.payment_receivers
       SET display_name = COALESCE($1, display_name),
           bank_name = COALESCE($2, bank_name),
           bank_code = COALESCE($3, bank_code),
           account_name = COALESCE($4, account_name),
           account_number = COALESCE($5, account_number),
           qr_code_url = COALESCE($6, qr_code_url),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE receiver_id = $8
       RETURNING *`,
      [display_name, bank_name, bank_code, account_name, account_number, qr_code_url, is_active, id]
    );
    return result.rows[0];
  },

  // --- ACTIVITY LOGS ---
  async getActivityLogs(pool, { staffId = null, limit = 100 }) {
    let query = `
      SELECT al.log_id, al.action_type, al.description, al.ip_address, al.created_at,
             s.username AS staff_username, s.full_name AS staff_full_name
      FROM public.activity_logs al
      LEFT JOIN public.staff s ON s.staff_id = al.staff_id
    `;
    const params = [];
    if (staffId) {
      params.push(staffId);
      query += ` WHERE al.staff_id = $1`;
    }
    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;
  }
};

module.exports = miscService;
