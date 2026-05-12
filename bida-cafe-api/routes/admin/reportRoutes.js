const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const reportService = require('../../services/reportService');
const { requireRoles } = require('../../middlewares/authMiddleware');

function createReportRouter({ pool }) {
  const router = express.Router();

  // Bao ve tat ca route bao cao (chi cho phep ADMIN)
  router.use(requireRoles('ADMIN', 'MANAGER'));

  router.get('/overview', asyncHandler(async (req, res) => {
    const data = await reportService.getOverview(pool, req.query);
    res.json(data);
  }));

  router.get('/top-products', asyncHandler(async (req, res) => {
    const data = await reportService.getTopProducts(pool, req.query);
    res.json(data);
  }));

  router.get('/occupancy', asyncHandler(async (req, res) => {
    const data = await reportService.getOccupancy(pool, req.query);
    res.json(data);
  }));

  router.get('/system-balance', asyncHandler(async (req, res) => {
    const data = await reportService.getSystemBalance(pool);
    res.json(data);
  }));

  return router;
}

module.exports = { createReportRouter };
