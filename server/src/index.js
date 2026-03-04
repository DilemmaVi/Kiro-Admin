const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const { db, initDatabase } = require('./config/database-adapter');
const { migrateDatabase } = require('./utils/migrate');

const authRoutes = require('./routes/auth');
const tokenRoutes = require('./routes/tokens');
const apiKeyRoutes = require('./routes/apiKeys');
const configRoutes = require('./routes/config');
const statsRoutes = require('./routes/stats');
const modelRoutes = require('./routes/models');
const modelTestRoutes = require('./routes/modelTest');
const proxyRoutes = require('./routes/proxy');

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// 中间件
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/config', configRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/model-test', modelTestRoutes);

// API 代理路由（兼容 Anthropic API）
app.use('/v1', proxyRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// 初始化数据库并启动服务器
initDatabase()
  .then(() => migrateDatabase())
  .then(() => {
    const dbType = process.env.DB_TYPE || 'sqlite';
    let dbInfo;
    
    if (dbType === 'postgres') {
      dbInfo = `${process.env.DB_POSTGRESDB_HOST}:${process.env.DB_POSTGRESDB_PORT}/${process.env.DB_POSTGRESDB_DATABASE}`;
    } else {
      dbInfo = process.env.DB_PATH || './data/kiro.db';
    }
    
    app.listen(config.port, () => {
      console.log(`\n🚀 Kiro Admin Server 运行在 http://localhost:${config.port}`);
      console.log(`📊 数据库: ${dbType.toUpperCase()} - ${dbInfo}`);
      console.log(`🔗 CORS: ${config.corsOrigins.join(', ')}`);
      console.log(`🔐 OAuth: ${process.env.OAUTH_REDIRECT_URI || 'http://localhost:3001/api/auth/oauth/callback'}`);
      console.log(`✨ 服务已就绪\n`);
    });
  })
  .catch((err) => {
    console.error('\n✗ 服务器启动失败:', err.message);
    console.error('\n请检查：');
    console.error('  1. 数据库连接配置是否正确');
    console.error('  2. 数据库服务是否正常运行');
    console.error('  3. 网络连接是否正常\n');
    process.exit(1);
  });

module.exports = app;
