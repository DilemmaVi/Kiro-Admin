// 内置的模型映射表（从 kiro2api 复制）
const MODEL_MAP = {
  'claude-sonnet-4-5': 'CLAUDE_SONNET_4_5_20250929_V1_0',
  'claude-sonnet-4-5-20250929': 'CLAUDE_SONNET_4_5_20250929_V1_0',
  'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3-7-sonnet-20250219': 'CLAUDE_3_7_SONNET_20250219_V1_0',
  'claude-3-5-haiku-20241022': 'auto',
  'claude-haiku-4-5-20251001': 'auto'
};

// 模型描述信息
const MODEL_DESCRIPTIONS = {
  'claude-sonnet-4-5': 'Claude Sonnet 4.5 - 最新版本，性能最强',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 (2025-09-29)',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4 (2025-05-14)',
  'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet (2025-02-19)',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku - 快速响应',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5 - 超快速响应'
};

// 获取模型列表
exports.getModelsFromKiro = (req, res) => {
  try {
    // 构建模型列表
    const models = Object.keys(MODEL_MAP).map(modelName => ({
      id: modelName,
      object: 'model',
      created: 1234567890,
      owned_by: 'anthropic',
      display_name: modelName,
      type: 'text',
      max_tokens: 200000,
      internal_model_id: MODEL_MAP[modelName],
      description: MODEL_DESCRIPTIONS[modelName] || ''
    }));

    const response = {
      object: 'list',
      data: models
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: '获取模型列表失败',
      message: error.message
    });
  }
};

// 获取模型详情
exports.getModelDetail = (req, res) => {
  const { modelId } = req.params;

  try {
    if (!MODEL_MAP[modelId]) {
      return res.status(404).json({
        error: '模型不存在',
        message: `未找到模型: ${modelId}`
      });
    }

    const model = {
      id: modelId,
      object: 'model',
      created: 1234567890,
      owned_by: 'anthropic',
      display_name: modelId,
      type: 'text',
      max_tokens: 200000,
      internal_model_id: MODEL_MAP[modelId],
      description: MODEL_DESCRIPTIONS[modelId] || ''
    };

    res.json(model);
  } catch (error) {
    res.status(500).json({
      error: '获取模型详情失败',
      message: error.message
    });
  }
};
