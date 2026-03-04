# AWS SSO 设备授权用户流程

## 完整流程说明

### 用户视角的完整体验

#### 1. 点击登录按钮
用户在登录页面点击「使用 AWS Builder ID 登录」按钮

#### 2. 弹窗显示 + 自动打开授权页面
- ✅ 应用显示授权弹窗
- ✅ 弹窗显示验证码（大字体，可复制）
- ✅ **自动在新标签页打开 AWS 授权页面**
- ✅ 弹窗提示："AWS 授权页面已自动打开"

#### 3. 用户操作（在弹窗中）
- 复制验证码（点击"复制"按钮）
- 如果授权页面没有自动打开，点击"手动打开授权页面"

#### 4. 用户操作（在 AWS 授权页面）
- 输入验证码
- 使用 AWS Builder ID 登录（邮箱 + 密码）
- 完成 2FA（如果启用）
- 点击"允许"授权应用

#### 5. 自动轮询和登录
- 应用在后台自动轮询检查授权状态
- 3 秒后弹窗切换到"等待授权中..."状态
- 用户完成授权后，应用自动检测到
- 弹窗自动关闭
- 显示成功消息
- 自动跳转到首页

## 技术实现

### 前端流程

```typescript
// 1. 用户点击登录
handleDeviceAuth() {
  // 调用后端初始化设备授权
  const authInfo = await api.post('/api/auth/device-auth/initiate');
  
  // 显示弹窗
  setDeviceAuthModal(true);
  
  // 500ms 后自动打开 AWS 授权页面
  setTimeout(() => {
    window.open(authInfo.verificationUriComplete, '_blank');
  }, 500);
  
  // 3秒后开始轮询
  setTimeout(() => {
    startPolling(authInfo.sessionId);
  }, 3000);
}

// 2. 轮询授权状态
startPolling(sessionId) {
  setPolling(true); // 切换到等待状态
  
  const poll = async () => {
    const result = await api.post('/api/auth/device-auth/poll', { sessionId });
    
    if (result.status === 'success') {
      // 授权成功，自动登录
      login(result.token, result.user);
      navigate('/');
    } else if (result.status === 'pending') {
      // 继续等待
      setTimeout(poll, 5000);
    }
  };
  
  poll();
}
```

### 后端流程

```javascript
// 1. 初始化设备授权
POST /api/auth/device-auth/initiate
{
  // 注册 OIDC 客户端
  const client = await registerClient();
  
  // 启动设备授权
  const deviceAuth = await startDeviceAuthorization(client);
  
  // 返回验证码和授权 URL
  return {
    sessionId: 'xxx',
    userCode: 'ABCD-1234',
    verificationUri: 'https://device.sso.us-east-1.amazonaws.com/',
    verificationUriComplete: 'https://device.sso.us-east-1.amazonaws.com/?user_code=ABCD-1234',
    expiresIn: 600,
    interval: 5
  };
}

// 2. 轮询授权状态
POST /api/auth/device-auth/poll
{
  // 尝试获取 token
  const tokens = await pollForToken(deviceCode);
  
  if (tokens) {
    // 验证 token
    const validation = await validateAccessToken(tokens.accessToken);
    
    // 创建/查找用户
    const user = await findOrCreateUser(validation.userInfo.email);
    
    // 插入 refresh token
    await insertToken(tokens.refreshToken, user.id);
    
    // 返回成功
    return {
      status: 'success',
      token: jwtToken,
      user: user,
      tokenInfo: { created: true }
    };
  } else {
    // 继续等待
    return { status: 'pending' };
  }
}
```

## 时间线

```
0s    - 用户点击登录按钮
0.5s  - 弹窗显示 + AWS 授权页面自动打开
0-3s  - 用户看到验证码，可以复制
3s    - 弹窗切换到"等待授权中..."
3-?s  - 用户在 AWS 页面完成授权
?s    - 应用检测到授权成功
?s    - 自动登录并跳转
```

## 用户界面状态

### 状态 1：显示验证码（0-3秒）

```
┌─────────────────────────────────────┐
│  AWS Builder ID 设备授权            │
├─────────────────────────────────────┤
│  ✓ AWS 授权页面已自动打开           │
│                                     │
│  步骤 1：复制验证码                 │
│  ┌──────────────┐ ┌──────┐         │
│  │  ABCD-1234   │ │ 复制 │         │
│  └──────────────┘ └──────┘         │
│                                     │
│  步骤 2：在授权页面输入验证码       │
│  • 授权页面已在新标签页打开         │
│  • 如未打开，请点击下方按钮         │
│  • 输入验证码并登录                 │
│  ┌─────────────────────────┐       │
│  │  手动打开授权页面        │       │
│  └─────────────────────────┘       │
│                                     │
│  验证码将在 10 分钟后过期           │
└─────────────────────────────────────┘
```

