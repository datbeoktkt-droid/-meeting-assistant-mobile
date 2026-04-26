const { verifyToken } = require('../services/authService');

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
}

function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Chua dang nhap' });
    }

    req.accessToken = token;
    req.auth = verifyToken(token);
    if (req.auth.type && req.auth.type !== 'access') {
      return res.status(401).json({ error: 'Token khong hop le cho truy cap API' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Chua dang nhap' });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Khong du quyen thao tac' });
    }

    next();
  };
}

function requireUserAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Chua dang nhap' });
    }

    req.accessToken = token;
    req.userAuth = verifyToken(token);
    if (req.userAuth.type !== 'user_access') {
      return res.status(401).json({ error: 'Token khong hop le cho user app' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

module.exports = {
  requireAuth,
  requireRoles,
  requireUserAuth,
};
