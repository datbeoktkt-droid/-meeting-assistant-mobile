const express = require('express');
const {
  signToken,
  verifyPassword,
  hashPassword,
  createRefreshToken,
  hashSha256,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
} = require('../services/authService');
const { requireAuth } = require('../middlewares/authMiddleware');
const { writeActivityLog } = require('../services/activityLogService');

function createAdminAuthRouter({ pool }) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
      if (!username || !password) {
        throw new Error('Thieu username hoac password');
      }

      const staffResult = await pool.query(
        `SELECT staff_id, username, password_hash, full_name, role, is_active
         FROM public.staff
         WHERE username = $1`,
        [username]
      );

      if (staffResult.rowCount === 0) {
        throw new Error('Tai khoan hoac mat khau khong dung');
      }

      const staff = staffResult.rows[0];
      if (!staff.is_active) {
        throw new Error('Tai khoan da bi khoa');
      }

      const passwordCheck = await verifyPassword(password, staff.password_hash);
      if (!passwordCheck.match) {
        throw new Error('Tai khoan hoac mat khau khong dung');
      }

      if (passwordCheck.needsUpgrade) {
        const nextHash = await hashPassword(password);
        await pool.query(
          'UPDATE public.staff SET password_hash = $1 WHERE staff_id = $2',
          [nextHash, staff.staff_id]
        );
      }

      await pool.query(
        'UPDATE public.staff SET last_login = NOW() WHERE staff_id = $1',
        [staff.staff_id]
      );

      await writeActivityLog(pool, {
        staffId: staff.staff_id,
        actionType: 'LOGIN',
        description: `Nhan vien ${staff.username} dang nhap`,
        ipAddress: req.ip,
      });

      const token = signToken({
        staff_id: staff.staff_id,
        username: staff.username,
        role: staff.role,
        full_name: staff.full_name,
        type: 'access',
      });
      const refreshToken = createRefreshToken();
      const refreshTokenHash = hashSha256(refreshToken);

      await pool.query(
        `INSERT INTO public.auth_refresh_tokens (staff_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval, $4, $5)`,
        [staff.staff_id, refreshTokenHash, String(REFRESH_TOKEN_TTL), req.ip, req.headers['user-agent'] || null]
      );

      res.json({
        success: true,
        token,
        access_token: token,
        access_token_expires_in: ACCESS_TOKEN_TTL,
        refresh_token: refreshToken,
        refresh_token_expires_in: REFRESH_TOKEN_TTL,
        staff: {
          staff_id: staff.staff_id,
          username: staff.username,
          full_name: staff.full_name,
          role: staff.role,
        },
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    try {
      if (!refreshToken) {
        throw new Error('Thieu refreshToken');
      }

      const refreshTokenHash = hashSha256(refreshToken);
      const tokenResult = await pool.query(
        `SELECT rt.refresh_id, rt.staff_id, rt.expires_at, rt.revoked_at,
                s.username, s.full_name, s.role, s.is_active
         FROM public.auth_refresh_tokens rt
         JOIN public.staff s ON s.staff_id = rt.staff_id
         WHERE rt.token_hash = $1`,
        [refreshTokenHash]
      );

      if (tokenResult.rowCount === 0) {
        throw new Error('Refresh token khong hop le');
      }

      const tokenRow = tokenResult.rows[0];
      if (tokenRow.revoked_at) {
        throw new Error('Refresh token da bi thu hoi');
      }
      if (!tokenRow.is_active) {
        throw new Error('Tai khoan da bi khoa');
      }
      if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
        throw new Error('Refresh token da het han');
      }

      const nextAccessToken = signToken({
        staff_id: tokenRow.staff_id,
        username: tokenRow.username,
        role: tokenRow.role,
        full_name: tokenRow.full_name,
        type: 'access',
      });
      const nextRefreshToken = createRefreshToken();
      const nextRefreshTokenHash = hashSha256(nextRefreshToken);

      await pool.query('BEGIN');
      await pool.query(
        `UPDATE public.auth_refresh_tokens
         SET revoked_at = NOW(), last_used_at = NOW()
         WHERE refresh_id = $1`,
        [tokenRow.refresh_id]
      );
      await pool.query(
        `INSERT INTO public.auth_refresh_tokens (staff_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval, $4, $5)`,
        [tokenRow.staff_id, nextRefreshTokenHash, String(REFRESH_TOKEN_TTL), req.ip, req.headers['user-agent'] || null]
      );
      await pool.query('COMMIT');

      res.json({
        success: true,
        access_token: nextAccessToken,
        access_token_expires_in: ACCESS_TOKEN_TTL,
        refresh_token: nextRefreshToken,
        refresh_token_expires_in: REFRESH_TOKEN_TTL,
      });
    } catch (error) {
      try {
        await pool.query('ROLLBACK');
      } catch (rollbackError) {}
      res.status(401).json({ error: error.message });
    }
  });

  router.post('/logout', requireAuth, async (req, res) => {
    const { refreshToken = null, logoutAll = false } = req.body || {};

    try {
      if (logoutAll) {
        await pool.query(
          `UPDATE public.auth_refresh_tokens
           SET revoked_at = NOW(), last_used_at = NOW()
           WHERE staff_id = $1 AND revoked_at IS NULL`,
          [req.auth.staff_id]
        );
      } else if (refreshToken) {
        await pool.query(
          `UPDATE public.auth_refresh_tokens
           SET revoked_at = NOW(), last_used_at = NOW()
           WHERE staff_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
          [req.auth.staff_id, hashSha256(refreshToken)]
        );
      }

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'LOGOUT',
        description: `Nhan vien ${req.auth.username} dang xuat`,
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/logout-all', requireAuth, async (req, res) => {
    try {
      await pool.query(
        `UPDATE public.auth_refresh_tokens
         SET revoked_at = NOW(), last_used_at = NOW()
         WHERE staff_id = $1 AND revoked_at IS NULL`,
        [req.auth.staff_id]
      );

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'LOGOUT_ALL',
        description: `Nhan vien ${req.auth.username} dang xuat tat ca thiet bi`,
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
      if (!currentPassword || !newPassword || String(newPassword).length < 6) {
        throw new Error('Mat khau moi phai co it nhat 6 ky tu');
      }

      const staffResult = await pool.query(
        `SELECT staff_id, username, password_hash
         FROM public.staff
         WHERE staff_id = $1`,
        [req.auth.staff_id]
      );

      if (staffResult.rowCount === 0) {
        throw new Error('Khong tim thay tai khoan');
      }

      const passwordCheck = await verifyPassword(currentPassword, staffResult.rows[0].password_hash);
      if (!passwordCheck.match) {
        throw new Error('Mat khau hien tai khong dung');
      }

      const nextHash = await hashPassword(newPassword);
      await pool.query(
        'UPDATE public.staff SET password_hash = $1 WHERE staff_id = $2',
        [nextHash, req.auth.staff_id]
      );
      await pool.query(
        `UPDATE public.auth_refresh_tokens
         SET revoked_at = NOW(), last_used_at = NOW()
         WHERE staff_id = $1 AND revoked_at IS NULL`,
        [req.auth.staff_id]
      );

      await writeActivityLog(pool, {
        staffId: req.auth.staff_id,
        actionType: 'PASSWORD_CHANGE',
        description: `Nhan vien ${req.auth.username} doi mat khau`,
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'Da doi mat khau. Vui long dang nhap lai.' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/me', requireAuth, async (req, res) => {
    res.json({
      staff_id: req.auth.staff_id,
      username: req.auth.username,
      full_name: req.auth.full_name,
      role: req.auth.role,
    });
  });

  return router;
}

module.exports = { createAdminAuthRouter };
