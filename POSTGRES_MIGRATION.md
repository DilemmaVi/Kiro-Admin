# PostgreSQL 数据库迁移指南

本项目支持 SQLite 和 PostgreSQL 两种数据库，可以通过环境变量轻松切换。

## 🎯 快速开始

### 1. 安装 PostgreSQL 依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

根据你提供的数据库信息，在 `server/.env` 文件中添加：

```env
# 数据库类型：sqlite 或 postgres
DB_TYPE=postgres

# PostgreSQL 配置
DB_POSTGRESDB_HOST=aws-0-us-west-1.pooler.supabase.com
DB_POSTGRESDB_PORT=6543
DB_POSTGRESDB_DATABASE=postgres
DB_POSTGRESDB_USER=postgres.yzbxyywztuzalskxtiod
DB_POSTGRESDB_PASSWORD=H*fbnN5xhv7#f3v
DB_POSTGRESDB_SCHEMA=public
DB_POSTGRESDB_SSL=true
```

### 3. 初始化 PostgreSQL 数据库

首次使用时，需要初始化数据库表结构：

```bash
cd server
node -e "require('./src/config/database-pg').initDatabase().then(() => process.exit(0))"
```

### 4. （可选）从 SQLite 迁移数据

如果你已经有 SQLite 数据库，可以迁移数据到 PostgreSQL：

```bash
cd server
node src/utils/migrate-to-postgres.js
```

迁移脚本会：
- ✅ 自动创建 PostgreSQL 表结构
- ✅ 迁移所有用户数据
- ✅ 迁移所有 token 配置
- ✅ 迁移 API keys
- ✅ 迁移系统配置
- ✅ 迁移使用日志

### 5. 启动应用

```bash
cd server
npm start
```

## 📊 数据库表结构

### users - 用户表
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### tokens - Token 配置表
```sql
CREATE TABLE tokens (
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
);
```

### api_keys - API 密钥表
```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(255) NOT NULL,
  key_value VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  disabled INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### system_config - 系统配置表
```sql
CREATE TABLE system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(255) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### usage_logs - 使用日志表
```sql
CREATE TABLE usage_logs (
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
);
```

## 🔄 切换数据库

### 切换到 PostgreSQL
```env
DB_TYPE=postgres
```

### 切换回 SQLite
```env
DB_TYPE=sqlite
```

重启应用即可生效。

## 🛠️ 技术实现

### 数据库适配器
项目使用适配器模式，根据 `DB_TYPE` 环境变量自动选择数据库：

```javascript
// server/src/config/database-adapter.js
const dbType = process.env.DB_TYPE || 'sqlite';

if (dbType === 'postgres') {
  module.exports = require('./database-pg');
} else {
  module.exports = require('./database');
}
```

### API 兼容性
PostgreSQL 模块提供了与 SQLite 兼容的 API：

```javascript
// 兼容 SQLite 的回调风格
db.get(sql, params, (err, row) => { ... });
db.all(sql, params, (err, rows) => { ... });
db.run(sql, params, function(err) {
  console.log(this.lastID); // 插入的 ID
});
```

### 占位符转换
自动将 SQLite 的 `?` 占位符转换为 PostgreSQL 的 `$1, $2...`：

```javascript
// SQLite 风格
SELECT * FROM users WHERE id = ?

// 自动转换为 PostgreSQL 风格
SELECT * FROM users WHERE id = $1
```

## 📝 注意事项

1. **SSL 连接**
   - 生产环境建议启用 SSL：`DB_POSTGRESDB_SSL=true`
   - Supabase 等云服务通常需要 SSL

2. **连接池**
   - PostgreSQL 使用连接池，默认最大 20 个连接
   - 可根据需要调整 `max` 参数

3. **数据类型差异**
   - SQLite 的 `INTEGER` → PostgreSQL 的 `SERIAL`
   - SQLite 的 `DATETIME` → PostgreSQL 的 `TIMESTAMP`
   - SQLite 的 `TEXT` → PostgreSQL 的 `TEXT` 或 `VARCHAR`

4. **自增 ID**
   - PostgreSQL 使用序列（SEQUENCE）管理自增 ID
   - 迁移后会自动更新序列值

5. **事务处理**
   - PostgreSQL 的事务更严格
   - 建议在批量操作时使用事务

## 🔍 故障排查

### 连接失败
```bash
# 检查 PostgreSQL 是否可访问
psql -h aws-0-us-west-1.pooler.supabase.com -p 6543 -U postgres.yzbxyywztuzalskxtiod -d postgres
```

### 查看日志
```bash
# 应用启动时会显示数据库连接信息
npm start
```

### 测试连接
```bash
# 运行测试脚本
node -e "require('./src/config/database-pg').pool.query('SELECT NOW()').then(r => console.log('连接成功:', r.rows[0])).catch(e => console.error('连接失败:', e))"
```

## 📚 参考资料

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [node-postgres (pg) 文档](https://node-postgres.com/)
- [Supabase 文档](https://supabase.com/docs)

## 🎉 完成

现在你的应用已经支持 PostgreSQL 数据库了！

如有问题，请查看应用日志或联系技术支持。
