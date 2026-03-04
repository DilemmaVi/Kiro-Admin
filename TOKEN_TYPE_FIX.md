# Token 类型修复说明

## 问题分析

### 原始问题
用户报告："Token无效: Social Token刷新失败: Request failed with status code 401"

### 根本原因
1. 我们通过 **AWS SSO OIDC** 获取 refresh token
2. 但存储时标记为 `auth_type = 'Social'`
3. 检测时尝试用 Kiro 的 Social 端点刷新：`https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken`
4. 这个端点不接受 SSO OIDC 的 refresh token，返回 401

### Token 类型对比

| 类型 | 获取方式 | 刷新端点 | 需要的参数 |
|------|---------|---------|-----------|
| Social | Kiro 客户端 | `https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken` | refreshToken |
| IdC | AWS SSO OIDC | `https://oidc.us-east-1.amazonaws.com/token` | refreshToken, clientId, clientSecret |

## 解决方案

### 修改存储逻辑

**修改前：**
```javascript
db.run(
  `INSERT INTO tokens (auth_type, refresh_token, description, user_id)
   VALUES (?, ?, ?, ?)`,
  ['Social', tokens.refreshToken, 'AWS SSO 设备授权自动获取', userId]
);
```

**修改后：**
```javascript
db.run(
  `INSERT INTO tokens (auth_type, refresh_token, client_id, client_secret, description, user_id)
   VALUES (?, ?, ?, ?, ?, ?)`,
  ['IdC', tokens.refreshToken, session.clientId, session.clientSecret, 'AWS SSO 设备授权自动获取', userId]
);
```

### 关键变更

1. **auth_type**: `'Social'` → `'IdC'`
2. **添加 client_id**: 存储 OIDC 客户端 ID
3. **添加 client_secret**: 存储 OIDC 客户端密钥

## 刷新流程

### IdC Token 刷新（正确）

```javascript
// 在 awsApi.js 中
const refreshIdCToken = async (refreshToken, clientId, clientSecret) => {
  const response = await axios.post(
    'https://oidc.us-east-1.amazonaws.com/token',
    {
      clientId: clientId,
      clientSecret: clientSecret,
      grantType: 'refresh_token',
      refreshToken: refreshToken
    }
  );
  
  return {
    accessToken: response.data.accessToken,
    expiresIn: response.data.expiresIn
  };
};
```

### 检测流程

```javascript
// 在 tokenController.js 中
if (token.auth_type === 'Social') {
  tokenResult = await awsApi.refreshSocialToken(token.refresh_token);
} else if (token.auth_type === 'IdC') {
  tokenResult = await awsApi.refreshIdCToken(
    token.refresh_token,
    token.client_id,
    token.client_secret
  );
}
```

## 数据库记录

### 修改后的记录格式

```sql
INSERT INTO tokens (
  auth_type,
  refresh_token,
  client_id,
  client_secret,
  description,
  user_id
) VALUES (
  'IdC',
  'eyJraWQiOiJrZXktaWQiLCJhbGciOiJSUzI1NiJ9...',
  'client-id-from-registration',
  'client-secret-from-registration',
  'AWS SSO 设备授权自动获取',
  2
);
```

### 查询示例

```bash
sqlite3 server/data/kiro.db "SELECT id, auth_type, client_id IS NOT NULL as has_client_id, description FROM tokens WHERE description LIKE '%设备授权%';"
```

应该显示：
```
1|IdC|1|AWS SSO 设备授权自动获取
```

## 测试步骤

### 1. 清除旧数据
```bash
# 删除旧的 Social 类型的 token
sqlite3 server/data/kiro.db "DELETE FROM tokens WHERE auth_type = 'Social' AND description LIKE '%设备授权%';"
```

### 2. 重启后端
```bash
cd server
npm start
```

### 3. 重新登录
1. 访问 http://localhost:5173/login
2. 点击「使用 AWS Builder ID 登录」
3. 完成授权

