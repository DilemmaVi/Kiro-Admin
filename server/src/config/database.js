const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/kiro.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  } else {
    console.log('数据库连接成功');
  }
});

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 创建用户表
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建users表失败:', err);
      });

      // 创建Token配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          auth_type TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          client_id TEXT,
          client_secret TEXT,
          description TEXT,
          disabled INTEGER DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          last_used DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建tokens表失败:', err);
      });

      // 创建API密钥表
      db.run(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key_name TEXT NOT NULL,
          key_value TEXT UNIQUE NOT NULL,
          description TEXT,
          disabled INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建api_keys表失败:', err);
      });

      // 创建系统配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS system_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_key TEXT UNIQUE NOT NULL,
          config_value TEXT NOT NULL,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建system_config表失败:', err);
      });

      // 创建使用日志表
      db.run(`
        CREATE TABLE IF NOT EXISTS usage_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_id INTEGER,
          model TEXT,
          input_tokens INTEGER,
          output_tokens INTEGER,
          total_tokens INTEGER,
          request_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          response_time INTEGER,
          status TEXT,
          error_message TEXT,
          FOREIGN KEY (token_id) REFERENCES tokens(id)
        )
      `, (err) => {
        if (err) console.error('创建usage_logs表失败:', err);
      });

      // 插入默认管理员账号（密码：admin123）
      const defaultPassword = bcrypt.hashSync('admin123', 10);

      db.run(`
        INSERT OR IGNORE INTO users (username, password, role)
        VALUES ('admin', ?, 'admin')
      `, [defaultPassword], (err) => {
        if (err) console.error('插入默认用户失败:', err);
      });

      // 插入默认系统配置
      const defaultConfigs = [
        ['PORT', '8080', '服务端口'],
        ['LOG_LEVEL', 'info', '日志级别'],
        ['LOG_FORMAT', 'json', '日志格式'],
        ['GIN_MODE', 'release', 'Gin运行模式'],
        ['MAX_TOOL_DESCRIPTION_LENGTH', '10000', '工具描述最大长度']
      ];

      const stmt = db.prepare(`
        INSERT OR IGNORE INTO system_config (config_key, config_value, description)
        VALUES (?, ?, ?)
      `);

      defaultConfigs.forEach(config => {
        stmt.run(config);
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('数据库初始化失败:', err);
          reject(err);
        } else {
          console.log('数据库初始化完成');
          resolve();
        }
      });
    });
  });
}

module.exports = { db, initDatabase, dbPath };
