/**
 * 数据库适配器
 * 根据环境变量 DB_TYPE 自动选择 SQLite 或 PostgreSQL
 */

const dbType = process.env.DB_TYPE || 'sqlite'; // 默认使用 sqlite

let dbModule;

if (dbType === 'postgres' || dbType === 'postgresql') {
  console.log('使用 PostgreSQL 数据库');
  dbModule = require('./database-pg');
} else {
  console.log('使用 SQLite 数据库');
  dbModule = require('./database');
}

module.exports = dbModule;
