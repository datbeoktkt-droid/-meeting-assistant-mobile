const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const tableService = require('../../services/tableService');
const { requireAuth } = require('../../middlewares/authMiddleware');
const { writeActivityLog } = require('../../services/activityLogService');
const { toNumber } = require('../../utils/common');

function createTableRouter({ pool, notificationHub }) {
  const router = express.Router();

  // Helper log nhanh
  const log = async (req, type, desc) => {
    await writeActivityLog(pool, {
      staffId: req.auth.staff_id, actionType: type, description: desc, ipAddress: req.ip,
    });
  };

  router.use(requireAuth);

  router.get('/', asyncHandler(async (req, res) => {
    const tables = await tableService.getAllTables(pool);
    res.json(tables);
  }));

  router.get('/:tableId/invoice-summary', asyncHandler(async (req, res) => {
    const summary = await tableService.getTableInvoiceSummary(pool, req.params.tableId);
    if (!summary) return res.status(404).json({ error: 'Khong tim thay ban' });

    const { table, customerRankName, activeSession, activeCafeItems, settledItems } = summary;

    const cafeOutstandingTotal = activeCafeItems
      .filter(item => item.status !== 'CANCELLED' && item.status !== 'DONE')
      .reduce((sum, item) => sum + item.total_amount, 0);
    const cafeSettledTotal = activeCafeItems
      .filter(item => item.status === 'DONE')
      .reduce((sum, item) => sum + item.total_amount, 0);

    const historicalTotal = settledItems.reduce((sum, item) => sum + item.total_amount, 0);
    const currentEstimated = activeSession ? activeSession.estimated_total : 0;
    const cafeTotal = cafeOutstandingTotal + cafeSettledTotal;
    const cafeSubtotalTotal = activeCafeItems.reduce((sum, item) => sum + item.subtotal_amount, 0);
    const cafeDiscountTotal = Math.max(0, cafeSubtotalTotal - cafeTotal);

    res.json({
      table_id: table.table_id,
      table_number: table.table_number,
      table_qr_code_path: table.qr_code_path,
      customer_rank_name: customerRankName,
      active_session: activeSession,
      active_cafe_items: activeCafeItems,
      settled_items: settledItems,
      historical_total: historicalTotal,
      cafe_outstanding_total: cafeOutstandingTotal,
      cafe_settled_total: cafeSettledTotal,
      cafe_subtotal_total: cafeSubtotalTotal,
      cafe_discount_total: cafeDiscountTotal,
      cafe_total: cafeTotal,
      current_estimated_total: currentEstimated,
      grand_total: currentEstimated + cafeOutstandingTotal,
    });
  }));

  router.patch('/:tableId/status', asyncHandler(async (req, res) => {
    const { status } = req.body;
    const table = await tableService.updateTableStatus(pool, req.params.tableId, status);
    if (!table) return res.status(404).json({ error: 'Khong tim thay ban' });

    await log(req, 'TABLE_STATUS_UPDATE', `Cap nhat trang thai ban ${table.table_number} thanh ${status}`);
    
    // Broadcast thong bao real-time
    notificationHub.broadcast('table:status_updated', table);

    res.json({ success: true, table });
  }));

  // Cac endpoint khac nhu mark-cleaning, mark-available co the duoc gop vao status hoac viet rieng
  router.post('/:tableId/mark-cleaning', asyncHandler(async (req, res) => {
    const table = await tableService.updateTableStatus(pool, req.params.tableId, 'CLEANING');
    notificationHub.broadcast('table:status_updated', table);
    res.json({ success: true });
  }));

  router.post('/:tableId/mark-available', asyncHandler(async (req, res) => {
    const table = await tableService.updateTableStatus(pool, req.params.tableId, 'AVAILABLE');
    notificationHub.broadcast('table:status_updated', table);
    res.json({ success: true });
  }));

  return router;
}

module.exports = { createTableRouter };
