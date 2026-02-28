require('dotenv').config();

const parseCorsOrigins = () => {
  const raw = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

module.exports = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'kiro-admin-secret-key-2024',
  jwtExpire: '24h',
  corsOrigins: parseCorsOrigins(),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  trustProxy: process.env.TRUST_PROXY === 'true'
};
