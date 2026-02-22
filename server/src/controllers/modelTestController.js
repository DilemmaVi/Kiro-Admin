const axios = require('axios');
const crypto = require('crypto');
const { db } = require('../config/database');
const awsApi = require('../utils/awsApi');
const EventStreamParser = require('../utils/eventStreamParser');

// AWS CodeWhisperer API URL
const CODEWHISPERER_URL = 'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse';

// Anthropic API URL
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// 模型映射
const MODEL_MAP = {
  'claude-sonnet-4-5': 'CLAUDE_SONNET_4_5_20250929_V1_0',
  'claude-sonnet-4-5-20250929': 'CLAUDE_SONNET_4_5_20250929_V1_0',
  'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3-7-sonnet-20250219': 'CLAUDE_3_7_SONNET_20250219_V1_0',
  'claude-3-5-haiku-20241022': 'auto'
};

// 生成会话ID
const generateConversationId = () => {
  return `conv-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
};

// 生成代理ID
const generateAgentContinuationId = () => {
  return `agent-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
};

// 获取可用的 token
const getAvailableToken = () => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM tokens WHERE disabled = 0 ORDER BY id LIMIT 1',
      (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          reject(new Error('没有可用的 Token'));
        } else {
          resolve(row);
        }
      }
    );
  });
};

// 提取消息内容（支持字符串和数组格式）
const extractMessageContent = (content) => {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        return item.text;
      }
    }
  }
  return '';
};

// 转换 Anthropic 消息格式到 CodeWhisperer 格式
// 参考 kiro2api/converter/codewhisperer.go 的 BuildCodeWhispererRequest 函数
const convertAnthropicToCodeWhisperer = (anthropicReq, model, conversationId) => {
  const internalModelId = MODEL_MAP[model] || MODEL_MAP['claude-sonnet-4-5'];
  const messages = anthropicReq.messages || [];
  const system = anthropicReq.system || '';

  if (messages.length === 0) {
    throw new Error('消息列表为空');
  }

  // 获取最后一条消息
  const lastMessage = messages[messages.length - 1];
  const lastMessageContent = extractMessageContent(lastMessage.content);

  // 构建历史消息
  const history = [];

  // 1. 首先处理 system 消息（如果有）
  // 参考 kiro2api: 将 system 消息转换为 user-assistant 对话对
  if (system) {
    history.push({
      userInputMessage: {
        content: system,
        modelId: internalModelId,
        origin: 'AI_EDITOR',
        images: [],
        userInputMessageContext: {
          tools: [],
          toolResults: []
        }
      }
    });
    history.push({
      assistantResponseMessage: {
        content: 'OK',
        toolUses: null
      }
    });
  }

  // 2. 处理历史消息（除了最后一条）
  // 参考 kiro2api: 合并连续的 user 消息，然后与 assistant 配对
  const historyEndIndex = messages.length - 1;
  let userMessagesBuffer = [];

  for (let i = 0; i < historyEndIndex; i++) {
    const msg = messages[i];

    if (msg.role === 'user') {
      // 收集连续的 user 消息
      userMessagesBuffer.push(msg);
    } else if (msg.role === 'assistant') {
      // 遇到 assistant，处理之前累积的 user 消息
      if (userMessagesBuffer.length > 0) {
        // 合并所有 user 消息的内容
        const mergedContent = userMessagesBuffer
          .map(m => extractMessageContent(m.content))
          .filter(c => c)
          .join('\n');

        if (mergedContent) {
          history.push({
            userInputMessage: {
              content: mergedContent,
              modelId: internalModelId,
              origin: 'AI_EDITOR',
              images: [],
              userInputMessageContext: {
                tools: [],
                toolResults: []
              }
            }
          });

          // 添加 assistant 响应
          const assistantContent = extractMessageContent(msg.content);
          history.push({
            assistantResponseMessage: {
              content: assistantContent || '',
              toolUses: null
            }
          });
        }

        // 清空缓冲区
        userMessagesBuffer = [];
      }
    }
  }

  // 3. 如果还有未配对的 user 消息（最后是连续的 user 消息），添加到历史
  if (userMessagesBuffer.length > 0 && lastMessage.role !== 'user') {
    const mergedContent = userMessagesBuffer
      .map(m => extractMessageContent(m.content))
      .filter(c => c)
      .join('\n');

    if (mergedContent) {
      history.push({
        userInputMessage: {
          content: mergedContent,
          modelId: internalModelId,
          origin: 'AI_EDITOR',
          images: [],
          userInputMessageContext: {
            tools: [],
            toolResults: []
          }
        }
      });
    }
  }

  // 4. 构建 CodeWhisperer 请求
  return {
    conversationState: {
      agentContinuationId: generateAgentContinuationId(),
      agentTaskType: 'vibe',
      chatTriggerType: 'MANUAL',
      currentMessage: {
        userInputMessage: {
          content: lastMessageContent,
          modelId: internalModelId,
          origin: 'AI_EDITOR',
          images: [],
          userInputMessageContext: {
            tools: [],
            toolResults: []
          }
        }
      },
      conversationId: conversationId,
      history: history
    }
  };
};

