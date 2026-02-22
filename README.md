# Kiro Admin

<div align="center">

![Kiro Admin](https://img.shields.io/badge/Kiro-Admin-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

**AI 代理管理平台 - 完整的 AWS CodeWhisperer API 代理服务**

[功能特性](#功能特性) • [快速开始](#快速开始) • [安装教程](#安装教程) • [使用指南](#使用指南) • [API 文档](#api-文档)

</div>

---

## 📖 简介

Kiro Admin 是一个功能完整的 AI 代理管理平台，提供 Web 管理界面和 API 代理服务。它可以将 AWS CodeWhisperer API 代理为标准的 Anthropic Messages API 和 OpenAI Chat Completions API 格式，让您的应用程序可以轻松接入 AI 能力。

### 核心功能

- 🎨 **现代化 Web 管理界面** - 时尚大气的科技感设计
- 🔐 **完善的认证系统** - 登录验证码、密码修改、JWT 认证
- 🔑 **Token 管理** - 支持 AWS Social 和 IdC 双认证方式
- 🗝️ **API 密钥管理** - 为不同应用分配独立的 API 密钥
- 🤖 **模型管理** - 支持多个 Claude 模型
- 🧪 **模型测试** - 内置对话测试工具，支持 Anthropic 和 OpenAI 格式
- 📊 **使用统计** - 详细的请求日志和 Token 使用统计
- 🌐 **API 代理服务** - 完全兼容 Anthropic 和 OpenAI API 格式
- 📚 **完整的 API 文档** - 内置交互式 API 文档页面

---

## ✨ 功能特性

### 1. Web 管理界面

- **仪表盘** - 总览统计数据和最近使用记录
- **Token 管理** - CRUD 操作、有效性检测、使用量查询
- **API 密钥管理** - 创建、禁用、删除 API 密钥
- **模型管理** - 查看支持的模型列表
- **模型测试** - 实时对话测试，支持双 API 标准
- **使用统计** - 图表展示使用趋势
- **系统设置** - 配置管理、密码修改
- **API 文档** - 完整的接口对接说明

### 2. API 代理服务

#### Anthropic Messages API
```
POST /v1/messages
```
- 完全兼容 Anthropic API 格式
- 支持 system prompt
- 支持多轮对话
- 自动处理内容长度超限

#### OpenAI Chat Completions API
```
POST /v1/chat/completions
```
- 完全兼容 OpenAI API 格式
- 支持 system 消息
- 支持多轮对话
- 自动处理内容长度超限

### 3. 支持的模型

- `claude-sonnet-4-5` / `claude-sonnet-4-5-20250929`
- `claude-sonnet-4-20250514`
- `claude-3-7-sonnet-20250219`
- `claude-3-5-haiku-20241022`

---

## 🚀 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- AWS CodeWhisperer Token（Social 或 IdC 认证）

### 一键启动

```bash
# 克隆项目
git clone <repository-url>
cd kiro-admin

# 启动服务（自动安装依赖并启动前后端）
./start.sh
```

启动成功后：
- 前端地址：http://localhost:5173
- 后端地址：http://localhost:3001
- 默认账号：`admin` / `admin123`

---

## 📦 安装教程

### 方式一：使用启动脚本（推荐）

```bash
# 1. 进入项目目录
cd kiro-admin

# 2. 赋予执行权限
chmod +x start.sh

# 3. 启动服务
./start.sh
```

### 方式二：手动安装

#### 1. 安装后端依赖

```bash
cd kiro-admin/server
npm install
```

#### 2. 配置环境变量

创建 `server/.env` 文件：

```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
CORS_ORIGIN=http://localhost:5173
```

#### 3. 启动后端服务

```bash
npm start
```

#### 4. 安装前端依赖

```bash
cd ../
npm install
```

#### 5. 启动前端服务

```bash
npm run dev
```

---

## 📘 使用指南

### 1. 登录系统

1. 访问 http://localhost:5173/login
2. 输入用户名：`admin`
3. 输入密码：`admin123`
4. 输入验证码（点击图片可刷新）
5. 点击登录

### 2. 添加 AWS Token

#### 获取 AWS Token

**Social 认证：**
- 从 AWS Builder ID 获取 refresh token
- 格式：`arn:aws:sso:...`

**IdC 认证：**
- 需要 refresh token、client_id、client_secret
- 从企业身份中心获取

#### 添加 Token

1. 进入「Token管理」页面
2. 点击「添加Token」
3. 选择认证类型（Social 或 IdC）
4. 填写 Refresh Token
5. 如果是 IdC，还需填写 Client ID 和 Client Secret
6. 添加描述（可选）
7. 点击确定

#### 检测 Token 有效性

1. 在 Token 列表中找到要检测的 Token
2. 点击「检测」按钮
3. 查看有效性状态和使用量信息

### 3. 创建 API 密钥

1. 进入「API密钥」页面
2. 点击「添加API密钥」
3. 输入密钥名称
4. 添加描述（可选）
5. 点击确定
6. **重要：复制生成的密钥并妥善保管**

### 4. 使用 API 代理服务

#### 方式一：使用 curl

```bash
curl -X POST http://localhost:3001/v1/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### 方式二：使用 Python SDK

**Anthropic SDK:**

```python
from anthropic import Anthropic

client = Anthropic(
    api_key="YOUR_API_KEY",
    base_url="http://localhost:3001/v1"
)

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.content[0].text)
```

**OpenAI SDK:**

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="http://localhost:3001/v1"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-20250514",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    max_tokens=100
)

print(response.choices[0].message.content)
```

#### 方式三：使用 Claude Code CLI

```bash
# 设置环境变量
export ANTHROPIC_BASE_URL="http://localhost:3001/v1"
export ANTHROPIC_API_KEY="YOUR_API_KEY"

# 使用 Claude Code
claude-code "你的问题"
```

### 5. 模型测试

1. 进入「模型测试」页面
2. 选择要测试的模型
3. 选择 API 源（AWS CodeWhisperer 或 Anthropic 官方 API）
4. 选择 API 标准（Anthropic Messages 或 OpenAI Chat Completions）
5. 可选：输入系统提示词
6. 输入消息内容
7. 点击发送

### 6. 查看使用统计

1. 进入「使用统计」页面
2. 查看请求趋势图表
3. 查看模型使用分布
4. 查看最近的请求日志

### 7. 修改密码

1. 进入「系统设置」页面
2. 点击「修改密码」按钮
3. 输入原密码
4. 输入新密码（至少6位）
5. 确认新密码
6. 点击确定
7. 修改成功后会自动跳转到登录页

---

## 🔌 API 文档

### 认证方式

所有 API 请求都需要在请求头中包含 API 密钥：

```bash
# 方式 1: Authorization Header
Authorization: Bearer YOUR_API_KEY

# 方式 2: x-api-key Header
x-api-key: YOUR_API_KEY
```

### Anthropic Messages API

**端点：** `POST /v1/messages`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型 ID |
| messages | array | 是 | 对话消息数组 |
| max_tokens | integer | 否 | 最大生成 token 数 |
| system | string | 否 | 系统提示词 |

**请求示例：**

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "system": "You are a helpful assistant.",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
}
```

**响应示例：**

```json
{
  "id": "msg_1771713821227",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

### OpenAI Chat Completions API

**端点：** `POST /v1/chat/completions`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型 ID |
| messages | array | 是 | 对话消息数组 |
| max_tokens | integer | 否 | 最大生成 token 数 |

**请求示例：**

```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "max_tokens": 100
}
```

**响应示例：**

```json
{
  "id": "chatcmpl-1771714336862",
  "object": "chat.completion",
  "created": 1771714336,
  "model": "claude-sonnet-4-20250514",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### 错误处理

**错误类型：**

| 错误类型 | HTTP 状态码 | 说明 |
|---------|------------|------|
| authentication_error | 401 | API 密钥无效或缺失 |
| invalid_request_error | 400 | 请求参数错误 |
| api_error | 500 | 服务器内部错误 |

**错误响应示例（Anthropic）：**

```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "API 密钥无效"
  }
}
```

**错误响应示例（OpenAI）：**

```json
{
  "error": {
    "message": "API 密钥无效",
    "type": "authentication_error",
    "param": null,
    "code": null
  }
}
```

---

## 🏗️ 项目结构

```
kiro-admin/
├── server/                 # 后端服务
│   ├── src/
│   │   ├── config/        # 配置文件
│   │   ├── controllers/   # 控制器
│   │   ├── middleware/    # 中间件
│   │   ├── routes/        # 路由
│   │   ├── utils/         # 工具函数
│   │   └── index.js       # 入口文件
│   ├── data/              # 数据库文件
│   ├── package.json
│   └── .env               # 环境变量
├── src/                   # 前端源码
│   ├── components/        # 组件
│   ├── pages/            # 页面
│   ├── services/         # API 服务
│   ├── store/            # 状态管理
│   ├── types/            # TypeScript 类型
│   └── App.tsx           # 应用入口
├── package.json
├── start.sh              # 启动脚本
├── API_PROXY_GUIDE.md    # API 代理指南
└── README.md             # 本文件
```

---

## 🔧 配置说明

### 后端配置 (server/.env)

```env
# 服务端口
PORT=3001

