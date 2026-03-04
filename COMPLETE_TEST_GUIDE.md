# 完整测试指南 - AWS SSO 设备授权登录

## 测试目标

验证以下功能：
1. ✅ AWS SSO 设备授权流程正常工作
2. ✅ 用户授权后自动登录
3. ✅ Refresh Token 自动插入到数据库
4. ✅ Token 关联到正确的用户
5. ✅ Token 在管理页面可见
6. ✅ Token 可以正常使用

## 准备工作

### 1. 安装依赖

```bash
# 后端依赖
cd server
npm install

# 前端依赖
cd ..
npm install
```

### 2. 配置环境变量

确保 `server/.env` 文件存在：
```bash
cd server
cp .env.example .env
```

内容应包含：
```env
PORT=3001
JWT_SECRET=your-secret-key-change-this
CORS_ORIGIN=http://localhost:5173
```

### 3. 启动服务

**终端 1 - 后端：**
```bash
cd server
npm start
```

等待看到：
```
🚀 Kiro Admin Server 运行在 http://localhost:3001
📊 数据库位置: /path/to/server/data/kiro.db
✨ 管理后台已就绪
```

**终端 2 - 前端：**
```bash
npm run dev
```

等待看到：
```
VITE ready in xxx ms
➜  Local:   http://localhost:5173/
```

## 测试步骤

### 步骤 1：测试后端 API

```bash
# 在新终端运行
./test-device-auth.sh
```

**预期输出：**
```
✓ 服务器运行正常
✓ 设备授权初始化成功

╔════════════════════════════════════════╗
║  请完成以下步骤进行授权：              ║
╚════════════════════════════════════════╝

验证码: ABCD-1234
授权地址: https://device.sso.us-east-1.amazonaws.com/
有效期: 600 秒 (10 分钟)
```

### 步骤 2：前端登录测试

1. **打开浏览器**
   ```
   http://localhost:5173/login
   ```

2. **点击 AWS 登录按钮**
   - 点击「使用 AWS Builder ID 登录」
   - 应该弹出授权弹窗

3. **查看弹窗内容**
   - ✅ 显示验证码（大字体）
   - ✅ 有「复制」按钮
   - ✅ 有「打开 AWS 授权页面」按钮
   - ✅ 显示过期时间

4. **复制验证码**
   - 点击「复制」按钮
   - 应该看到提示：`验证码已复制`

5. **打开授权页面**
   - 点击「打开 AWS 授权页面」
   - 应该在新标签页打开 AWS 授权页面

### 步骤 3：AWS 授权

1. **在 AWS 授权页面**
   - 如果 URL 包含验证码，应该自动填充
   - 如果没有，手动输入验证码

2. **登录 AWS Builder ID**
   - 输入邮箱
   - 输入密码
   - 完成 2FA（如果启用）

3. **授权应用**
   - 查看权限请求
   - 点击「Allow」或「允许」

### 步骤 4：等待自动登录

1. **回到应用页面**
   - 弹窗应该显示「等待授权中...」
   - 有加载动画

2. **授权成功**
   - 弹窗自动关闭
   - 显示成功消息：
     ```
     ✓ AWS OAuth 登录成功！Refresh Token 已自动添加到 Token 管理
     ```
   - 自动跳转到首页

### 步骤 5：验证 Token 插入

#### 方法 1：查看后端日志

在后端终端应该看到：
```
✅ 成功存储 refresh token (ID: 1) 到用户 2
```

#### 方法 2：查看 Token 管理页面

1. 在应用中点击「Token 管理」
2. 应该看到新增的记录：
   ```
   认证类型: Social
   描述: AWS SSO 设备授权自动获取
   状态: 启用
   创建时间: 刚刚
   ```

#### 方法 3：运行验证脚本

```bash
./check-tokens.sh
```

**预期输出：**
```
✓ 数据库文件存在

1. 查询所有 Token 记录：
id  auth_type  token_preview              description                    disabled  user_id  created_at
--  ---------  -------------------------  -----------------------------  --------  -------  ----------
1   Social     arn:aws:sso:us-east-1:...  AWS SSO 设备授权自动获取       0         2        2026-03-04...

2. 查询自动添加的 Token（设备授权）：
✓ 找到 1 个自动添加的 Token

统计信息：
  总 Token 数: 1
  启用的 Token: 1
  禁用的 Token: 0
  自动添加的 Token: 1
```

#### 方法 4：直接查询数据库

```bash
sqlite3 server/data/kiro.db "SELECT id, auth_type, description, user_id FROM tokens ORDER BY created_at DESC LIMIT 1;"
```

**预期输出：**
```
1|Social|AWS SSO 设备授权自动获取|2
```

### 步骤 6：测试 Token 有效性

1. **在 Token 管理页面**
   - 找到自动添加的 Token
   - 点击「检测」按钮

2. **查看检测结果**
   - ✅ 显示「Token 有效」
   - ✅ 显示剩余用量
   - ✅ 显示用户邮箱

### 步骤 7：测试 API 调用

使用获取的 Token 调用 API：

1. **创建 API 密钥**
   - 进入「API 密钥」页面
   - 点击「添加 API 密钥」
   - 复制生成的密钥

