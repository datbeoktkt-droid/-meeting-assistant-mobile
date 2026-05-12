const { verifyToken } = require('../services/authService');

/**
 * Trich xuat Bearer token tu Header Authorization
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim();
}

/**
 * Middleware bat buoc dang nhap (Nhan vien / Admin)
 */
function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Chua dang nhap' });
    }

    req.accessToken = token;
    req.auth = verifyToken(token);

    // Kiem tra loai token (phai la access token cho admin)
    if (req.auth.type && req.auth.type !== 'access') {
      return res.status(401).json({ error: 'Token khong hop le cho truy cap quan tri' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Phien dang nhap het han hoac khong hop le' });
  }
}

/**
 * Middleware kiem tra quyen han (Roles)
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Chua dang nhap' });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Ban khong co quyen thuc hien hanh dong nay' });
    }

    next();
  };
}

/**
 * Middleware xac thuc cho nguoi dung (Mobile App)
 */
function requireUserAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Chua dang nhap' });
    }

    req.accessToken = token;
    req.userAuth = verifyToken(token);
    
    if (req.userAuth.type !== 'user_access') {
      return res.status(401).json({ error: 'Token khong hop le cho ung dung khach hang' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token khong hop le' });
  }
}

module.exports = {
  requireAuth,
  requireRoles,
  requireUserAuth,
};
