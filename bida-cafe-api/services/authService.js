const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TOKEN_TTL = 15 * 60;
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

function base64urlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function signToken(payload, expiresInSeconds = ACCESS_TOKEN_TTL) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token khong hop le');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    throw new Error('Token khong hop le');
  }

  const payload = JSON.parse(base64urlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && now > payload.exp) {
    throw new Error('Token da het han');
  }

  return payload;
}

function hashSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function hashPassword(rawPassword) {
  return bcrypt.hash(rawPassword, 10);
}

async function verifyPassword(rawPassword, storedHash) {
  if (!storedHash) {
    return { match: false, needsUpgrade: false };
  }

  if (isBcryptHash(storedHash)) {
    return {
      match: await bcrypt.compare(rawPassword, storedHash),
      needsUpgrade: false,
    };
  }

  if (rawPassword === storedHash) {
    return { match: true, needsUpgrade: true };
  }

  if (hashSha256(rawPassword) === storedHash) {
    return { match: true, needsUpgrade: true };
  }

  return { match: false, needsUpgrade: false };
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  createRefreshToken,
  hashSha256,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
};
