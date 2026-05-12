/**
 * [ROLE MIDDLEWARE]
 * Kiem tra quyen han cua nhan vien
 */

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Ban khong co quyen thuc hien thao tac nay'
      });
    }
    next();
  };
}

const requireManager = requireRole(['MANAGER']);
const requireCashier = requireRole(['MANAGER', 'CASHIER']);

module.exports = { requireRole, requireManager, requireCashier };
