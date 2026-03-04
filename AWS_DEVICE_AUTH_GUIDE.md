# AWS SSO 设备授权流程说明

## 重要更新

经过调查，Kiro 使用的是 **AWS SSO Device Authorization Grant** 流程，而不是标准的 OAuth 授权码流程。这是一个专为设备和命令行工具设计的授权方式。

## 设备授权流程

### 流程图

```
用户点击登录
    ↓
注册 OIDC 客户端
    ↓
启动设备授权
    ↓
显示验证码和授权 URL
    ↓
用户在浏览器中访问 URL
    ↓
用户输入验证码
    ↓
用户完成 AWS Builder ID 授权
    ↓
应用轮询检查授权状态
    ↓
获取 access_token 和 refresh_token
    ↓
自动登录
```

### 与标准 OAuth 的区别

| 特性 | 标准 OAuth | 设备授权流程 |
|------|-----------|------------|
| 适用场景 | Web 应用 | 设备/CLI |
| 重定向 | 需要 | 不需要 |
| 用户体验 | 直接跳转 | 显示验证码 |
| 轮询 | 不需要 | 需要 |
| 安全性 | PKCE | 设备码 |

## 实现细节

### 1. 注册客户端

```javascript
POST https://oidc.us-east-1.amazonaws.com/client/register

{
  "clientName": "kiro-web-client",
  "clientType": "public",
  "grantTypes": [
    "urn:ietf:params:oauth:grant-type:device_code",
    "refresh_token"
  ],
  "scopes": ["sso:account:access"]
}
```

响应：
```json
{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "clientSecretExpiresAt": 1234567890
}
```

### 2. 启动设备授权

```javascript
POST https://oidc.us-east-1.amazonaws.com/device_authorization

{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "startUrl": "https://view.awsapps.com/start"
}
```

响应：
```json
{
  "deviceCode": "xxx",
  "userCode": "ABCD-1234",
  "verificationUri": "https://device.sso.us-east-1.amazonaws.com/",
  "verificationUriComplete": "https://device.sso.us-east-1.amazonaws.com/?user_code=ABCD-1234",
  "expiresIn": 600,
  "interval": 5
}
```

### 3. 用户授权

用户需要：
1. 访问 `verificationUri` 或 `verificationUriComplete`
2. 输入 `userCode`（如果使用 verificationUri）
3. 使用 AWS Builder ID 登录
4. 授权应用访问

### 4. 轮询获取 Token

```javascript
POST https://oidc.us-east-1.amazonaws.com/token

{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "grantType": "urn:ietf:params:oauth:grant-type:device_code",
  "deviceCode": "xxx"
}
```

可能的响应：

**授权待处理：**
```json
{
  "error": "authorization_pending"
}
```

**授权成功：**
```json
{
  "accessToken": "xxx",
  "refreshToken": "xxx",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**其他错误：**
- `slow_down` - 请求太频繁
- `expired_token` - 设备码已过期
- `access_denied` - 用户拒绝授权

## 前端实现

### 用户界面

1. **登录按钮**
   - 点击「使用 AWS Builder ID 登录」

2. **授权弹窗**
   - 显示验证码（大字体，可复制）
   - 显示授权 URL 按钮
   - 显示等待状态

3. **轮询状态**
   - 每 5 秒检查一次
   - 显示加载动画
   - 授权成功后自动关闭

### 代码示例

```typescript
// 1. 初始化设备授权
const response = await api.post('/api/auth/device-auth/initiate');
const { sessionId, userCode, verificationUriComplete } = response.data;

// 2. 显示验证码给用户
showModal({
  userCode,
  verificationUrl: verificationUriComplete
});

// 3. 开始轮询
const poll = async () => {
  const result = await api.post('/api/auth/device-auth/poll', { sessionId });
  
  if (result.data.status === 'success') {
    // 登录成功
    login(result.data.token, result.data.user);
  } else if (result.data.status === 'pending') {
    // 继续等待
    setTimeout(poll, 5000);
  }
};
```

## 后端实现

### API 端点

#### 1. 初始化设备授权

```
POST /api/auth/device-auth/initiate
```

响应：
```json
{
  "sessionId": "xxx",
  "userCode": "ABCD-1234",
  "verificationUri": "https://device.sso.us-east-1.amazonaws.com/",
  "verificationUriComplete": "https://device.sso.us-east-1.amazonaws.com/?user_code=ABCD-1234",
  "expiresIn": 600,
  "interval": 5
}
```

#### 2. 轮询授权状态

```
POST /api/auth/device-auth/poll

{
  "sessionId": "xxx"
}
```

响应：
```json
{
  "status": "success|pending|expired|error",
  "token": "jwt-token",
  "user": { ... },
  "message": "..."
}
```

## 使用方法

### 开发环境

1. **启动服务**
```bash
cd server && npm start
npm run dev
```

2. **测试登录**
- 访问 http://localhost:5173/login
- 点击「使用 AWS Builder ID 登录」
- 复制验证码
- 点击「打开 AWS 授权页面」
- 输入验证码并授权
- 等待自动登录

### 生产环境

无需特殊配置，设备授权流程不需要回调 URL。

## 优势

1. **无需回调 URL** - 适合各种部署环境
2. **更安全** - 不暴露 client_secret
3. **用户友好** - 清晰的授权流程
4. **跨平台** - 适用于 Web、CLI、桌面应用

## 注意事项

### 客户端注册

- 客户端信息会缓存
- client_secret 有过期时间
- 过期后自动重新注册

### 轮询频率

- 默认 5 秒一次
- 收到 `slow_down` 错误时增加间隔
- 最多轮询 60 次（5 分钟）

### 会话管理

- 设备授权会话 30 分钟过期
- 过期后需要重新开始
- 使用 Map 存储（生产环境建议用 Redis）

## 故障排查

### 1. 客户端注册失败

**错误：** `客户端注册失败`

**原因：**
- AWS OIDC 端点不可用
- 网络连接问题
- 请求参数错误

**解决：**
- 检查网络连接
- 查看后端日志
- 验证端点 URL

### 2. 设备授权失败

**错误：** `设备授权失败`

**原因：**
- client_id 或 client_secret 无效
- startUrl 错误

**解决：**
- 重新注册客户端
- 检查 startUrl 配置

### 3. 轮询超时

**错误：** `授权超时`

**原因：**
- 用户未完成授权
- 网络延迟

**解决：**
- 增加轮询次数
- 提示用户尽快完成授权

### 4. Token 验证失败

**错误：** `Token 验证失败`

**原因：**
- access_token 无效
- AWS API 不可用

**解决：**
- 检查 token 格式
- 验证 AWS API 端点

## 参考资源

- [RFC 8628 - OAuth 2.0 Device Authorization Grant](https://tools.ietf.org/html/rfc8628)
- [AWS SSO OIDC API](https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/Welcome.html)
- [StartDeviceAuthorization](https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/API_StartDeviceAuthorization.html)
- [CreateToken](https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/API_CreateToken.html)

## 更新日志

### 2026-03-04
- ✅ 从授权码流程改为设备授权流程
- ✅ 实现客户端注册
- ✅ 实现设备授权
- ✅ 实现轮询机制
- ✅ 优化用户界面
- ✅ 添加验证码复制功能

---

**版本：** 2.0.0  
**流程：** AWS SSO Device Authorization Grant  
**状态：** 已实现，待测试