2. **测试 API 调用**
   ```bash
   curl -X POST http://localhost:3001/v1/messages \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "claude-sonnet-4-20250514",
       "max_tokens": 100,
       "messages": [
         {"role": "user", "content": "Hello!"}
       ]
     }'
   ```

3. **验证响应**
   - 应该返回 Claude 的回复
   - 检查使用日志是否记录

## 测试检查清单

### 前端功能
- [ ] 登录页面显示 AWS 登录按钮
- [ ] 点击按钮弹出授权弹窗
- [ ] 弹窗显示验证码
- [ ] 验证码可以复制
- [ ] 可以打开授权页面
- [ ] 显示等待授权状态
- [ ] 授权成功后自动关闭弹窗
- [ ] 显示成功消息
- [ ] 自动跳转到首页

### 后端功能
- [ ] 客户端注册成功
- [ ] 设备授权初始化成功
- [ ] 轮询机制正常工作
- [ ] Token 获取成功
- [ ] Token 验证成功
- [ ] 用户创建/查找成功
- [ ] Token 插入数据库成功
- [ ] 返回正确的响应

### 数据库
- [ ] tokens 表有新记录
- [ ] auth_type 为 'Social'
- [ ] refresh_token 不为空
- [ ] description 正确
- [ ] user_id 关联正确
- [ ] disabled 为 0
- [ ] created_at 正确

### Token 管理
- [ ] Token 列表显示新记录
- [ ] 可以查看 Token 详情
- [ ] 可以检测 Token 有效性
- [ ] 可以禁用/启用 Token
- [ ] 可以删除 Token

### API 调用
- [ ] 使用 Token 可以调用 API
- [ ] 返回正确的响应
- [ ] 使用日志正确记录
- [ ] Token 用量正确更新

## 常见问题排查

### 问题 1：设备授权初始化失败

**错误：** `客户端注册失败`

**检查：**
```bash
# 测试网络连接
curl -I https://oidc.us-east-1.amazonaws.com/client/register

# 查看后端日志
# 应该有详细的错误信息
```

**解决：**
- 检查网络连接
- 确认 AWS OIDC 端点可访问
- 查看防火墙设置

### 问题 2：轮询超时

**错误：** `授权超时`

**检查：**
- 用户是否完成授权
- 验证码是否正确
- 授权页面是否有错误

**解决：**
- 重新开始授权流程
- 确认验证码输入正确
- 检查 AWS 账号状态

### 问题 3：Token 插入失败

**错误：** `存储 token 失败`

**检查：**
```bash
# 检查数据库
sqlite3 server/data/kiro.db "PRAGMA table_info(tokens);"

# 检查 user_id 字段
sqlite3 server/data/kiro.db "PRAGMA table_info(tokens);" | grep user_id
```

**解决：**
```bash
# 运行数据库迁移
node server/src/utils/migrate.js

# 或重启服务器（会自动迁移）
cd server && npm start
```

### 问题 4：Token 检测失败

**错误：** `Token 验证失败`

**检查：**
- Token 是否过期
- AWS API 是否可访问
- Token 格式是否正确

**解决：**
- 重新授权获取新 Token
- 检查网络连接
- 查看后端日志

## 性能测试

### 1. 并发登录测试

测试多个用户同时登录：
```bash
# 启动 5 个并发授权流程
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/auth/device-auth/initiate &
done
wait
```

### 2. Token 插入性能

测试 Token 插入速度：
```bash
# 查看插入时间
time sqlite3 server/data/kiro.db "INSERT INTO tokens (auth_type, refresh_token, description) VALUES ('Social', 'test_token', 'test');"
```

### 3. 轮询性能

测试轮询响应时间：
```bash
# 测试轮询端点
time curl -X POST http://localhost:3001/api/auth/device-auth/poll \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test"}'
```

## 清理测试数据

### 删除测试 Token

```bash
sqlite3 server/data/kiro.db "DELETE FROM tokens WHERE description LIKE '%测试%' OR description LIKE '%test%';"
```

### 删除测试用户

```bash
sqlite3 server/data/kiro.db "DELETE FROM users WHERE username LIKE '%test%';"
```

### 重置数据库

```bash
# 备份数据库
cp server/data/kiro.db server/data/kiro.db.backup

# 删除数据库
rm server/data/kiro.db

# 重启服务器（会重新初始化）
cd server && npm start
```

## 测试报告模板

```markdown
# AWS SSO 设备授权测试报告

**测试日期：** 2026-03-04
**测试人员：** [姓名]
**环境：** 开发环境

## 测试结果

### 功能测试
- [ ] 设备授权初始化：通过/失败
- [ ] 用户授权流程：通过/失败
- [ ] Token 自动插入：通过/失败
- [ ] Token 有效性验证：通过/失败
- [ ] API 调用：通过/失败

### 性能测试
- 授权初始化响应时间：___ ms
- 轮询响应时间：___ ms
- Token 插入时间：___ ms

### 问题记录
1. [问题描述]
   - 严重程度：高/中/低
   - 复现步骤：...
   - 解决方案：...

## 总结
[测试总结]
```

---

**测试完成标准：**
- [ ] 所有功能测试通过
- [ ] 性能测试达标
- [ ] 无严重问题
- [ ] 文档完整

**版本：** 2.0.0  
**更新时间：** 2026-03-04
