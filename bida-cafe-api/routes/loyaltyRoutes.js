const express = require('express');
const { getUserMembership } = require('../services/membershipService');
const { toNumber } = require('../utils/common');

function createLoyaltyRouter({ pool }) {
  const router = express.Router();

  router.get('/ranks', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT rank_id, rank_name, min_deposit_threshold, discount_billiard_pct, discount_cafe_pct, rank_icon_url
         FROM public.membership_ranks
         ORDER BY min_deposit_threshold ASC, rank_id ASC`
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users/:userId', async (req, res) => {
    const client = await pool.connect();

    try {
      const member = await getUserMembership(client, req.params.userId);
      const nextRankResult = await client.query(
        `SELECT rank_id, rank_name, min_deposit_threshold, discount_billiard_pct, discount_cafe_pct, rank_icon_url
         FROM public.membership_ranks
         WHERE min_deposit_threshold > $1::numeric
         ORDER BY min_deposit_threshold ASC, rank_id ASC
         LIMIT 1`,
        [member.total_deposited]
      );

      res.json({
        user_id: member.user_id,
        full_name: member.full_name,
        phone: member.phone,
        wallet_balance: member.wallet_balance,
        total_deposited: member.total_deposited,
        current_rank: {
          rank_id: member.rank_id,
          rank_name: member.rank_name,
          min_deposit_threshold: member.min_deposit_threshold,
          discount_billiard_pct: member.discount_billiard_pct,
          discount_cafe_pct: member.discount_cafe_pct,
          rank_icon_url: member.rank_icon_url,
        },
        next_rank: nextRankResult.rowCount > 0 ? nextRankResult.rows[0] : null,
        amount_to_next_rank:
          nextRankResult.rowCount > 0
            ? Math.max(
                0,
                toNumber(nextRankResult.rows[0].min_deposit_threshold) - toNumber(member.total_deposited)
              )
            : 0,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = { createLoyaltyRouter };
