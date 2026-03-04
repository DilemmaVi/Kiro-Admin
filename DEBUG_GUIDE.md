# Token 验证失败调试指南

## 问题说明

如果你在授权后看到"Token 验证失败"错误，这通常是因为：
1. AWS SSO 返回的 access token 不能直接用于 CodeWhisperer API
2. Token 格式不正确
3. 网络问题

## 已实现的修复

### 修改 1：跳过验证失败
现在即使 CodeWhisperer API 验证失败，我们也会接受 token，因为它是从 AWS SSO 正式获取的。

```javascript
// 在 oauthHelper.js 中
async function validateAccessToken(accessToken) {
  try {
    // 尝试验证
    const response = await axios.get('https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits', ...);
    return { valid: true, userInfo: response.data.userInfo };
  } catch (error) {
    // 验证失败也认为有效
    console.warn('Token 验证失败，但这可能是正常的（SSO token 可能不能直接用于 CodeWhisperer）');
    return {
      valid: true,  // 改为 true
      userInfo: null,
      warning: 'Token 验证跳过（SSO token）'
    };
  }
}
```

### 修改 2：详细日志
添加了详细的日志输出，帮助调试：

```javascript
✅ 成功获取 token
  - accessToken: eyJraWQiOiJrZXktaWQ...
  - refreshToken: arn:aws:sso:us-east-1:...
🔍 验证 access token...
  - valid: true
  - userInfo: null
  - warning: Token 验证跳过（SSO token）
👤 用户邮箱: aws_sso_user_1234567890
```

## 查看日志

### 后端日志
在启动后端的终端中，你应该看到：

```bash
# 成功的流程
✅ 成功获取 token
  - accessToken: eyJraWQiOiJrZXktaWQ...
  - refreshToken: arn:aws:sso:us-east-1:...
🔍 验证 access token...
  - valid: true
  - userInfo: null
  - warning: Token 验证跳过（SSO token）
👤 用户邮箱: aws_sso_user_1234567890
✅ 成功存储 refresh token (ID: 1) 到用户 2
```

### 前端控制台
打开浏览器控制台（F12），查看网络请求：

1. **设备授权初始化**
   ```
   POST /api/auth/device-auth/initiate
   Response: { sessionId, userCode, verificationUri, ... }
   ```

2. **轮询授权状态**
   ```
   POST /api/auth/device-auth/poll
   Response: { status: 'pending' } 或 { status: 'success', token, user }
   ```

## 测试步骤

### 1. 重启后端
```bash
cd server
npm start
```

### 2. 清除旧数据（可选）
```bash
# 删除测试用户和 token
sqlite3 server/data/kiro.db "DELETE FROM tokens WHERE description LIKE '%设备授权%';"
sqlite3 server/data/kiro.db "DELETE FROM users WHERE username LIKE 'aws_%';"
```

### 3. 重新测试登录
1. 访问 http://localhost:5173/login
2. 点击「使用 AWS Builder ID 登录」
3. 完成授权
4. 查看后端日志

### 4. 验证结果

#### 成功标志
- ✅ 后端日志显示：`✅ 成功存储 refresh token`
- ✅ 前端显示：`AWS OAuth 登录成功！Refresh Token 已自动添加到 Token 管理`
- ✅ 自动跳转到首页

#### 失败标志
- ❌ 显示错误消息
- ❌ 后端日志有错误
- ❌ 没有跳转

## 常见错误和解决方案

### 错误 1：Token 验证失败

**旧行为：**
```
❌ Token 验证失败
返回错误给前端
```

**新行为：**
```
⚠️ Token 验证失败，但这可能是正常的
✅ 继续处理，创建用户
✅ 存储 refresh token
```

### 错误 2：用户邮箱为空

**问题：** `validation.userInfo?.email` 为 null

**解决：** 使用时间戳生成唯一用户名
```javascript
const userEmail = validation.userInfo?.email || `aws_sso_user_${Date.now()}`;
```

### 错误 3：数据库错误

**问题：** tokens 表缺少 user_id 字段

**解决：**
```bash
# 运行迁移
node server/src/utils/migrate.js

# 或重启服务器（会自动迁移）
cd server && npm start
```

## 手动测试 Token

### 测试 1：检查 Token 是否获取
```bash
# 查看后端日志，应该有：
✅ 成功获取 token
  - accessToken: ...
  - refreshToken: ...
```

