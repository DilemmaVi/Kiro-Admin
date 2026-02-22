require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'kiro-admin-secret-key-2024',
  jwtExpire: '24h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};
