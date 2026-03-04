/**
 * SQLite 到 PostgreSQL 数据迁移脚本
 * 
 * 使用方法：
 * 1. 确保 PostgreSQL 数据库已创建并可连接
 * 2. 配置 .env 文件中的 PostgreSQL 连接信息
 * 3. 运行: node src/utils/migrate-to-postgres.js
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// SQLite 配置
const sqliteDbPath = process.env.DB_PATH || path.join(__dirname, '../../data/kiro.db');
const sqliteDb = new sqlite3.Database(sqliteDbPath);

// PostgreSQL 配置
const pgPool = new Pool({
  host: process.env.DB_POSTGRESDB_HOST || 'localhost',
  port: parseInt(process.env.DB_POSTGRESDB_PORT || '5432'),
  database: process.env.DB_POSTGRESDB_DATABASE || 'postgres',
  user: process.env.DB_POSTGRESDB_USER || 'postgres',
  password: process.env.DB_POSTGRESDB_PASSWORD || '',
  ssl: process.env.DB_POSTGRESDB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * 从 SQLite 读取数据
 */
function readFromSQLite(tableName) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * 迁移用户表
 */
async function migrateUsers(client) {
  console.log('开始迁移 users 表...');
  
  const users = await readFromSQLite('users');
  console.log(`  找到 ${users.length} 条用户记录`);
  
  for (const user of users) {
    await client.query(`
      INSERT INTO users (id, username, password, role, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role
    `, [user.id, user.username, user.password, user.role, user.created_at]);
  }
  
  // 更新序列
  if (users.length > 0) {
    const maxId = Math.max(...users.map(u => u.id));
    await client.query(`SELECT setval('users_id_seq', $1)`, [maxId]);
  }
  
  console.log('  users 表迁移完成');
}

/**
 * 迁移 tokens 表
 */
async function migrateTokens(client) {
  console.log('开始迁移 tokens 表...');
  
  const tokens = await readFromSQLite('tokens');
  console.log(`  找到 ${tokens.length} 条 token 记录`);
  
  for (const token of tokens) {
    await client.query(`
      INSERT INTO tokens (
        id, auth_type, refresh_token, client_id, client_secret,
        description, disabled, usage_count, last_used, user_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        auth_type = EXCLUDED.auth_type,
        refresh_token = EXCLUDED.refresh_token,
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        description = EXCLUDED.description,
        disabled = EXCLUDED.disabled,
        usage_count = EXCLUDED.usage_count,
        last_used = EXCLUDED.last_used,
        user_id = EXCLUDED.user_id,
        updated_at = EXCLUDED.updated_at
    `, [
      token.id, token.auth_type, token.refresh_token, token.client_id,
      token.client_secret, token.description, token.disabled,
      token.usage_count, token.last_used, token.user_id,
      token.created_at, token.updated_at
    ]);
  }
  
  // 更新序列
  if (tokens.length > 0) {
    const maxId = Math.max(...tokens.map(t => t.id));
    await client.query(`SELECT setval('tokens_id_seq', $1)`, [maxId]);
  }
  
  console.log('  tokens 表迁移完成');
}

/**
 * 迁移 api_keys 表
 */
async function migrateApiKeys(client) {
  console.log('开始迁移 api_keys 表...');
  
  try {
    const apiKeys = await readFromSQLite('api_keys');
    console.log(`  找到 ${apiKeys.length} 条 API key 记录`);
    
    for (const key of apiKeys) {
      await client.query(`
        INSERT INTO api_keys (id, key_name, key_value, description, disabled, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (key_value) DO UPDATE SET
          key_name = EXCLUDED.key_name,
          description = EXCLUDED.description,
          disabled = EXCLUDED.disabled
      `, [key.id, key.key_name, key.key_value, key.description, key.disabled, key.created_at]);
    }
    
    // 更新序列
    if (apiKeys.length > 0) {
      const maxId = Math.max(...apiKeys.map(k => k.id));
      await client.query(`SELECT setval('api_keys_id_seq', $1)`, [maxId]);
    }
    
    console.log('  api_keys 表迁移完成');
  } catch (error) {
    console.log('  api_keys 表不存在或为空，跳过');
  }
}

