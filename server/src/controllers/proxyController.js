const axios = require('axios');
const crypto = require('crypto');
const { db } = require('../config/database');
const awsApi = require('../utils/awsApi');
const EventStreamParser = require('../utils/eventStreamParser');

// AWS CodeWhisperer API URL
const CODEWHISPERER_URL = 'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse';

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

// 提取消息内容
const extractMessageContent = (content) => {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const textParts = [];
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        textParts.push(item.text);
      }
    }
    return textParts.join('\n');
  }
  return '';
};

// 转换 Anthropic 请求到 CodeWhisperer 格式
const convertToCodeWhisperer = (anthropicReq, conversationId) => {
  const model = anthropicReq.model;
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

  // 1. 处理 system 消息
  if (system) {
    const systemContent = typeof system === 'string' ? system : extractMessageContent(system);
    if (systemContent) {
      history.push({
        userInputMessage: {
          content: systemContent,
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
  }

  // 2. 处理历史消息（除了最后一条）
  const historyEndIndex = messages.length - 1;
  let userMessagesBuffer = [];

  for (let i = 0; i < historyEndIndex; i++) {
    const msg = messages[i];

    if (msg.role === 'user') {
      userMessagesBuffer.push(msg);
    } else if (msg.role === 'assistant') {
      if (userMessagesBuffer.length > 0) {
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

          const assistantContent = extractMessageContent(msg.content);
          history.push({
            assistantResponseMessage: {
              content: assistantContent || '',
              toolUses: null
            }
          });
        }

        userMessagesBuffer = [];
      }
    }
  }

  // 3. 构建 CodeWhisperer 请求
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

// 转换 CodeWhisperer 响应到 Anthropic 格式
const convertToAnthropicResponse = (events, model, stopReason = 'end_turn') => {
  // 提取所有内容
  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  for (const event of events) {
    if (event.type === 'content') {
      fullContent += event.content;
    } else if (event.type === 'metering') {
      // 估算 token 使用量（CodeWhisperer 使用 credit，需要转换）
      // 1 credit ≈ 70 tokens (根据经验值)
      const totalTokens = Math.round(event.usage * 70);
      outputTokens = Math.round(totalTokens * 0.7); // 假设 70% 是输出
      inputTokens = totalTokens - outputTokens;
    }
  }

  return {
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: fullContent
      }
    ],
    model: model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens
    }
  };
};

// 转换 CodeWhisperer 响应到 OpenAI 格式
const convertToOpenAIResponse = (events, model) => {
  // 提取所有内容
  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  for (const event of events) {
    if (event.type === 'content') {
      fullContent += event.content;
    } else if (event.type === 'metering') {
      const totalTokens = Math.round(event.usage * 70);
      outputTokens = Math.round(totalTokens * 0.7);
      inputTokens = totalTokens - outputTokens;
    }
  }

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: fullContent
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens
    }
  };
};

