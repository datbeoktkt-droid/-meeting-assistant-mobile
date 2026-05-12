const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const staffService = require('../../services/staffService');
const { requireManager } = require('../../middlewares/roleMiddleware');
const { withTransaction } = require('../../utils/dbHelper');
const { writeActivityLog } = require('../../services/activityLogService');

const VALID_ROLES = ['MANAGER', 'STAFF', 'CASHIER'];
const USERNAME_REGEX = /^[a-z0-9_]+$/;

function createStaffRouter({ pool }) {
  const router = express.Router();

  // Helper log nhanh
  const log = async (req, type, desc) => {
    await writeActivityLog(pool, {
      staffId: req.auth.staff_id, actionType: type, description: desc, ipAddress: req.ip,
    });
  };

  // Helper thu hoi token
  const revoke = async (client, id) => {
    await client.query('UPDATE public.auth_refresh_tokens SET revoked_at = NOW() WHERE staff_id = $1 AND revoked_at IS NULL', [id]);
  };

  // --- ROUTES ---

  router.get('/', asyncHandler(async (req, res) => {
    const list = await staffService.getAllStaff(pool);
    res.json(list);
  }));

  router.post('/', requireManager, asyncHandler(async (req, res) => {
    const { username: raw, password, fullName, role } = req.body;
    const username = String(raw || '').trim().toLowerCase();

    if (!username || !password || !fullName || !role) throw new Error('Vui long dien day du thong tin');
    if (!USERNAME_REGEX.test(username)) throw new Error('Username khong hop le');
    if (password.length < 6) throw new Error('Mat khau qua ngan');
    if (!VALID_ROLES.includes(role)) throw new Error('Vai tro khong hop le');

    const staff = await staffService.createStaff(pool, { username, password, fullName, role });
    await log(req, 'STAFF_CREATE', `Tao nhan vien: ${username}`);
    res.status(201).json({ success: true, staff });
  }));

  router.patch('/:id', requireManager, asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.auth.staff_id) && req.body.role) {
      throw new Error('Khong the tu doi vai tro');
    }
    const staff = await staffService.updateStaff(pool, req.params.id, req.body);
    if (!staff) return res.status(404).json({ error: 'Khong tim thay' });
    
    await log(req, 'STAFF_UPDATE', `Cap nhat ID ${req.params.id}`);
    res.json({ success: true, staff });
  }));

  router.patch('/:id/reset-password', requireManager, asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) throw new Error('Mat khau qua ngan');

    const username = await withTransaction(pool, async (client) => {
      const s = await staffService.setPassword(client, req.params.id, newPassword);
      if (!s) throw new Error('Khong tim thay nhan vien');
      await revoke(client, req.params.id);
      return s.username;
    });

    await log(req, 'STAFF_RESET_PASSWORD', `Reset pass cho: ${username}`);
    res.json({ success: true });
  }));

  router.patch('/:id/toggle-active', requireManager, asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.auth.staff_id)) throw new Error('Khong the tu khoa minh');

    const result = await withTransaction(pool, async (client) => {
      const s = await staffService.toggleActive(client, req.params.id);
      if (!s) throw new Error('Khong tim thay nhan vien');
      if (!s.is_active) await revoke(client, req.params.id);
      return s;
    });

    await log(req, result.is_active ? 'STAFF_ACTIVATE' : 'STAFF_DEACTIVATE', `Doi trang thai: ${result.username}`);
    res.json({ success: true, is_active: result.is_active });
  }));

  router.delete('/:id', requireManager, asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.auth.staff_id)) throw new Error('Khong the tu xoa minh');

    const username = await withTransaction(pool, async (client) => {
      await revoke(client, req.params.id);
      const s = await staffService.deleteStaff(client, req.params.id);
      if (!s) throw new Error('Khong tim thay');
      return s.username;
    });

    await log(req, 'STAFF_DELETE', `Xoa nhan vien: ${username}`);
    res.json({ success: true });
  }));

  return router;
}

module.exports = { createStaffRouter };
