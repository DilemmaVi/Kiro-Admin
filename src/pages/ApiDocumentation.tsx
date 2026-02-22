import React, { useState } from 'react';
import { Card, Tabs, Typography, Divider, Tag, Space, Alert, Button, message } from 'antd';
import { CopyOutlined, ApiOutlined, CodeOutlined, BookOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

const ApiDocumentation: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} 已复制到剪贴板`);
  };

  const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => (
    <div style={{ position: 'relative' }}>
      <pre style={{
        background: '#f5f5f5',
        padding: '16px',
        borderRadius: '4px',
        overflow: 'auto',
        fontSize: '13px',
        lineHeight: '1.6'
      }}>
        <code>{code}</code>
      </pre>
      <Button
        size="small"
        icon={<CopyOutlined />}
        style={{ position: 'absolute', top: '8px', right: '8px' }}
        onClick={() => copyToClipboard(code, '代码')}
      >
        复制
      </Button>
    </div>
  );

  return (
    <div>
      <Title level={2}>
        <ApiOutlined /> API 接口文档
      </Title>
      <Paragraph>
        Kiro Admin 提供完整的 API 代理服务，兼容 Anthropic 和 OpenAI API 格式。
        通过 API 密钥认证，让您的应用程序可以轻松接入 AI 能力。
      </Paragraph>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* 概览 */}
        <TabPane tab={<span><BookOutlined /> 快速开始</span>} key="overview">
          <Card>
            <Title level={3}>快速开始</Title>

            <Alert
              message="重要提示"
              description="使用 API 前，请先在「API密钥」页面创建一个 API 密钥，并确保在「Token管理」中添加了有效的 AWS Token。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Title level={4}>1. 获取 API 密钥</Title>
            <Paragraph>
              <ol>
                <li>登录 Kiro Admin 管理后台</li>
                <li>进入「API密钥」页面</li>
                <li>点击「添加API密钥」创建新密钥</li>
                <li>复制生成的密钥（格式：<Text code>kiro_xxxxx</Text>）</li>
              </ol>
            </Paragraph>

            <Title level={4}>2. 选择 API 格式</Title>
            <Paragraph>
              Kiro Admin 支持两种 API 格式：
            </Paragraph>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              <Card size="small">
                <Space>
                  <Tag color="blue">Anthropic Messages API</Tag>
                  <Text>适用于 Claude SDK、Claude Code CLI</Text>
                </Space>
                <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                  端点：<Text code>POST http://localhost:3001/v1/messages</Text>
                </Paragraph>
              </Card>
              <Card size="small">
                <Space>
                  <Tag color="green">OpenAI Chat Completions API</Tag>
                  <Text>适用于 OpenAI SDK、兼容 OpenAI 的应用</Text>
                </Space>
                <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                  端点：<Text code>POST http://localhost:3001/v1/chat/completions</Text>
                </Paragraph>
              </Card>
            </Space>

            <Title level={4}>3. 发送第一个请求</Title>
            <Paragraph>使用 curl 测试：</Paragraph>
            <CodeBlock code={`curl -X POST http://localhost:3001/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`} />
          </Card>
        </TabPane>

        {/* Anthropic API */}
        <TabPane tab={<span><CodeOutlined /> Anthropic API</span>} key="anthropic">
          <Card>
            <Title level={3}>Anthropic Messages API</Title>

            <Title level={4}>端点</Title>
            <CodeBlock code="POST http://localhost:3001/v1/messages" />

            <Title level={4}>认证</Title>
            <Paragraph>支持两种认证方式：</Paragraph>
            <CodeBlock code={`# 方式 1: Authorization Header
Authorization: Bearer YOUR_API_KEY

# 方式 2: x-api-key Header
x-api-key: YOUR_API_KEY`} />

            <Title level={4}>请求参数</Title>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>参数</th>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>类型</th>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>必填</th>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>model</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>string</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Tag color="red">是</Tag></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>模型 ID</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>messages</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>array</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Tag color="red">是</Tag></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>对话消息数组</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>max_tokens</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>integer</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Tag color="blue">否</Tag></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>最大生成 token 数</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>system</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>string</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Tag color="blue">否</Tag></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>系统提示词</td>
                </tr>
              </tbody>
            </table>

            <Title level={4}>支持的模型</Title>
            <Space wrap style={{ marginBottom: 24 }}>
              <Tag color="purple">claude-sonnet-4-5</Tag>
              <Tag color="purple">claude-sonnet-4-20250514</Tag>
              <Tag color="purple">claude-3-7-sonnet-20250219</Tag>
              <Tag color="purple">claude-3-5-haiku-20241022</Tag>
            </Space>

            <Title level={4}>示例：基本请求</Title>
            <CodeBlock code={`curl -X POST http://localhost:3001/v1/messages \\
  -H "Authorization: Bearer kiro_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'`} />

            <Title level={4}>示例：带 System Prompt</Title>
            <CodeBlock code={`curl -X POST http://localhost:3001/v1/messages \\
  -H "Authorization: Bearer kiro_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "system": "You are a helpful coding assistant.",
    "messages": [
      {"role": "user", "content": "Write hello world in Python"}
    ]
  }'`} />

            <Title level={4}>示例：多轮对话</Title>
            <CodeBlock code={`curl -X POST http://localhost:3001/v1/messages \\
  -H "Authorization: Bearer kiro_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "What is 2+2?"},
      {"role": "assistant", "content": "4"},
      {"role": "user", "content": "What about 3+3?"}
    ]
  }'`} />

            <Title level={4}>响应格式</Title>
            <CodeBlock language="json" code={`{
  "id": "msg_1771713821227",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "响应内容"
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}`} />
          </Card>
        </TabPane>

        {/* OpenAI API */}
        <TabPane tab={<span><CodeOutlined /> OpenAI API</span>} key="openai">
          <Card>
            <Title level={3}>OpenAI Chat Completions API</Title>

            <Title level={4}>端点</Title>
            <CodeBlock code="POST http://localhost:3001/v1/chat/completions" />

            <Title level={4}>认证</Title>
            <Paragraph>支持两种认证方式：</Paragraph>
            <CodeBlock code={`# 方式 1: Authorization Header
Authorization: Bearer YOUR_API_KEY

# 方式 2: x-api-key Header
x-api-key: YOUR_API_KEY`} />

            <Title level={4}>请求参数</Title>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>参数</th>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>类型</th>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>必填</th>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>model</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>string</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Tag color="red">是</Tag></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>模型 ID</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>messages</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>array</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Tag color="red">是</Tag></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>对话消息数组</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>max_tokens</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>integer</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Tag color="blue">否</Tag></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>最大生成 token 数</td>
                </tr>
              </tbody>
            </table>

            <Title level={4}>消息格式</Title>
            <Paragraph>messages 数组中的每个消息对象支持以下 role：</Paragraph>
            <ul>
              <li><Text code>system</Text> - 系统消息（设置助手行为）</li>
              <li><Text code>user</Text> - 用户消息</li>
              <li><Text code>assistant</Text> - 助手消息</li>
            </ul>

            <Title level={4}>示例：基本请求</Title>
            <CodeBlock code={`curl -X POST http://localhost:3001/v1/chat/completions \\
  -H "Authorization: Bearer kiro_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "max_tokens": 100
  }'`} />

            <Title level={4}>示例：带 System 消息</Title>
            <CodeBlock code={`curl -X POST http://localhost:3001/v1/chat/completions \\
  -H "Authorization: Bearer kiro_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is 2+2?"}
    ],
    "max_tokens": 100
  }'`} />

            <Title level={4}>示例：多轮对话</Title>
            <CodeBlock code={`curl -X POST http://localhost:3001/v1/chat/completions \\
  -H "Authorization: Bearer kiro_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "What is 2+2?"},
      {"role": "assistant", "content": "4"},
      {"role": "user", "content": "What about 3+3?"}
    ],
    "max_tokens": 100
  }'`} />

            <Title level={4}>响应格式</Title>
            <CodeBlock language="json" code={`{
  "id": "chatcmpl-1771714336862",
  "object": "chat.completion",
  "created": 1771714336,
  "model": "claude-sonnet-4-20250514",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "响应内容"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}`} />
          </Card>
        </TabPane>

        {/* SDK 示例 */}
        <TabPane tab={<span><CodeOutlined /> SDK 示例</span>} key="sdk">
          <Card>
            <Title level={3}>SDK 使用示例</Title>

            <Title level={4}>Python - Anthropic SDK</Title>
            <CodeBlock language="python" code={`from anthropic import Anthropic

client = Anthropic(
    api_key="kiro_xxxxx",
    base_url="http://localhost:3001/v1"
)

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.content[0].text)`} />

            <Divider />

            <Title level={4}>Python - OpenAI SDK</Title>
            <CodeBlock language="python" code={`from openai import OpenAI

client = OpenAI(
    api_key="kiro_xxxxx",
    base_url="http://localhost:3001/v1"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-20250514",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    max_tokens=100
)

print(response.choices[0].message.content)`} />

            <Divider />

            <Title level={4}>Node.js - OpenAI SDK</Title>
            <CodeBlock language="javascript" code={`const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: 'kiro_xxxxx',
  baseURL: 'http://localhost:3001/v1'
});

async function main() {
  const response = await client.chat.completions.create({
    model: 'claude-sonnet-4-20250514',
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
    max_tokens: 100
  });

  console.log(response.choices[0].message.content);
}

main();`} />

            <Divider />

            <Title level={4}>Claude Code CLI</Title>
            <CodeBlock code={`# 设置环境变量
export ANTHROPIC_BASE_URL="http://localhost:3001/v1"
export ANTHROPIC_API_KEY="kiro_xxxxx"

# 使用 Claude Code
claude-code "你的问题"`} />
          </Card>
        </TabPane>

        {/* 错误处理 */}
        <TabPane tab={<span><CodeOutlined /> 错误处理</span>} key="errors">
          <Card>
            <Title level={3}>错误处理</Title>

            <Title level={4}>错误类型</Title>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>错误类型</th>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>HTTP 状态码</th>
                  <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>authentication_error</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>401</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>API 密钥无效或缺失</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>invalid_request_error</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>400</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>请求参数错误</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}><Text code>api_error</Text></td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>500</td>
                  <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>服务器内部错误</td>
                </tr>
              </tbody>
            </table>

            <Title level={4}>Anthropic API 错误响应</Title>
            <CodeBlock language="json" code={`{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "API 密钥无效"
  }
}`} />

            <Title level={4}>OpenAI API 错误响应</Title>
            <CodeBlock language="json" code={`{
  "error": {
    "message": "API 密钥无效",
    "type": "authentication_error",
    "param": null,
    "code": null
  }
}`} />

            <Title level={4}>常见问题排查</Title>
            <Alert
              message="401 错误"
              description={
                <ul style={{ marginBottom: 0 }}>
                  <li>检查 API 密钥是否正确</li>
                  <li>确认 API 密钥未被禁用</li>
                  <li>检查 Authorization 头格式是否正确</li>
                </ul>
              }
              type="warning"
              style={{ marginBottom: 16 }}
            />
            <Alert
              message="500 错误"
              description={
                <ul style={{ marginBottom: 0 }}>
                  <li>检查是否有可用的 AWS Token</li>
                  <li>在「Token管理」中验证 Token 有效性</li>
                  <li>查看后端日志排查问题</li>
                </ul>
              }
              type="error"
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default ApiDocumentation;
