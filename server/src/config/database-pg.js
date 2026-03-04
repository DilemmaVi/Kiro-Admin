const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL 连接配置
const poolConfig = {
  host: process.env.DB_POSTGRESDB_HOST || 'localhost',
  port: parseInt(process.env.DB_POSTGRESDB_PORT || '5432'),
  database: process.env.DB_POSTGRESDB_DATABASE || 'postgres',
  user: process.env.DB_POSTGRESDB_USER || 'postgres',
  password: process.env.DB_POSTGRESDB_PASSWORD || '',
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000, // 增加超时时间以适应 Supabase
};

// Supabase 和其他云数据库通常需要 SSL
// 默认启用 SSL，除非明确设置为 false
if (process.env.DB_POSTGRESDB_SSL !== 'false') {
  poolConfig.ssl = { 
    rejectUnauthorized: false // 允许自签名证书
  };
}

const pool = new Pool(poolConfig);

// 测试连接
pool.on('connect', () => {
  console.log('✓ PostgreSQL 数据库连接成功');
});

pool.on('error', (err) => {
  console.error('✗ PostgreSQL 连接错误:', err.message);
  if (err.code) {
    console.error(`  错误代码: ${err.code}`);
  }
});

/**
 * 初始化数据库表结构
 */
async function initDatabase() {
  let client;
  
  try {
    // 测试连接
    console.log('正在连接 PostgreSQL 数据库...');
    console.log(`  Host: ${poolConfig.host}`);
    console.log(`  Port: ${poolConfig.port}`);
    console.log(`  Database: ${poolConfig.database}`);
    console.log(`  User: ${poolConfig.user}`);
    console.log(`  SSL: ${poolConfig.ssl ? 'enabled' : 'disabled'}`);
    
    client = await pool.connect();
    console.log('✓ 数据库连接测试成功');
    
    await client.query('BEGIN');

    // 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 Token 配置表
    await client.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        id SERIAL PRIMARY KEY,
        auth_type VARCHAR(50) NOT NULL,
        refresh_token TEXT NOT NULL,
        client_id TEXT,
        client_secret TEXT,
        description TEXT,
        disabled INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        last_used TIMESTAMP,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 API 密钥表
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key_name VARCHAR(255) NOT NULL,
        key_value VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        disabled INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建系统配置表
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(255) UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建使用日志表
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id SERIAL PRIMARY KEY,
        token_id INTEGER REFERENCES tokens(id),
        model VARCHAR(255),
        input_tokens INTEGER,
        output_tokens INTEGER,
        total_tokens INTEGER,
        request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        response_time INTEGER,
        status VARCHAR(50),
        error_message TEXT
      )
    `);

    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tokens_auth_type ON tokens(auth_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_logs_token_id ON usage_logs(token_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_logs_request_time ON usage_logs(request_time)
    `);

    // 插入默认管理员账号（密码：admin123）
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    await client.query(`
      INSERT INTO users (username, password, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', defaultPassword, 'admin']);

    // 插入默认系统配置
    const defaultConfigs = [
      ['PORT', '8080', '服务端口'],
      ['LOG_LEVEL', 'info', '日志级别'],
      ['LOG_FORMAT', 'json', '日志格式'],
      ['GIN_MODE', 'release', 'Gin运行模式'],
      ['MAX_TOOL_DESCRIPTION_LENGTH', '10000', '工具描述最大长度']
    ];

    for (const [key, value, desc] of defaultConfigs) {
      await client.query(`
        INSERT INTO system_config (config_key, config_value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (config_key) DO NOTHING
      `, [key, value, desc]);
    }

    await client.query('COMMIT');
    console.log('✓ PostgreSQL 数据库初始化完成');
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('✗ PostgreSQL 数据库初始化失败:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * 执行查询（兼容 SQLite 的 db.get）
 */
async function get(sql, params = []) {
  const client = await pool.connect();
  try {
    // 将 SQLite 的 ? 占位符转换为 PostgreSQL 的 $1, $2...
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    const result = await client.query(pgSql, params);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * 执行查询（兼容 SQLite 的 db.all）
 */
async function all(sql, params = []) {
  const client = await pool.connect();
  try {
    // 将 SQLite 的 ? 占位符转换为 PostgreSQL 的 $1, $2...
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    const result = await client.query(pgSql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * 执行更新/插入（兼容 SQLite 的 db.run）
 */
async function run(sql, params = []) {
  const client = await pool.connect();
  try {
    // 将 SQLite 的 ? 占位符转换为 PostgreSQL 的 $1, $2...
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    // 处理 RETURNING 子句以获取插入的 ID
    if (pgSql.toUpperCase().includes('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }
    
    const result = await client.query(pgSql, params);
    
    return {
      lastID: result.rows[0]?.id || null,
      changes: result.rowCount
    };
  } finally {
    client.release();
  }
}

/**
 * 创建兼容 SQLite 的 db 对象
 */
const db = {
  get: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    get(sql, params)
      .then(row => callback(null, row))
      .catch(err => callback(err));
  },
  
  all: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    all(sql, params)
      .then(rows => callback(null, rows))
      .catch(err => callback(err));
  },
  
  run: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    run(sql, params)
      .then(result => {
        // 模拟 SQLite 的 this 上下文
        const context = {
          lastID: result.lastID,
          changes: result.changes
        };
        callback?.call(context, null);
      })
      .catch(err => callback?.(err));
  },
  
  serialize: (callback) => {
    // PostgreSQL 不需要 serialize，直接执行
    callback();
  },
  
  prepare: (sql) => {
    // 返回一个模拟的 prepared statement
    return {
      run: (...args) => {
        const callback = args.pop();
        const params = args;
        db.run(sql, params, callback);
      },
      finalize: (callback) => {
        callback?.(null);
      }
    };
  }
};

module.exports = { 
  db, 
  pool,
  initDatabase,
  get,
  all,
  run
};
