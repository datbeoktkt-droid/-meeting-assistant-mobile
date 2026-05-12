const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const miscService = require('../../services/miscService');
const { requireRoles } = require('../../middlewares/authMiddleware');
const { toNumber } = require('../../utils/common');

function createMiscRouter({ pool }) {
  const router = express.Router();

  // Yeu cau quyen ADMIN cho cac cau hinh he thong
  // --- PRICING ---
  router.get('/pricing', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const data = await miscService.getPriceConfigs(pool);
    res.json(data.map(d => ({ ...d, price_per_hour: toNumber(d.price_per_hour) })));
  }));

  router.patch('/pricing/:id', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const config = await miscService.updatePriceConfig(pool, req.params.id, req.body);
    res.json({ success: true, config });
  }));

  // --- PAYMENT RECEIVERS ---
  router.get('/payment-receivers', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const data = await miscService.getPaymentReceivers(pool);
    res.json(data);
  }));

  router.patch('/payment-receivers/:id', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const receiver = await miscService.updatePaymentReceiver(pool, req.params.id, req.body);
    res.json({ success: true, receiver });
  }));

  // --- ACTIVITY LOGS ---
  router.get('/activity-logs', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const logs = await miscService.getActivityLogs(pool, req.query);
    res.json(logs);
  }));

  return router;
}

module.exports = { createMiscRouter };
