# OAuth 快速启动指南

## 5 分钟快速上手

### 步骤 1：配置环境变量

```bash
cd server
cp .env.example .env
```

确保 `.env` 包含：
```env
PORT=3001
JWT_SECRET=your-secret-key-change-this
CORS_ORIGIN=http://localhost:5173
OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/oauth/callback
```

### 步骤 2：安装依赖并启动

```bash
# 安装后端依赖
cd server
npm install

# 启动后端（保持运行）
npm start
```

打开新终端：
```bash
# 安装前端依赖
npm install

# 启动前端
npm run dev
```

### 步骤 3：使用 OAuth 登录

1. 浏览器访问：http://localhost:5173/login
2. 点击「使用 AWS OAuth 登录」按钮
3. 在 AWS 授权页面完成授权
4. 自动跳转回应用并登录

### 步骤 4：查看获取的 Token

1. 登录后进入「Token 管理」页面
2. 看到自动添加的 refresh token
3. 点击「检测」按钮验证 Token 有效性

## 完成！

现在你已经成功：
- ✅ 通过 OAuth 登录
- ✅ 自动获取 refresh token
- ✅ Token 已存储在数据库

## 传统登录（可选）

如果不想使用 OAuth，仍可使用传统方式：
- 用户名：`admin`
- 密码：`admin123`

## 常见问题

### Q: OAuth 按钮点击无反应？
A: 检查后端是否运行：`curl http://localhost:3001/health`

### Q: 授权后跳转失败？
A: 确认 `OAUTH_REDIRECT_URI` 配置正确

### Q: Token 检测失败？
A: 可能是 AWS 账号问题，重新授权试试

## 需要帮助？

查看详细文档：
- [OAuth 实现说明](./OAUTH_IMPLEMENTATION.md)
- [OAuth 使用指南](./OAUTH_GUIDE.md)
- [项目 README](./README.md)

## 测试脚本

```bash
# 快速测试 OAuth 功能
chmod +x test-oauth.sh
./test-oauth.sh
```

---

祝使用愉快！🎉
