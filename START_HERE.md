# 🚀 快速开始 - AWS SSO 设备授权登录

## 立即测试（3 步）

### 1️⃣ 启动后端
```bash
cd server
npm install  # 首次运行需要
npm start
```

等待看到：
```
✅ 成功存储 refresh token (ID: X) 到用户 Y
🚀 Kiro Admin Server 运行在 http://localhost:3001
✨ 管理后台已就绪
```

### 2️⃣ 启动前端（新终端）
```bash
npm install  # 首次运行需要
npm run dev
```

等待看到：
```
➜  Local:   http://localhost:5173/
```

### 3️⃣ 测试登录
1. 打开浏览器访问：http://localhost:5173/login
2. 点击「使用 AWS Builder ID 登录」
3. 弹窗显示验证码
4. AWS 授权页面自动打开
5. 复制验证码并在 AWS 页面完成授权
6. 自动登录成功！

## 🎯 预期结果

### 你应该看到：

1. **弹窗显示**
   ```
   ┌─────────────────────────────────┐
   │ AWS Builder ID 设备授权         │
   │                                 │
   │ AWS 授权页面已自动打开          │
   │                                 │
   │ 步骤 1：复制验证码              │
   │ ┌──────────┐ ┌──────┐          │
   │ │ ABCD-1234│ │ 复制 │          │
   │ └──────────┘ └──────┘          │
   └─────────────────────────────────┘
   ```

2. **AWS 授权页面自动打开**（新标签页）

3. **3 秒后切换到等待状态**
   ```
   ┌─────────────────────────────────┐
   │ AWS Builder ID 设备授权         │
   │                                 │
   │      ⏳ 等待授权中...           │
   │                                 │
   │ 请在浏览器中完成授权后，        │
   │ 此窗口将自动关闭                │
   └─────────────────────────────────┘
   ```

4. **授权成功后**
   - ✅ 弹窗自动关闭
   - ✅ 显示：「AWS OAuth 登录成功！Refresh Token 已自动添加到 Token 管理」
   - ✅ 自动跳转到首页

5. **后端日志**
   ```
   ✅ 成功存储 refresh token (ID: 1) 到用户 2
   ```

## 🔍 验证 Token 已插入

### 方法 1：查看 Token 管理页面
1. 登录后点击「Token 管理」
2. 应该看到新记录：
   - 认证类型：Social
   - 描述：AWS SSO 设备授权自动获取
   - 状态：启用

### 方法 2：运行验证脚本
```bash
chmod +x check-tokens.sh
./check-tokens.sh
```

应该显示：
```
✓ 找到 1 个自动添加的 Token
```

### 方法 3：查询数据库
```bash
sqlite3 server/data/kiro.db "SELECT id, auth_type, description FROM tokens WHERE description LIKE '%设备授权%';"
```

## ❓ 常见问题

### Q1: AWS 授权页面没有自动打开？
**A:** 浏览器可能拦截了弹窗
- 允许浏览器弹窗
- 或点击弹窗中的「手动打开授权页面」按钮

### Q2: 弹窗一直显示"等待授权中"？
**A:** 确保你在 AWS 页面完成了授权
- 输入验证码
- 登录 AWS Builder ID
- 点击「Allow」授权

### Q3: 显示"授权已过期"？
**A:** 验证码有效期 10 分钟
- 关闭弹窗
- 重新点击登录按钮

### Q4: Token 没有自动添加？
**A:** 检查后端日志
```bash
# 查看后端日志，应该有：
✅ 成功存储 refresh token (ID: X) 到用户 Y

# 如果有错误，运行数据库迁移：
node server/src/utils/migrate.js
```

## 📚 更多文档

- [完整测试指南](./COMPLETE_TEST_GUIDE.md)
- [用户流程说明](./USER_FLOW.md)
- [Token 插入测试](./TEST_TOKEN_INSERTION.md)
- [AWS 设备授权详解](./AWS_DEVICE_AUTH_GUIDE.md)
- [最终测试清单](./FINAL_TEST_CHECKLIST.md)

## 🎉 成功标志

当你看到以下所有内容时，说明一切正常：
- ✅ 弹窗显示验证码
- ✅ AWS 页面自动打开
- ✅ 授权成功后自动登录
- ✅ 显示成功消息
- ✅ Token 管理页面有新记录
- ✅ 后端日志显示成功

## 🆘 需要帮助？

1. 查看后端日志（终端 1）
2. 查看浏览器控制台（F12）
3. 运行测试脚本：`./test-device-auth.sh`
4. 查看文档：[COMPLETE_TEST_GUIDE.md](./COMPLETE_TEST_GUIDE.md)

---

**版本：** 2.0.0  
**状态：** ✅ 生产就绪  
**构建：** ✅ 成功

🎊 开始测试吧！
