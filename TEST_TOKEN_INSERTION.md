# Token 自动插入测试指南

## 功能说明

当用户通过 AWS SSO 设备授权登录成功后，系统会自动：

1. ✅ 获取 refresh token
2. ✅ 创建或查找用户账号
3. ✅ 将 refresh token 插入到 tokens 表
4. ✅ 关联到用户账号（user_id）
5. ✅ 返回登录成功信息

## 数据库记录

### tokens 表结构

```sql
CREATE TABLE tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auth_type TEXT NOT NULL,              -- 'Social'
  refresh_token TEXT NOT NULL,          -- AWS refresh token
  client_id TEXT,                       -- NULL (Social 认证不需要)
  client_secret TEXT,                   -- NULL (Social 认证不需要)
  description TEXT,                     -- 'AWS SSO 设备授权自动获取'
  disabled INTEGER DEFAULT 0,           -- 0 (启用)
  usage_count INTEGER DEFAULT 0,        -- 0
  last_used DATETIME,                   -- NULL
  user_id INTEGER,                      -- 关联的用户 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 插入的记录示例

```json
{
  "id": 1,
  "auth_type": "Social",
  "refresh_token": "arn:aws:sso:us-east-1:...",
  "client_id": null,
  "client_secret": null,
  "description": "AWS SSO 设备授权自动获取",
  "disabled": 0,
  "usage_count": 0,
  "last_used": null,
  "user_id": 2,
  "created_at": "2026-03-04 10:30:00",
  "updated_at": "2026-03-04 10:30:00"
}
```

## 测试步骤

### 1. 准备环境

```bash
# 启动后端
cd server
npm start

# 启动前端（新终端）
npm run dev
```

### 2. 执行登录

1. 访问 http://localhost:5173/login
2. 点击「使用 AWS Builder ID 登录」
3. 复制验证码
4. 打开授权页面
5. 输入验证码并授权
6. 等待自动登录

### 3. 验证 Token 插入

#### 方法 1：查看前端提示

登录成功后应该看到：
```
✓ AWS OAuth 登录成功！Refresh Token 已自动添加到 Token 管理
```

#### 方法 2：查看后端日志

后端控制台应该显示：
```
✅ 成功存储 refresh token (ID: 1) 到用户 2
```

#### 方法 3：查看 Token 管理页面

1. 登录后进入「Token 管理」页面
2. 应该看到新增的 Token 记录：
   - 认证类型：Social
   - 描述：AWS SSO 设备授权自动获取
   - 状态：启用

#### 方法 4：直接查询数据库

```bash
# 进入数据库
sqlite3 server/data/kiro.db

# 查询 tokens 表
SELECT id, auth_type, description, user_id, created_at 
FROM tokens 
ORDER BY created_at DESC 
LIMIT 5;

# 查看完整记录
SELECT * FROM tokens WHERE description LIKE '%设备授权%';

# 退出
.quit
```

### 4. 验证 Token 有效性

在 Token 管理页面：
1. 找到自动添加的 Token
2. 点击「检测」按钮
3. 查看有效性和用量信息

## 代码流程

### 后端处理流程

```javascript
// 1. 获取 token
const tokens = await pollForToken(...);

// 2. 验证 token
const validation = await validateAccessToken(tokens.accessToken);

// 3. 查找或创建用户
db.get('SELECT * FROM users WHERE username = ?', [userEmail], (err, user) => {
  
  // 4. 插入 token
  db.run(
    `INSERT INTO tokens (auth_type, refresh_token, description, user_id)
     VALUES (?, ?, ?, ?)`,
    ['Social', tokens.refreshToken, 'AWS SSO 设备授权自动获取', userId],
    function (err) {
      if (err) {
        console.error('❌ 存储 refresh token 失败:', err);
        return res.status(500).json({ error: '存储 token 失败' });
      }
      
      const tokenId = this.lastID;
      console.log(`✅ 成功存储 refresh token (ID: ${tokenId}) 到用户 ${userId}`);
      
      // 5. 返回成功信息
      res.json({
        status: 'success',
        token: jwtToken,
        user: { ... },
        tokenInfo: {
          id: tokenId,
          description: 'AWS SSO 设备授权自动获取',
          created: true
        }
      });
    }
  );
});
```

### 前端处理流程

```typescript
// 1. 轮询授权状态
const response = await api.post('/api/auth/device-auth/poll', { sessionId });