// 转换 OpenAI 消息格式到 CodeWhisperer 格式
const convertOpenAIToCodeWhisperer = (openaiReq, model, conversationId) => {
  // OpenAI 格式转换为 Anthropic 格式
  const messages = openaiReq.messages || [];
  const anthropicMessages = [];
  let systemMessage = '';

  // 提取 system 消息
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessage = extractMessageContent(msg.content);
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      anthropicMessages.push({
        role: msg.role,
        content: msg.content
      });
    }
  }

  // 使用 Anthropic 转换函数
  return convertAnthropicToCodeWhisperer(
    {
      messages: anthropicMessages,
      system: systemMessage
    },
    model,
    conversationId
  );
};

// 模型测试 - 聊天接口
exports.testChat = async (req, res) => {
  const { model, messages, max_tokens, stream, api_standard, system, use_anthropic_api } = req.body;

  if (!model || !messages || messages.length === 0) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    // 如果使用 Anthropic 官方 API
    if (use_anthropic_api) {
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) {
        return res.status(400).json({ error: '未配置 ANTHROPIC_API_KEY' });
      }

      // 构建 Anthropic API 请求
      const anthropicRequest = {
        model: model,
        max_tokens: max_tokens || 1024,
        messages: messages
      };

      if (system) {
        anthropicRequest.system = system;
      }

      console.log('发送到 Anthropic API 的请求:', JSON.stringify(anthropicRequest, null, 2));

      // 调用 Anthropic API
      const response = await axios.post(
        ANTHROPIC_API_URL,
        anthropicRequest,
        {
          headers: {
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      // 提取响应内容
      let content = '';
      if (response.data.content && Array.isArray(response.data.content)) {
        for (const block of response.data.content) {
          if (block.type === 'text') {
            content += block.text;
          }
        }
      }

      return res.json({
        success: true,
        content: content,
        model: model,
        api_standard: 'anthropic',
        usage: response.data.usage
      });
    }

    // 使用 AWS CodeWhisperer API（原有逻辑）
    // 获取可用的 token
    const token = await getAvailableToken();

    // 刷新 access token
    let tokenResult;
    if (token.auth_type === 'Social') {
      tokenResult = await awsApi.refreshSocialToken(token.refresh_token);
    } else {
      tokenResult = await awsApi.refreshIdCToken(
        token.refresh_token,
        token.client_id,
        token.client_secret
      );
    }

    // 生成会话ID
    const conversationId = generateConversationId();

    // 构建请求对象
    const requestData = {
      messages: messages,
      system: system || ''
    };

    // 转换请求格式
    let cwRequest;
    if (api_standard === 'openai') {
      cwRequest = convertOpenAIToCodeWhisperer(requestData, model, conversationId);
    } else {
      cwRequest = convertAnthropicToCodeWhisperer(requestData, model, conversationId);
    }

    console.log('发送到 CodeWhisperer 的请求:', JSON.stringify(cwRequest, null, 2));

    // 调用 CodeWhisperer API
    const response = await axios.post(
      CODEWHISPERER_URL,
      cwRequest,
      {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
          'x-amzn-kiro-agent-mode': 'spec',
          'x-amz-user-agent': 'aws-sdk-js/1.0.18 KiroAdmin-1.0.0',
          'user-agent': 'aws-sdk-js/1.0.18 ua/2.1 os/darwin lang/js md/nodejs KiroAdmin-1.0.0'
        },
        timeout: 60000,
        responseType: 'arraybuffer'
      }
    );

    // 解析 Event Stream 响应
    const parser = new EventStreamParser();
    const events = parser.parse(Buffer.from(response.data));

    // 提取所有内容
    let fullContent = '';
    for (const event of events) {
      if (event.type === 'content') {
        fullContent += event.content;
      }
    }

    res.json({
      success: true,
      content: fullContent,
      model: model,
      api_standard: api_standard
    });
  } catch (error) {
    console.error('模型测试失败:', error.message);
    res.status(500).json({
      error: '模型测试失败',
      message: error.response?.data?.error || error.message,
      details: error.response?.data
    });
  }
};