# JWT 密钥（生产环境请修改）
JWT_SECRET=your-secret-key-change-this-in-production

# CORS 允许的来源
CORS_ORIGIN=http://localhost:5173
```

### 数据库

- 使用 SQLite3
- 数据库文件位置：`server/data/kiro.db`
- 自动初始化表结构
- 默认管理员账号：`admin` / `admin123`

### 表结构

- **users** - 用户表
- **tokens** - AWS Token 表
- **api_keys** - API 密钥表
- **system_config** - 系统配置表
- **usage_logs** - 使用日志表

---

## 🛠️ 开发指南

### 技术栈

**前端：**
- React 18
- TypeScript
- Vite
- Ant Design 5
- Zustand（状态管理）
- Axios

**后端：**
- Node.js
- Express
- SQLite3
- JWT
- bcryptjs
- svg-captcha

### 开发模式

```bash
# 前端开发
npm run dev

# 后端开发
cd server
npm run dev
```

### 构建生产版本

```bash
# 构建前端
npm run build

# 后端直接使用 Node.js 运行
cd server
node src/index.js
```

---

## 📝 常见问题

### 1. 验证码不显示？

**解决方案：**
- 检查后端服务是否正常运行
- 确认 CORS 配置正确
- 清除浏览器缓存
- 检查浏览器控制台是否有错误

### 2. Token 检测失败？

**可能原因：**
- Refresh Token 已过期
- Refresh Token 格式错误
- IdC 认证的 Client ID 或 Client Secret 错误
- 网络连接问题

**解决方案：**
- 重新获取 Refresh Token
- 检查 Token 格式是否正确
- 验证 IdC 认证信息

### 3. API 调用返回 401 错误？

**可能原因：**
- API 密钥无效
- API 密钥已被禁用
- 请求头格式错误

**解决方案：**
- 检查 API 密钥是否正确
- 在管理后台确认密钥状态
- 确认请求头格式：`Authorization: Bearer YOUR_API_KEY`

### 4. 内容长度超限？

**说明：**
- 这是正常行为，AWS CodeWhisperer 有内容长度限制
- 系统会自动处理，返回 `stop_reason: "max_tokens"` 或 `finish_reason: "length"`

**解决方案：**
- 减少输入内容长度
- 增加 max_tokens 参数
- 分批处理长文本

### 5. 如何修改管理员密码？

**方法一：通过 Web 界面**
1. 登录管理后台
2. 进入「系统设置」
3. 点击「修改密码」

**方法二：直接修改数据库**
```bash
# 生成新密码的 hash
node -e "console.log(require('bcryptjs').hashSync('new_password', 10))"

# 更新数据库
sqlite3 server/data/kiro.db "UPDATE users SET password='生成的hash' WHERE username='admin'"
```

---

## 🔒 安全建议

1. **修改默认密码** - 首次登录后立即修改管理员密码
2. **保护 API 密钥** - 不要将 API 密钥提交到版本控制系统
3. **使用 HTTPS** - 生产环境建议使用 HTTPS
4. **定期更新** - 定期更新依赖包以修复安全漏洞
5. **限制访问** - 使用防火墙限制管理后台的访问
6. **备份数据** - 定期备份数据库文件

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📮 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件 4936089@qq.com

---

