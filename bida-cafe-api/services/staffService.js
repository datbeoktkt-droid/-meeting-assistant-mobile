/**
 * [STAFF SERVICE]
 * Business logic & Database queries for Staff
 */
const { hashPassword } = require('./authService');

const staffService = {
  async getAllStaff(pool) {
    const result = await pool.query(
      `SELECT staff_id, username, full_name, role, is_active, last_login, created_at 
       FROM public.staff ORDER BY created_at DESC`
    );
    return result.rows;
  },

  async getStaffById(pool, id) {
    const result = await pool.query(
      `SELECT staff_id, username, full_name, role, is_active, last_login, created_at 
       FROM public.staff WHERE staff_id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async createStaff(pool, { username, password, fullName, role }) {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO public.staff (username, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING staff_id, username, full_name, role, is_active`,
      [username, passwordHash, fullName, role]
    );
    return result.rows[0];
  },

  async updateStaff(pool, id, { fullName, role }) {
    const result = await pool.query(
      `UPDATE public.staff 
       SET full_name = COALESCE($1, full_name), 
           role = COALESCE($2, role)
       WHERE staff_id = $3
       RETURNING staff_id, username, full_name, role`,
      [fullName, role, id]
    );
    return result.rows[0];
  },

  async setPassword(client, id, newPassword) {
    const passHash = await hashPassword(newPassword);
    const result = await client.query(
      'UPDATE public.staff SET password_hash = $1 WHERE staff_id = $2 RETURNING username',
      [passHash, id]
    );
    return result.rows[0];
  },

  async toggleActive(client, id) {
    const result = await client.query(
      'UPDATE public.staff SET is_active = NOT is_active WHERE staff_id = $1 RETURNING username, is_active',
      [id]
    );
    return result.rows[0];
  },

  async deleteStaff(client, id) {
    const result = await client.query(
      'DELETE FROM public.staff WHERE staff_id = $1 RETURNING username',
      [id]
    );
    return result.rows[0];
  }
};

module.exports = staffService;
