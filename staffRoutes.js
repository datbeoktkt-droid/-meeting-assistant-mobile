const express = require('express');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireManager } = require('../middlewares/roleMiddleware');
const { hashPassword } = require('../services/authService');
const { writeActivityLog } = require('../services/activityLogService');

const VALID_ROLES = ['MANAGER', 'STAFF', 'CASHIER'];
const USERNAME_REGEX = /^[a-z0-9_]+$/;

function createStaffRouter({ pool }) {
  const router = express.Router();

  const logAction = async (req, type, description) => {
    await writeActivityLog(pool, {
      staffId: req.auth.staff_id,
      actionType: type,
      description,
      ipAddress: req.ip,
    });
  };

  const revokeAllTokens = async (client, staffId) => {
    await client.query(
      `UPDATE public.auth_refresh_tokens
       SET revoked_at = NOW()
       WHERE staff_id = $1
         AND revoked_at IS NULL`,
      [staffId]
    );
  };

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
            staff_id,
            username,
            full_name,
            role,
            is_active,
            last_login,
            created_at
         FROM public.staff
         ORDER BY created_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      console.error('[STAFF_LIST_ERROR]', error);

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Khong the lay danh sach nhan vien',
      });
    }
  });

  router.post('/', requireManager, async (req, res) => {
    const {
      username: rawUsername,
      password,
      fullName: rawFullName,
      role,
    } = req.body;

    try {
      const username = String(rawUsername || '')
        .trim()
        .toLowerCase();

      const fullName = String(rawFullName || '').trim();

      if (!username || !password || !fullName || !role) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Vui long dien day du thong tin',
        });
      }

      if (!USERNAME_REGEX.test(username)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Username chi duoc chua chu cai, so va dau gach duoi',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Mat khau phai co it nhat 6 ky tu',
        });
      }

      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Vai tro khong hop le',
        });
      }

      const existing = await pool.query(
        `SELECT staff_id
         FROM public.staff
         WHERE username = $1`,
        [username]
      );

      if (existing.rowCount > 0) {
        return res.status(400).json({
          error: 'Conflict',
          message: 'Ten dang nhap nay da ton tai',
        });
      }

      const passwordHash = await hashPassword(password);

      const result = await pool.query(
        `INSERT INTO public.staff (
            username,
            password_hash,
            full_name,
            role,
            is_active
         )
         VALUES ($1, $2, $3, $4, true)
         RETURNING
            staff_id,
            username,
            full_name,
            role,
            is_active`,
        [username, passwordHash, fullName, role]
      );

      await logAction(
        req,
        'STAFF_CREATE',
        `Tao nhan vien moi: ${username} (${role})`
      );

      res.status(201).json({
        success: true,
        staff: result.rows[0],
      });
    } catch (error) {
      console.error('[STAFF_CREATE_ERROR]', error);

      res.status(500).json({
        error: 'Internal Server Error',
      });
    }
  });

  router.patch('/:id', requireManager, async (req, res) => {
    const staffId = req.params.id;
    const {
      fullName: rawFullName,
      role,
    } = req.body;

    try {
      const fullName =
        rawFullName !== undefined
          ? String(rawFullName).trim()
          : undefined;

      if (
        String(staffId) === String(req.auth.staff_id) &&
        role
      ) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Khong the tu thay doi vai tro cua chinh minh',
        });
      }

      if (role && !VALID_ROLES.includes(role)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Vai tro khong hop le',
        });
      }

      if (fullName === '') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Ho ten khong duoc de trong',
        });
      }

      const result = await pool.query(
        `UPDATE public.staff
         SET
            full_name = COALESCE($1, full_name),
            role = COALESCE($2, role)
         WHERE staff_id = $3
         RETURNING
            staff_id,
            username,
            full_name,
            role`,
        [fullName, role, staffId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Khong tim thay nhan vien',
        });
      }

      await logAction(
        req,
        'STAFF_UPDATE',
        `Cap nhat thong tin nhan vien ID ${staffId}`
      );

      res.json({
        success: true,
        staff: result.rows[0],
      });
    } catch (error) {
      console.error('[STAFF_UPDATE_ERROR]', error);

      res.status(500).json({
        error: 'Internal Server Error',
      });
    }
  });

  router.patch('/:id/reset-password', requireManager, async (req, res) => {
    const staffId = req.params.id;
    const { newPassword } = req.body;

    const client = await pool.connect();

    try {
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Mat khau moi phai co it nhat 6 ky tu',
        });
      }

      await client.query('BEGIN');

      const passHash = await hashPassword(newPassword);

      const result = await client.query(
        `UPDATE public.staff
         SET password_hash = $1
         WHERE staff_id = $2
         RETURNING username`,
        [passHash, staffId]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          error: 'Not Found',
          message: 'Khong tim thay nhan vien',
        });
      }

      await revokeAllTokens(client, staffId);

      await client.query('COMMIT');

      await logAction(
        req,
        'STAFF_RESET_PASSWORD',
        `Reset mat khau cho nhan vien: ${result.rows[0].username}`
      );

      res.json({
        success: true,
        message: 'Da reset mat khau va thu hoi tat ca token',
      });
    } catch (error) {
      await client.query('ROLLBACK');

      console.error('[STAFF_RESET_PWD_ERROR]', error);

      res.status(500).json({
        error: 'Internal Server Error',
      });
    } finally {
      client.release();
    }
  });

  router.patch('/:id/toggle-active', requireManager, async (req, res) => {
    const staffId = req.params.id;

    if (String(staffId) === String(req.auth.staff_id)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Khong the tu khoa tai khoan cua chinh minh',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE public.staff
         SET is_active = NOT is_active
         WHERE staff_id = $1
         RETURNING username, is_active`,
        [staffId]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          error: 'Not Found',
          message: 'Khong tim thay nhan vien',
        });
      }

      const { username, is_active } = result.rows[0];

      if (!is_active) {
        await revokeAllTokens(client, staffId);
      }

      await client.query('COMMIT');

      await logAction(
        req,
        is_active
          ? 'STAFF_ACTIVATE'
          : 'STAFF_DEACTIVATE',
        `${is_active ? 'Kich hoat' : 'Khoa'} tai khoan: ${username}`
      );

      res.json({
        success: true,
        is_active,
      });
    } catch (error) {
      await client.query('ROLLBACK');

      console.error('[STAFF_TOGGLE_ERROR]', error);

      res.status(500).json({
        error: 'Internal Server Error',
      });
    } finally {
      client.release();
    }
  });

  router.delete('/:id', requireManager, async (req, res) => {
    const staffId = req.params.id;

    if (String(staffId) === String(req.auth.staff_id)) {
      return res.status(400).json({
        error: 'Forbidden',
        message: 'Khong the tu xoa tai khoan cua chinh minh',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const check = await client.query(
        `SELECT username
         FROM public.staff
         WHERE staff_id = $1`,
        [staffId]
      );

      if (check.rowCount === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          error: 'Not Found',
          message: 'Khong tim thay nhan vien',
        });
      }

      await revokeAllTokens(client, staffId);

      await client.query(
        `DELETE FROM public.staff
         WHERE staff_id = $1`,
        [staffId]
      );

      await client.query('COMMIT');

      await logAction(
        req,
        'STAFF_DELETE',
        `Xoa vinh vien nhan vien: ${check.rows[0].username}`
      );

      res.json({
        success: true,
        message: 'Da xoa nhan vien vinh vien',
      });
    } catch (error) {
      await client.query('ROLLBACK');

      console.error('[STAFF_DELETE_ERROR]', error);

      res.status(500).json({
        error: 'Internal Server Error',
      });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = { createStaffRouter };
