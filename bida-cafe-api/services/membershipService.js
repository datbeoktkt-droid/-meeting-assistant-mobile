async function getUserMembership(client, userId) {
  const result = await client.query(
    `SELECT u.user_id, u.full_name, u.phone, u.wallet_balance, u.total_deposited, u.rank_id,
            mr.rank_name, mr.min_deposit_threshold, mr.discount_billiard_pct, mr.discount_cafe_pct, mr.rank_icon_url
     FROM public.users u
     LEFT JOIN public.membership_ranks mr ON mr.rank_id = u.rank_id
     WHERE u.user_id = $1`,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new Error('Khong tim thay thanh vien');
  }

  return result.rows[0];
}

async function syncUserRank(client, userId) {
  const currentUser = await client.query(
    'SELECT user_id, total_deposited FROM public.users WHERE user_id = $1',
    [userId]
  );

  if (currentUser.rowCount === 0) {
    throw new Error('Khong tim thay thanh vien');
  }

  const nextRank = await client.query(
    `SELECT rank_id, rank_name, min_deposit_threshold, discount_billiard_pct, discount_cafe_pct, rank_icon_url
     FROM public.membership_ranks
     WHERE min_deposit_threshold <= $1::numeric
     ORDER BY min_deposit_threshold DESC, rank_id DESC
     LIMIT 1`,
    [currentUser.rows[0].total_deposited]
  );

  if (nextRank.rowCount === 0) {
    return null;
  }

  await client.query(
    'UPDATE public.users SET rank_id = $1 WHERE user_id = $2',
    [nextRank.rows[0].rank_id, userId]
  );

  return nextRank.rows[0];
}

module.exports = {
  getUserMembership,
  syncUserRank,
};
