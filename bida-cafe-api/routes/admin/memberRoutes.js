const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const memberService = require('../../services/memberService');
const { requireRoles } = require('../../middlewares/authMiddleware');
const { writeActivityLog } = require('../../services/activityLogService');
const { toNumber } = require('../../utils/common');

function createMemberRouter({ pool }) {
  const router = express.Router();

  // Helper log nhanh
  const log = async (req, type, desc) => {
    await writeActivityLog(pool, {
      staffId: req.auth.staff_id, actionType: type, description: desc, ipAddress: req.ip,
    });
  };

  // Tat ca route o day deu can quyen ADMIN hoac STAFF
  router.use(requireRoles('ADMIN', 'MANAGER', 'STAFF'));

  router.get('/', asyncHandler(async (req, res) => {
    const members = await memberService.getMembers(pool, req.query);
    res.json(members.map(m => ({
      ...m,
      wallet_balance: toNumber(m.wallet_balance),
      total_deposited: toNumber(m.total_deposited)
    })));
  }));

  router.get('/:userId', asyncHandler(async (req, res) => {
    const member = await memberService.getMemberDetail(pool, req.params.userId);
    if (!member) return res.status(404).json({ error: 'Khong tim thay hoi vien' });
    
    res.json({
      ...member,
      wallet_balance: toNumber(member.wallet_balance),
      total_deposited: toNumber(member.total_deposited),
    });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { phone, fullName, avatarUrl, rankId } = req.body;
    if (!phone) throw new Error('Thieu so dien thoai');

    const member = await memberService.createMember(pool, { phone, fullName, avatarUrl, rankId });
    await log(req, 'MEMBER_CREATE', `Tao thanh vien: ${phone}`);
    res.status(201).json({ success: true, member });
  }));

  router.patch('/:userId', asyncHandler(async (req, res) => {
    const member = await memberService.updateMember(pool, req.params.userId, req.body);
    if (!member) return res.status(404).json({ error: 'Khong tim thay hoi vien' });

    await log(req, 'MEMBER_UPDATE', `Cap nhat thanh vien ID ${req.params.userId}`);
    res.json({ success: true, member });
  }));

  return router;
}

module.exports = { createMemberRouter };