### 4. 验证存储
```bash
# 查看新插入的 token
sqlite3 server/data/kiro.db "SELECT id, auth_type, client_id IS NOT NULL, client_secret IS NOT NULL, description FROM tokens ORDER BY created_at DESC LIMIT 1;"
```

应该显示：
```
1|IdC|1|1|AWS SSO 设备授权自动获取
```

### 5. 测试检测功能
1. 进入「Token 管理」页面
2. 找到自动添加的 Token
3. 点击「检测」按钮
4. 应该显示成功（不再是 401 错误）

## 后端日志

### 成功的日志输出

```
✅ 成功获取 token
  - accessToken: eyJraWQiOiJrZXktaWQi...
  - refreshToken: eyJraWQiOiJrZXktaWQi...
🔍 验证 access token...
  - valid: true
  - warning: Token 验证跳过（SSO token）
👤 用户邮箱: aws_sso_user_1234567890
✅ 成功存储 refresh token (ID: 1) 到用户 2
  - 认证类型: IdC (SSO OIDC)
  - Client ID: client-id-from-reg...
```

## 客户端信息管理

### 客户端注册
```javascript
// 在 oauthHelper.js 中
const registerClient = async () => {
  const response = await axios.post(
    'https://oidc.us-east-1.amazonaws.com/client/register',
    {
      clientName: 'kiro-web-client',
      clientType: 'public',
      grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token']
    }
  );
  
  return {
    clientId: response.data.clientId,
    clientSecret: response.data.clientSecret,
    clientSecretExpiresAt: response.data.clientSecretExpiresAt
  };
};
```

### 客户端缓存
```javascript
// 在 oauthController.js 中
let clientInfo = oauthSessions.get('client_info');

if (!clientInfo || Date.now() > clientInfo.expiresAt) {
  // 重新注册
  const registration = await registerClient();
  clientInfo = {
    clientId: registration.clientId,
    clientSecret: registration.clientSecret,
    expiresAt: registration.clientSecretExpiresAt * 1000
  };
  oauthSessions.set('client_info', clientInfo);
}
```

## 安全考虑

### Client Secret 存储
- ✅ 存储在数据库中（加密存储更好）
- ✅ 不暴露给前端
- ✅ 只在刷新 token 时使用

### 建议改进
1. **加密存储**: 使用加密算法存储 client_secret
2. **定期轮换**: 定期重新注册客户端
3. **访问控制**: 限制谁可以查看 client_secret

## 常见问题

### Q1: 为什么不继续使用 Social 类型？
**A:** Social 类型是 Kiro 客户端专用的，使用不同的刷新端点。我们通过 SSO OIDC 获取的 token 必须用 IdC 类型。

### Q2: client_secret 会过期吗？
**A:** 是的，AWS 返回 `clientSecretExpiresAt` 时间戳。我们的代码会检查并在过期前重新注册。

### Q3: 旧的 Social 类型 token 怎么办？
**A:** 需要手动删除或重新授权。新的授权会创建 IdC 类型的 token。

### Q4: 可以同时有 Social 和 IdC 类型的 token 吗？
**A:** 可以。它们使用不同的刷新端点，互不干扰。

## 验证修复

### 检查清单
- [ ] 后端代码已更新
- [ ] 重启后端服务
- [ ] 清除旧的 Social 类型 token
- [ ] 重新完成 OAuth 登录
- [ ] 数据库中 token 类型为 'IdC'
- [ ] client_id 和 client_secret 已存储
- [ ] Token 检测功能正常
- [ ] 不再出现 401 错误

### 成功标志
```
✅ auth_type = 'IdC'
✅ client_id 不为 NULL
✅ client_secret 不为 NULL
✅ Token 检测显示有效
✅ 可以正常刷新 token
```

---

**版本：** 2.0.2  
**更新时间：** 2026-03-04  
**修复：** ✅ Token 类型从 Social 改为 IdC，添加客户端凭证