// Anthropic Messages API 代理
exports.proxyMessages = async (req, res) => {
  const anthropicReq = req.body;

  // 验证必要参数
  if (!anthropicReq.model || !anthropicReq.messages || anthropicReq.messages.length === 0) {
    return res.status(400).json({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: '缺少必要参数: model 和 messages'
      }
    });
  }

  try {
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

    // 转换请求格式
    const cwRequest = convertToCodeWhisperer(anthropicReq, conversationId);

    console.log('代理请求到 CodeWhisperer:', JSON.stringify(cwRequest, null, 2));

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
        responseType: 'arraybuffer',
        validateStatus: function (status) {
          // 接受 200 和 400 状态码（400 可能是内容长度超限）
          return status === 200 || status === 400;
        }
      }
    );

    // 检查是否是内容长度超限错误
    if (response.status === 400) {
      try {
        const errorData = JSON.parse(response.data.toString());
        if (errorData.reason === 'CONTENT_LENGTH_EXCEEDS_THRESHOLD') {
          console.log('内容长度超限，返回 max_tokens stop_reason');

          // 返回符合 Anthropic 规范的 max_tokens 响应
          return res.json({
            id: `msg_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: '' // 内容为空，因为超出限制
              }
            ],
            model: anthropicReq.model,
            stop_reason: 'max_tokens',
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0
            }
          });
        }
      } catch (parseError) {
        // 如果不是 JSON 或不是内容长度超限错误，继续正常处理
      }
    }

    // 解析 Event Stream 响应
    const parser = new EventStreamParser();
    const events = parser.parse(Buffer.from(response.data));

    // 转换为 Anthropic 响应格式
    const anthropicResponse = convertToAnthropicResponse(events, anthropicReq.model);

    // 记录使用日志
    db.run(
      `INSERT INTO usage_logs (token_id, model, input_tokens, output_tokens, total_tokens, request_time, response_time, status)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
      [
        token.id,
        anthropicReq.model,
        anthropicResponse.usage.input_tokens,
        anthropicResponse.usage.output_tokens,
        anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens,
        0,
        'success'
      ]
    );

    // 更新 token 使用统计
    db.run(
      `UPDATE tokens
       SET usage_count = usage_count + 1,
           last_used = datetime('now')
       WHERE id = ?`,
      [token.id]
    );

    res.json(anthropicResponse);
  } catch (error) {
    console.error('代理请求失败:', error.message);

    // 返回 Anthropic 格式的错误
    res.status(500).json({
      type: 'error',
      error: {
        type: 'api_error',
        message: error.response?.data?.error || error.message
      }
    });
  }
};

// OpenAI Chat Completions API 代理
exports.proxyChatCompletions = async (req, res) => {
  const openaiReq = req.body;

  // 验证必要参数
  if (!openaiReq.model || !openaiReq.messages || openaiReq.messages.length === 0) {
    return res.status(400).json({
      error: {
        message: '缺少必要参数: model 和 messages',
        type: 'invalid_request_error',
        param: null,
        code: null
      }
    });
  }

  try {
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

    // 转换 OpenAI 格式到 Anthropic 格式
    const anthropicMessages = [];
    let systemMessage = '';

    for (const msg of openaiReq.messages) {
      if (msg.role === 'system') {
        systemMessage = extractMessageContent(msg.content);
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    const anthropicReq = {
      model: openaiReq.model,
      messages: anthropicMessages,
      system: systemMessage
    };

    // 转换请求格式
    const cwRequest = convertToCodeWhisperer(anthropicReq, conversationId);

    console.log('OpenAI 代理请求到 CodeWhisperer:', JSON.stringify(cwRequest, null, 2));

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
        responseType: 'arraybuffer',
        validateStatus: function (status) {
          // 接受 200 和 400 状态码（400 可能是内容长度超限）
          return status === 200 || status === 400;
        }
      }
    );

    // 检查是否是内容长度超限错误
    if (response.status === 400) {
      try {
        const errorData = JSON.parse(response.data.toString());
        if (errorData.reason === 'CONTENT_LENGTH_EXCEEDS_THRESHOLD') {
          console.log('OpenAI: 内容长度超限，返回 length finish_reason');

          // 返回符合 OpenAI 规范的 length 响应
          return res.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: openaiReq.model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '' // 内容为空，因为超出限制
                },
                finish_reason: 'length' // OpenAI 使用 'length' 表示达到 token 限制
              }
            ],
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0
            }
          });
        }
      } catch (parseError) {
        // 如果不是 JSON 或不是内容长度超限错误，继续正常处理
      }
    }

    // 解析 Event Stream 响应
    const parser = new EventStreamParser();
    const events = parser.parse(Buffer.from(response.data));

    // 转换为 OpenAI 响应格式
    const openaiResponse = convertToOpenAIResponse(events, openaiReq.model);

    // 记录使用日志
    db.run(
      `INSERT INTO usage_logs (token_id, model, input_tokens, output_tokens, total_tokens, request_time, response_time, status)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
      [
        token.id,
        openaiReq.model,
        openaiResponse.usage.prompt_tokens,
        openaiResponse.usage.completion_tokens,
        openaiResponse.usage.total_tokens,
        0,
        'success'
      ]
    );

    // 更新 token 使用统计
    db.run(
      `UPDATE tokens
       SET usage_count = usage_count + 1,
           last_used = datetime('now')
       WHERE id = ?`,
      [token.id]
    );

    res.json(openaiResponse);
  } catch (error) {
    console.error('OpenAI 代理请求失败:', error.message);

    // 返回 OpenAI 格式的错误
    res.status(500).json({
      error: {
        message: error.response?.data?.error || error.message,
        type: 'api_error',
        param: null,
        code: null
      }
    });
  }
};
