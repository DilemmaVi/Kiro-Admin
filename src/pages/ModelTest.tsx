import React, { useState, useEffect, useRef } from 'react';
import { Card, Select, Radio, Input, Button, Space, message, Spin, Tag, Divider } from 'antd';
import { SendOutlined, ClearOutlined, ApiOutlined } from '@ant-design/icons';
import api from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Model {
  id: string;
  display_name: string;
  internal_model_id: string;
}

const ModelTest: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [apiStandard, setApiStandard] = useState<'anthropic' | 'openai'>('anthropic');
  const [apiSource, setApiSource] = useState<'codewhisperer' | 'anthropic'>('codewhisperer');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchModels = async () => {
    try {
      const response = await api.get('/api/models');
      if (response.data && response.data.data) {
        setModels(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedModel(response.data.data[0].id);
        }
      }
    } catch (error) {
      message.error('获取模型列表失败');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputText.trim()) {
      message.warning('请输入消息内容');
      return;
    }

    if (!selectedModel) {
      message.warning('请选择模型');
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      let response;
      const conversationMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      if (apiStandard === 'anthropic') {
        // Anthropic Messages API 标准
        response = await api.post('/api/model-test/chat', {
          model: selectedModel,
          messages: conversationMessages,
          max_tokens: 1024,
          stream: streaming,
          api_standard: 'anthropic',
          system: systemPrompt || undefined,
          use_anthropic_api: apiSource === 'anthropic'
        });
      } else {
        // OpenAI Chat Completions API 标准
        response = await api.post('/api/model-test/chat', {
          model: selectedModel,
          messages: conversationMessages,
          max_tokens: 1024,
          stream: streaming,
          api_standard: 'openai',
          system: systemPrompt || undefined,
          use_anthropic_api: apiSource === 'anthropic'
        });
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.content || response.data.message || '无响应',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      message.error('发送失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setInputText('');
    setSystemPrompt('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div>
      <h2>模型测试</h2>

      {/* 配置区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <label style={{ marginRight: 8, fontWeight: 500 }}>选择模型:</label>
            <Select
              style={{ width: 300 }}
              value={selectedModel}
              onChange={setSelectedModel}
              placeholder="请选择模型"
            >
              {models.map(model => (
                <Option key={model.id} value={model.id}>
                  {model.display_name || model.id}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <label style={{ marginRight: 8, fontWeight: 500 }}>API 源:</label>
            <Radio.Group value={apiSource} onChange={e => setApiSource(e.target.value)}>
              <Radio.Button value="codewhisperer">
                AWS CodeWhisperer
              </Radio.Button>
              <Radio.Button value="anthropic">
                Anthropic 官方 API
              </Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <label style={{ marginRight: 8, fontWeight: 500 }}>API 标准:</label>
            <Radio.Group value={apiStandard} onChange={e => setApiStandard(e.target.value)}>
              <Radio.Button value="anthropic">
                <ApiOutlined /> Anthropic Messages
              </Radio.Button>
              <Radio.Button value="openai">
                <ApiOutlined /> OpenAI Chat Completions
              </Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <label style={{ marginRight: 8, fontWeight: 500 }}>流式输出:</label>
            <Radio.Group value={streaming} onChange={e => setStreaming(e.target.value)}>
              <Radio.Button value={true}>开启</Radio.Button>
              <Radio.Button value={false}>关闭</Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <label style={{ marginRight: 8, fontWeight: 500, display: 'block', marginBottom: 8 }}>
              系统提示词 (System Prompt):
            </label>
            <TextArea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="可选：输入系统提示词来自定义模型行为。例如：'You are Claude, an AI assistant made by Anthropic.'"
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ width: '100%' }}
            />
          </div>
        </Space>
      </Card>

      {/* 对话区域 */}
      <Card
        title={
          <Space>
            <span>对话窗口</span>
            {messages.length > 0 && (
              <Tag color="blue">{messages.length} 条消息</Tag>
            )}
          </Space>
        }
        extra={
          <Button
            icon={<ClearOutlined />}
            onClick={handleClear}
            disabled={messages.length === 0}
          >
            清空对话
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <div
          style={{
            height: 400,
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px'
          }}
        >
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: 150 }}>
              开始对话吧...
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: msg.role === 'user' ? '#1890ff' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#000',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: 4 }}>
                    {msg.role === 'user' ? '你' : 'AI'}
                  </div>
                  {msg.content}
                  <div style={{ fontSize: '11px', opacity: 0.6, marginTop: 4 }}>
                    {new Date(msg.timestamp).toLocaleTimeString('zh-CN')}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin tip="AI 正在思考..." />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </Card>

      {/* 输入区域 */}
      <Card>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputText.trim() || !selectedModel}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </Space.Compact>
      </Card>

      {/* 说明 */}
      <Card style={{ marginTop: 16 }} title="使用说明">
        <div style={{ lineHeight: '1.8' }}>
          <p><strong>API 标准说明：</strong></p>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Anthropic Messages</strong>: 使用 Anthropic 官方的 Messages API 格式</li>
            <li><strong>OpenAI Chat Completions</strong>: 使用 OpenAI 兼容的 Chat Completions API 格式</li>
          </ul>
          <Divider />
          <p><strong>快捷键：</strong></p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Enter: 发送消息</li>
            <li>Shift + Enter: 换行</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default ModelTest;
