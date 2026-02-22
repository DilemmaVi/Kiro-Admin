const { db } = require('../config/database');

// API 密钥认证中间件
const apiKeyAuth = (req, res, next) => {
  // 提取 API 密钥
  let apiKey = req.headers['authorization'];

  if (!apiKey) {
    apiKey = req.headers['x-api-key'];
  } else {
    // 移除 "Bearer " 前缀
    apiKey = apiKey.replace(/^Bearer\s+/i, '');
  }

  if (!apiKey) {
    return res.status(401).json({
      type: 'error',
      error: {
        type: 'authentication_error',
        message: '缺少 API 密钥'
      }
    });
  }

  // 验证 API 密钥
  db.get(
    'SELECT * FROM api_keys WHERE key_value = ? AND disabled = 0',
    [apiKey],
    (err, row) => {
      if (err) {
        console.error('数据库查询错误:', err);
        return res.status(500).json({
          type: 'error',
          error: {
            type: 'api_error',
            message: '服务器内部错误'
          }
        });
      }

      if (!row) {
        return res.status(401).json({
          type: 'error',
          error: {
            type: 'authentication_error',
            message: 'API 密钥无效'
          }
        });
      }

      // API 密钥有效，继续处理请求
      req.apiKey = row;
      next();
    }
  );
};

module.exports = apiKeyAuth;
