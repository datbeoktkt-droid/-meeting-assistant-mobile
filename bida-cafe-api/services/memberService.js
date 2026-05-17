/**
 * [MEMBER SERVICE]
 * Business logic & Database queries for Members (Users)
 */
const { getUserMembership } = require('./membershipService');

const memberService = {
  async getMembers(pool, { q = '', rankId = null }) {
    const values = [];
    const conditions = [];

    if (q) {
      values.push(`%${q}%`);
      const idx = values.length;
      conditions.push(`(u.full_name ILIKE $${idx} OR u.phone ILIKE $${idx})`);
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
    return result.rows;
  },

  async getMemberDetail(pool, userId) {
    // Dung chung logic tu membershipService da co
    const client = await pool.connect();
    try {
      const member = await getUserMembership(client, userId);
      const orderStats = await client.query(
        `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_spent
         FROM public.orders
         WHERE user_id = $1 AND status = 'DONE'`,
        [userId]
      );
      return {
        ...member,
        total_orders: parseInt(orderStats.rows[0].total_orders, 10),
        total_spent: parseFloat(orderStats.rows[0].total_spent)
      };
    } finally {
      client.release();
    }
  },

  async createMember(pool, { phone, fullName, avatarUrl, rankId = 1 }) {
    const result = await pool.query(
      `INSERT INTO public.users (phone, full_name, avatar_url, rank_id)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, phone, full_name, wallet_balance, total_deposited, rank_id, avatar_url, created_at`,
      [phone, fullName, avatarUrl, rankId]
    );
    return result.rows[0];
  },

  async updateMember(pool, userId, { fullName, avatarUrl, rankId }) {
    const result = await pool.query(
      `UPDATE public.users
       SET full_name = COALESCE($1, full_name),
           avatar_url = COALESCE($2, avatar_url),
           rank_id = COALESCE($3, rank_id)
       WHERE user_id = $4
       RETURNING user_id, phone, full_name, wallet_balance, total_deposited, rank_id, avatar_url, created_at`,
      [fullName, avatarUrl, rankId, userId]
    );
    return result.rows[0];
  }
};

module.exports = memberService;
