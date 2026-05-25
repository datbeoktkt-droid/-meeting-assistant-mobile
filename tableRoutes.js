const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const tableService = require('../../services/tableService');
const { requireAuth, requireRoles } = require('../../middlewares/authMiddleware');
const { writeActivityLog } = require('../../services/activityLogService');

function createTableRouter({ pool, notificationHub }) {
  const router = express.Router();

  const log = async (req, type, desc) => {
    await writeActivityLog(pool, {
      staffId: req.auth.staff_id,
      actionType: type,
      description: desc,
      ipAddress: req.ip,
    });
  };

  router.use(requireAuth);

  // ID 19 - Lấy danh sách bàn
  router.get('/', asyncHandler(async (req, res) => {
    const tables = await tableService.getAllTables(pool);
    res.json(tables);
  }));

  // ID 19 - Lấy chi tiết bàn
  router.get('/:tableId', requireRoles('ADMIN', 'MANAGER', 'STAFF'), asyncHandler(async (req, res) => {
    const table = await tableService.getTableById(pool, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Khong tim thay ban' });
    res.json(table);
  }));

  // ID 19 - Thêm bàn
  router.post('/', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const table = await tableService.createTable(pool, req.body);

    await log(req, 'TABLE_CREATE', `Tao ban ${table.name} voi gia ${table.price_per_hour}`);
    notificationHub.broadcast('table:created', table);

    res.status(201).json({ success: true, table });
  }));

  // ID 19 - Sửa thông tin bàn
  router.patch('/:tableId', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const table = await tableService.updateTable(pool, req.params.tableId, req.body);
    if (!table) return res.status(404).json({ error: 'Khong tim thay ban' });

    await log(req, 'TABLE_UPDATE', `Cap nhat ban ${table.name}`);
    notificationHub.broadcast('table:updated', table);

    res.json({ success: true, table });
  }));

  // ID 20 - API cập nhật giá giờ cho 1 bàn
  router.patch('/:tableId/price', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const pricePerHour = req.body.price_per_hour ?? req.body.pricePerHour;

    const table = await tableService.updateTablePrice(pool, req.params.tableId, pricePerHour);
    if (!table) return res.status(404).json({ error: 'Khong tim thay ban' });

    await log(req, 'TABLE_PRICE_UPDATE', `Cap nhat gia gio ban ${table.name}: ${table.price_per_hour}`);
    notificationHub.broadcast('table:price_updated', table);

    res.json({ success: true, table });
  }));

  // ID 20 - API cập nhật giá giờ theo nhóm VIP / thường
  router.patch('/prices/group', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const isVip = req.body.is_vip ?? req.body.isVip;
    const pricePerHour = req.body.price_per_hour ?? req.body.pricePerHour;

    const tables = await tableService.updateTablePricesByType(pool, { isVip, pricePerHour });
    const typeLabel = isVip ? 'VIP' : 'STANDARD';

    await log(req, 'TABLE_GROUP_PRICE_UPDATE', `Cap nhat gia gio tat ca ban ${typeLabel}: ${pricePerHour}`);

    notificationHub.broadcast('table:group_price_updated', {
      is_vip: Boolean(isVip),
      price_per_hour: Number(pricePerHour),
      tables,
    });

    res.json({ success: true, tables });
  }));

  // ID 19 - Xóa bàn
  router.delete('/:tableId', requireRoles('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
    const table = await tableService.deleteTable(pool, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Khong tim thay ban' });

    await log(req, 'TABLE_DELETE', `Xoa ban ${table.name}`);
    notificationHub.broadcast('table:deleted', table);

    res.json({ success: true, table });
  }));

  return router;
}

module.exports = createTableRouter;