// 2. 检查响应
if (response.data.status === 'success') {
  const { token, user, tokenInfo } = response.data;
  
  // 3. 登录
  login(token, user);
  
  // 4. 显示成功消息
  if (tokenInfo?.created) {
    message.success('AWS OAuth 登录成功！Refresh Token 已自动添加到 Token 管理');
  }
  
  // 5. 跳转到首页
  navigate('/');
}
```

## 错误处理

### 1. Token 插入失败

**错误日志：**
```
❌ 存储 refresh token 失败: SQLITE_CONSTRAINT: UNIQUE constraint failed
```

**原因：**
- refresh_token 已存在（如果有唯一约束）
- 数据库连接失败

**解决：**
- 检查数据库表结构
- 查看是否有重复的 token
- 检查数据库权限

### 2. 用户创建失败

**错误日志：**
```
用户创建失败
```

**原因：**
- 用户名已存在
- 数据库错误

**解决：**
- 检查用户表
- 查看后端日志详情

### 3. Token 验证失败

**错误信息：**
```
Token 验证失败
```

**原因：**
- access_token 无效
- AWS API 不可用

**解决：**
- 重新授权
- 检查网络连接

## 数据验证

### SQL 查询示例

```sql
-- 查看所有自动添加的 token
SELECT 
  t.id,
  t.auth_type,
  t.description,
  t.disabled,
  t.created_at,
  u.username
FROM tokens t
LEFT JOIN users u ON t.user_id = u.id
WHERE t.description LIKE '%设备授权%'
ORDER BY t.created_at DESC;

-- 统计每个用户的 token 数量
SELECT 
  u.username,
  COUNT(t.id) as token_count
FROM users u
LEFT JOIN tokens t ON u.id = t.user_id
GROUP BY u.id;

-- 查看最近添加的 token
SELECT 
  id,
  auth_type,
  SUBSTR(refresh_token, 1, 30) || '...' as token_preview,
  description,
  created_at
FROM tokens
ORDER BY created_at DESC
LIMIT 10;
```

## 预期结果

### 成功场景

1. ✅ 后端日志显示：`✅ 成功存储 refresh token (ID: X) 到用户 Y`
2. ✅ 前端显示：`AWS OAuth 登录成功！Refresh Token 已自动添加到 Token 管理`
3. ✅ Token 管理页面显示新记录
4. ✅ 数据库中有对应记录
5. ✅ Token 检测显示有效

### 失败场景

1. ❌ 后端日志显示错误
2. ❌ 前端显示：`存储 token 失败`
3. ❌ Token 管理页面无新记录
4. ❌ 数据库中无对应记录

## 调试技巧

### 1. 启用详细日志

在 `server/src/controllers/oauthController.js` 中添加：

```javascript
console.log('🔍 开始存储 token...');
console.log('  - auth_type:', 'Social');
console.log('  - refresh_token:', tokens.refreshToken.substring(0, 30) + '...');
console.log('  - user_id:', userId);
```

### 2. 检查数据库连接

```javascript
db.get('SELECT 1', [], (err, row) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err);
  } else {
    console.log('✅ 数据库连接正常');
  }
});
```

### 3. 验证 Token 格式

```javascript
console.log('Token 类型:', typeof tokens.refreshToken);
console.log('Token 长度:', tokens.refreshToken?.length);
console.log('Token 前缀:', tokens.refreshToken?.substring(0, 10));
```

## 常见问题

### Q: Token 插入成功但在管理页面看不到？

A: 检查：
1. 是否刷新了页面
2. Token 是否被禁用（disabled = 1）
3. 是否有筛选条件

### Q: 同一个用户多次登录会创建多个 Token 吗？

A: 是的，每次 OAuth 登录都会创建新的 Token 记录。如果需要避免重复，可以在插入前检查是否已存在。

### Q: 如何删除测试产生的 Token？

A: 
```sql
-- 删除所有测试 token
DELETE FROM tokens WHERE description LIKE '%设备授权%';

-- 或在管理页面手动删除
```

## 性能考虑

- Token 插入是异步操作，不会阻塞登录流程
- 使用数据库事务确保数据一致性
- 建议定期清理过期或无效的 Token

## 安全建议

1. ✅ refresh_token 存储在数据库中，不暴露给前端
2. ✅ 只返回 token ID 和描述信息
3. ✅ 使用 JWT 进行用户认证
4. ✅ Token 关联到特定用户，防止越权访问

---

**测试完成标准：**
- [ ] 后端日志显示成功
- [ ] 前端提示显示成功
- [ ] Token 管理页面有新记录
- [ ] 数据库查询有对应记录
- [ ] Token 检测显示有效

**版本：** 2.0.0  
**更新时间：** 2026-03-04