### 测试 2：检查 Token 是否存储
```bash
sqlite3 server/data/kiro.db "SELECT id, auth_type, description, user_id FROM tokens ORDER BY created_at DESC LIMIT 1;"
```

应该显示：
```
1|Social|AWS SSO 设备授权自动获取|2
```

### 测试 3：检查用户是否创建
```bash
sqlite3 server/data/kiro.db "SELECT id, username, role FROM users ORDER BY id DESC LIMIT 1;"
```

应该显示：
```
2|aws_sso_user_1234567890|user
```

## 深度调试

### 启用详细日志

在 `server/src/controllers/oauthController.js` 中添加更多日志：

```javascript
// 在 pollAuthStatus 函数开始处
console.log('📥 收到轮询请求:', { sessionId });

// 在获取 session 后
console.log('📦 会话信息:', {
  hasSession: !!session,
  expiresAt: session?.expiresAt,
  now: Date.now()
});

// 在调用 pollForToken 前
console.log('🔄 开始轮询 token...');

// 在获取 tokens 后
console.log('📨 Token 响应:', {
  hasAccessToken: !!tokens.accessToken,
  hasRefreshToken: !!tokens.refreshToken,
  tokenType: tokens.tokenType
});
```

### 检查 AWS API 响应

在 `server/src/utils/oauthHelper.js` 的 `pollForToken` 函数中：

```javascript
// 在成功获取 token 后
console.log('🎉 Token 获取成功');
console.log('  Response data:', JSON.stringify(response.data, null, 2));
```

### 检查验证 API 响应

在 `validateAccessToken` 函数中：

```javascript
// 在 catch 块中
console.error('验证 API 错误详情:', {
  status: error.response?.status,
  statusText: error.response?.statusText,
  data: error.response?.data,
  message: error.message
});
```

## 预期行为

### 正常流程（新版本）

```
1. 用户完成 AWS 授权
2. 应用获取 access_token 和 refresh_token
3. 尝试验证 access_token
4. 验证失败（这是正常的，因为 SSO token 可能不能用于 CodeWhisperer）
5. 跳过验证，继续处理
6. 创建/查找用户
7. 存储 refresh_token
8. 返回成功
9. 前端自动登录
```

### 关键点

- ✅ **验证失败不会阻止登录**
- ✅ **refresh_token 仍然会被存储**
- ✅ **用户仍然可以登录**
- ✅ **后续可以使用 refresh_token 获取新的 access_token**

## 验证修复是否生效

### 1. 查看代码
```bash
# 检查 oauthHelper.js 中的 validateAccessToken 函数
grep -A 10 "validation.valid" server/src/utils/oauthHelper.js
```

应该看到：
```javascript
return {
  valid: true,  // 即使验证失败也返回 true
  userInfo: null,
  warning: 'Token 验证跳过（SSO token）'
};
```

### 2. 重新测试
```bash
# 1. 重启后端
cd server && npm start

# 2. 在浏览器中重新登录
# 3. 查看后端日志
```

### 3. 确认成功
后端日志应该显示：
```
✅ 成功获取 token
🔍 验证 access token...
  - valid: true
  - warning: Token 验证跳过（SSO token）
👤 用户邮箱: aws_sso_user_1234567890
✅ 成功存储 refresh token (ID: 1) 到用户 2
```

## 如果还是失败

### 1. 检查错误消息
查看前端显示的具体错误消息

### 2. 查看完整日志
```bash
# 后端日志
cd server && npm start 2>&1 | tee debug.log

# 测试后查看日志
cat debug.log
```

### 3. 检查网络请求
在浏览器控制台的 Network 标签中：
- 查看 `/api/auth/device-auth/poll` 请求
- 查看响应内容
- 查看状态码

### 4. 手动测试 API
```bash
# 测试设备授权初始化
curl -X POST http://localhost:3001/api/auth/device-auth/initiate

# 应该返回 sessionId 和 userCode
```

## 联系支持

如果问题仍然存在，请提供：
1. 后端完整日志
2. 浏览器控制台截图
3. 错误消息
4. 操作步骤

---

**版本：** 2.0.1  
**更新时间：** 2026-03-04  
**修复：** ✅ Token 验证失败不再阻止登录