/**
 * 迁移 system_config 表
 */
async function migrateSystemConfig(client) {
  console.log('开始迁移 system_config 表...');
  
  try {
    const configs = await readFromSQLite('system_config');
    console.log(`  找到 ${configs.length} 条配置记录`);
    
    for (const config of configs) {
      await client.query(`
        INSERT INTO system_config (id, config_key, config_value, description, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (config_key) DO UPDATE SET
          config_value = EXCLUDED.config_value,
          description = EXCLUDED.description,
          updated_at = EXCLUDED.updated_at
      `, [config.id, config.config_key, config.config_value, config.description, config.updated_at]);
    }
    
    // 更新序列
    if (configs.length > 0) {
      const maxId = Math.max(...configs.map(c => c.id));
      await client.query(`SELECT setval('system_config_id_seq', $1)`, [maxId]);
    }
    
    console.log('  system_config 表迁移完成');
  } catch (error) {
    console.log('  system_config 表不存在或为空，跳过');
  }
}

/**
 * 迁移 usage_logs 表
 */
async function migrateUsageLogs(client) {
  console.log('开始迁移 usage_logs 表...');
  
  try {
    const logs = await readFromSQLite('usage_logs');
    console.log(`  找到 ${logs.length} 条使用日志记录`);
    
    // 分批插入，避免一次性插入太多数据
    const batchSize = 1000;
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      
      for (const log of batch) {
        await client.query(`
          INSERT INTO usage_logs (
            id, token_id, model, input_tokens, output_tokens,
            total_tokens, request_time, response_time, status, error_message
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [
          log.id, log.token_id, log.model, log.input_tokens, log.output_tokens,
          log.total_tokens, log.request_time, log.response_time, log.status, log.error_message
        ]);
      }
      
      console.log(`  已迁移 ${Math.min(i + batchSize, logs.length)}/${logs.length} 条日志`);
    }
    
    // 更新序列
    if (logs.length > 0) {
      const maxId = Math.max(...logs.map(l => l.id));
      await client.query(`SELECT setval('usage_logs_id_seq', $1)`, [maxId]);
    }
    
    console.log('  usage_logs 表迁移完成');
  } catch (error) {
    console.log('  usage_logs 表不存在或为空，跳过');
  }
}

/**
 * 主迁移函数
 */
async function migrate() {
  console.log('========================================');
  console.log('  SQLite 到 PostgreSQL 数据迁移工具');
  console.log('========================================');
  console.log('');
  console.log('SQLite 数据库:', sqliteDbPath);
  console.log('PostgreSQL 数据库:', `${process.env.DB_POSTGRESDB_HOST}:${process.env.DB_POSTGRESDB_PORT}/${process.env.DB_POSTGRESDB_DATABASE}`);
  console.log('');
  
  const client = await pgPool.connect();
  
  try {
    // 先初始化 PostgreSQL 表结构
    console.log('初始化 PostgreSQL 表结构...');
    const { initDatabase } = require('../config/database-pg');
    await initDatabase();
    console.log('');
    
    // 开始事务
    await client.query('BEGIN');
    
    // 迁移各个表
    await migrateUsers(client);
    await migrateTokens(client);
    await migrateApiKeys(client);
    await migrateSystemConfig(client);
    await migrateUsageLogs(client);
    
    // 提交事务
    await client.query('COMMIT');
    
    console.log('');
    console.log('========================================');
    console.log('  数据迁移完成！');
    console.log('========================================');
    console.log('');
    console.log('下一步：');
    console.log('1. 在 .env 文件中设置 DB_TYPE=postgres');
    console.log('2. 重启应用程序');
    console.log('');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('');
    console.error('========================================');
    console.error('  数据迁移失败！');
    console.error('========================================');
    console.error('');
    console.error('错误信息:', error.message);
    console.error('');
    throw error;
  } finally {
    client.release();
    sqliteDb.close();
    await pgPool.end();
  }
}

// 运行迁移
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { migrate };