### 状态 2：等待授权（3秒后）

```
┌─────────────────────────────────────┐
│  AWS Builder ID 设备授权            │
├─────────────────────────────────────┤
│                                     │
│         ⏳ (加载动画)               │
│                                     │
│      等待授权中...                  │
│                                     │
│  请在浏览器中完成授权后，           │
│  此窗口将自动关闭                   │
│                                     │
└─────────────────────────────────────┘
```

## AWS 授权页面

用户在新标签页看到的 AWS 页面：

```
┌─────────────────────────────────────┐
│  AWS                                │
├─────────────────────────────────────┤
│  Device Verification                │
│                                     │
│  Enter the code displayed on your   │
│  device:                            │
│                                     │
│  ┌──────────────┐                  │
│  │  ABCD-1234   │  (用户输入)      │
│  └──────────────┘                  │
│                                     │
│  ┌─────────────────────────┐       │
│  │       Continue           │       │
│  └─────────────────────────┘       │
│                                     │
└─────────────────────────────────────┘

↓ 输入验证码后

┌─────────────────────────────────────┐
│  AWS Builder ID Sign In             │
├─────────────────────────────────────┤
│  Email:                             │
│  ┌──────────────────────────┐      │
│  │  user@example.com        │      │
│  └──────────────────────────┘      │
│                                     │
│  Password:                          │
│  ┌──────────────────────────┐      │
│  │  ••••••••                │      │
│  └──────────────────────────┘      │
│                                     │
│  ┌─────────────────────────┐       │
│  │       Sign In            │       │
│  └─────────────────────────┘       │
└─────────────────────────────────────┘

↓ 登录后

┌─────────────────────────────────────┐
│  Authorize Application              │
├─────────────────────────────────────┤
│  Kiro Web Client is requesting      │
│  access to your AWS account:        │
│                                     │
│  • Access your AWS resources        │
│  • View your profile information    │
│                                     │
│  ┌─────────────────────────┐       │
│  │       Allow              │       │
│  └─────────────────────────┘       │
│                                     │
│  ┌─────────────────────────┐       │
│  │       Deny               │       │
│  └─────────────────────────┘       │
└─────────────────────────────────────┘
```

## 关键点

### ✅ 自动打开授权页面
- 使用 `window.open(verificationUriComplete, '_blank')`
- 在弹窗显示后 500ms 执行
- 确保不被浏览器拦截

### ✅ 验证码预填充
- 使用 `verificationUriComplete` 而不是 `verificationUri`
- URL 包含 `?user_code=ABCD-1234` 参数
- AWS 页面自动填充验证码

### ✅ 自动轮询
- 3 秒后开始轮询
- 每 5 秒检查一次
- 最多轮询 60 次（5 分钟）

### ✅ 用户体验优化
- 弹窗先显示验证码（3秒）
- 然后切换到等待状态
- 避免用户看不到验证码

## 浏览器兼容性

### 弹窗拦截
某些浏览器可能拦截 `window.open()`：

**解决方案：**
1. 在用户点击事件中调用（已实现）
2. 提供"手动打开"按钮（已实现）
3. 提示用户允许弹窗

### 测试建议
```javascript
// 测试弹窗是否被拦截
const newWindow = window.open(url, '_blank');
if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
  // 弹窗被拦截
  message.warning('请允许浏览器弹窗，或点击"手动打开授权页面"按钮');
}
```

## 故障排查

### 问题 1：授权页面没有自动打开

**原因：**
- 浏览器拦截弹窗
- `verificationUriComplete` 为空

**解决：**
- 点击"手动打开授权页面"按钮
- 允许浏览器弹窗

### 问题 2：验证码没有预填充

**原因：**
- 使用了 `verificationUri` 而不是 `verificationUriComplete`

**解决：**
- 手动输入验证码
- 检查后端返回的 URL

### 问题 3：轮询超时

**原因：**
- 用户未完成授权
- 网络延迟

**解决：**
- 重新开始授权流程
- 增加轮询次数

## 测试步骤

1. ✅ 点击登录按钮
2. ✅ 确认弹窗显示
3. ✅ 确认授权页面自动打开
4. ✅ 确认验证码显示
5. ✅ 复制验证码
6. ✅ 在 AWS 页面输入验证码
7. ✅ 完成 AWS 登录
8. ✅ 授权应用
9. ✅ 确认弹窗自动关闭
10. ✅ 确认自动登录
11. ✅ 确认 token 已添加

---

**版本：** 2.0.0  
**更新时间：** 2026-03-04  
**状态：** ✅ 已实现自动打开授权页面
