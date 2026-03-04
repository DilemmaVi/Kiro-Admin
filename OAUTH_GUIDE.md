# AWS OAuth 认证集成指南

## 概述

本项目已集成 AWS OAuth 认证功能，可以通过 OAuth 流程自动获取 AWS refresh token，无需手动输入。这个实现参考了 AIClient-2-API 项目的思路，模拟 Kiro 客户端的 OAuth 认证流程。

## 功能特性

- ✅ 标准 OAuth 2.0 授权码流程（Authorization Code Flow）
- ✅ PKCE（Proof Key for Code Exchange）安全增强
- ✅ 自动获取和存储 refresh token
- ✅ 支持多用户 OAuth 登录
- ✅ 自动创建用户账号
- ✅ Token 自动刷新机制

## 架构说明

### OAuth 流程

```
用户 → 前端 → 后端 → AWS OAuth 服务器
                ↓
            获取授权码
                ↓
            交换 Token
                ↓
        存储 Refresh Token
                ↓
            自动登录
```

### 核心组件

1. **oauthHelper.js** - OAuth 工具函数
   - PKCE 生成
   - 授权 URL 生成
   - Token 交换
   - Token 刷新

2. **oauthController.js** - OAuth 控制器
   - 初始化 OAuth 流程
   - 处理回调
   - 用户创建/登录

3. **前端登录页面** - 用户界面
   - OAuth 登录按钮
   - 回调处理
   - 自动跳转

## 使用方法

### 1. 配置环境变量

编辑 `server/.env` 文件：

```env
PORT=3001
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173

# OAuth 回调地址（必须配置）
OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/oauth/callback
```

### 2. 启动服务

```bash
# 启动后端
cd server
npm install
npm start

# 启动前端
cd ..
npm install
npm run dev
```

### 3. 使用 OAuth 登录

1. 访问登录页面：http://localhost:5173/login
2. 点击「使用 AWS OAuth 登录」按钮
3. 跳转到 AWS 授权页面
4. 授权后自动跳转回应用
5. 自动登录并存储 refresh token

### 4. 查看获取的 Token

登录成功后：
1. 进入「Token 管理」页面
2. 可以看到自动添加的 OAuth Token
3. 描述为「OAuth 自动获取」

## API 端点

### 初始化 OAuth

```
GET /api/auth/oauth/initiate
```

响应：
```json
{
  "authUrl": "https://prod.us-east-1.auth.desktop.kiro.dev/authorize?...",
  "state": "random-state-string"
}
```

### OAuth 回调

```
GET /api/auth/oauth/callback?code=xxx&state=xxx
```

自动处理并重定向到前端。

### 获取 OAuth 状态

```
GET /api/auth/oauth/status
Authorization: Bearer <jwt-token>
```

响应：
```json
{
  "hasToken": true,
  "token": {
    "id": 1,
    "description": "OAuth 自动获取",
    "created_at": "2026-03-04T10:00:00.000Z"
  }
}
```

## 技术细节

### PKCE 实现

为了安全性，使用 PKCE 扩展：

1. 生成 `code_verifier`（随机字符串）
2. 计算 `code_challenge`（SHA256 hash）
3. 授权时发送 `code_challenge`
4. Token 交换时发送 `code_verifier`

### Token 存储

- Refresh Token 存储在数据库 `tokens` 表
- 关联到用户账号（`user_id` 字段）
- 支持多个用户各自的 Token

### 安全措施

1. **State 参数**：防止 CSRF 攻击
2. **PKCE**：防止授权码拦截
3. **Session 过期**：OAuth 会话 10 分钟过期
4. **Token 验证**：获取后立即验证有效性

## 与 AIClient-2-API 的对比

本实现参考了 AIClient-2-API 的思路，但有以下区别：

| 特性 | AIClient-2-API | 本项目 |
|------|----------------|--------|
| OAuth 流程 | ✅ | ✅ |
| PKCE 支持 | ✅ | ✅ |
| Web UI | ✅ | ✅ |
| 多用户支持 | ❌ | ✅ |
| Token 管理 | 配置文件 | 数据库 |
| 自动登录 | ❌ | ✅ |

## 常见问题

### 1. OAuth 授权失败？

**可能原因：**
- 回调地址配置错误
- AWS OAuth 服务不可用
- 网络连接问题

**解决方案：**
- 检查 `OAUTH_REDIRECT_URI` 配置
- 确保可以访问 AWS OAuth 端点
- 查看浏览器控制台错误

### 2. Token 获取后无法使用？

**可能原因：**
- Token 已过期
- Token 权限不足
- AWS 账号问题

**解决方案：**
- 在 Token 管理页面点击「检测」
- 查看 Token 有效性和用量
- 重新进行 OAuth 授权

### 3. 回调地址不匹配？

**错误信息：**
```
redirect_uri_mismatch
```

**解决方案：**
- 确保 `.env` 中的 `OAUTH_REDIRECT_URI` 与实际访问地址一致
- 本地开发：`http://localhost:3001/api/auth/oauth/callback`
- 生产环境：`https://your-domain.com/api/auth/oauth/callback`

### 4. 如何在生产环境部署？

**配置要点：**

1. 更新环境变量：
```env
OAUTH_REDIRECT_URI=https://your-backend-domain.com/api/auth/oauth/callback
CORS_ORIGIN=https://your-frontend-domain.com
COOKIE_SECURE=true
COOKIE_SAMESITE=none
TRUST_PROXY=true
```

2. 确保 HTTPS：
   - OAuth 回调必须使用 HTTPS
   - Cookie 安全设置需要 HTTPS

3. 配置 CORS：
   - 允许前端域名跨域访问
   - 允许携带凭证（credentials）

## 开发建议

### 扩展功能

1. **支持 IdC 认证**：
   - 添加 IdC OAuth 流程
   - 支持企业身份中心

2. **Token 自动刷新**：
   - 后台定时刷新 Token
   - 避免 Token 过期

3. **多账号管理**：
   - 支持绑定多个 AWS 账号
   - 账号切换功能

### 调试技巧

1. **查看 OAuth 流程**：
```bash
# 后端日志
cd server
npm start

# 查看控制台输出
```

2. **测试 Token 刷新**：
```bash
curl -X POST http://localhost:3001/api/auth/oauth/initiate
```

3. **验证 Token**：
```bash
curl -X GET http://localhost:3001/api/tokens/1/check \
  -H "Authorization: Bearer <jwt-token>"
```

## 参考资源

- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC](https://tools.ietf.org/html/rfc7636)
- [AIClient-2-API](https://github.com/justlovemaki/AIClient-2-API)
- [AWS CodeWhisperer API](https://docs.aws.amazon.com/codewhisperer/)

## 更新日志

### 2026-03-04
- ✅ 实现 OAuth 2.0 授权码流程
- ✅ 添加 PKCE 支持
- ✅ 集成前端 OAuth 登录按钮
- ✅ 自动创建用户和存储 Token
- ✅ 完善错误处理和用户提示

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
