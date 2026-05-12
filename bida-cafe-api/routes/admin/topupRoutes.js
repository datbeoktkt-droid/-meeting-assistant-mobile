const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const topupService = require('../../services/topupService');
const { requireRoles } = require('../../middlewares/authMiddleware');
const { writeActivityLog } = require('../../services/activityLogService');
const { withTransaction } = require('../../utils/dbHelper');
const { toNumber } = require('../../utils/common');

function createTopupRouter({ pool, notificationHub }) {
  const router = express.Router();

  const log = async (req, type, desc) => {
    await writeActivityLog(pool, {
      staffId: req.auth.staff_id, actionType: type, description: desc, ipAddress: req.ip,
    });
  };

  router.use(requireRoles('ADMIN', 'MANAGER', 'STAFF'));

  router.get('/', asyncHandler(async (req, res) => {
    const list = await topupService.getTopupRequests(pool, req.query);
    res.json(list.map(r => ({ ...r, amount: toNumber(r.amount) })));
  }));

  router.patch('/:id', asyncHandler(async (req, res) => {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error('Trang thai khong hop le');
    }

    const request = await withTransaction(pool, async (client) => {
      return await topupService.reviewRequest(client, req.params.id, {
        status, adminNote, staffId: req.auth.staff_id
      });
    });

    if (!request) return res.status(404).json({ error: 'Khong tim thay yeu cau hoac da duoc xu ly' });

    await log(req, `TOPUP_${status}`, `Xu ly yeu cau nap tien ID ${req.params.id}: ${status}`);
    
    notificationHub.broadcast('topup:status_updated', { 
      request_id: request.request_id, 
      status: request.status 
    });

    res.json({ success: true, request });
  }));

  return router;
}

module.exports = { createTopupRouter };
