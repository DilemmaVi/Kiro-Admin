const { db } = require('../config/database');
const awsApi = require('../utils/awsApi');

// Token 有效性检测（调用真实的 AWS API）
const checkTokenValidityWithAWS = async (token) => {
  try {
    // 1. 刷新Token获取accessToken
    let tokenResult;
    if (token.auth_type === 'Social') {
      tokenResult = await awsApi.refreshSocialToken(token.refresh_token);
    } else if (token.auth_type === 'IdC') {
      tokenResult = await awsApi.refreshIdCToken(
        token.refresh_token,
        token.client_id,
        token.client_secret
      );
    } else {
      return {
        valid: false,
        message: '不支持的认证类型',
        reason: 'unsupported_auth_type'
      };
    }

    // 2. 检查使用限制
    const usageLimits = await awsApi.checkUsageLimits(tokenResult.accessToken);
    const usageDetails = awsApi.getUsageDetails(usageLimits);

    if (!usageDetails) {
      return {
        valid: false,
        message: '无法获取用量信息',
        reason: 'no_usage_info'
      };
    }

    // 3. 判断是否可用
    if (usageDetails.available <= 0) {
      return {
        valid: false,
        message: `用量已耗尽 (已用: ${usageDetails.totalUsed.toFixed(2)}/${usageDetails.totalLimit.toFixed(2)})`,
        reason: 'quota_exceeded',
        usageDetails
      };
    }

    return {
      valid: true,
      message: `Token有效 (剩余: ${usageDetails.available.toFixed(2)})`,
      reason: 'valid',
      usageDetails
    };
  } catch (error) {
    return {
      valid: false,
      message: error.message || 'Token验证失败',
      reason: 'api_error'
    };
  }
};

// 获取所有Token（包含使用统计，不包含实时检测）
exports.getAllTokens = async (req, res) => {
  const query = `
    SELECT
      t.*,
      COUNT(ul.id) as total_requests,
      SUM(ul.total_tokens) as total_tokens_used,
      SUM(ul.input_tokens) as total_input_tokens,
      SUM(ul.output_tokens) as total_output_tokens,
      MAX(ul.request_time) as last_request_time
    FROM tokens t
    LEFT JOIN usage_logs ul ON t.id = ul.token_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    // 为每个token添加状态信息（不进行实时检测）
    const tokensWithStatus = rows.map(token => ({
      ...token,
      status: token.disabled === 0 ? 'active' : 'disabled',
      total_requests: token.total_requests || 0,
      total_tokens_used: token.total_tokens_used || 0,
      total_input_tokens: token.total_input_tokens || 0,
      total_output_tokens: token.total_output_tokens || 0,
      last_request_time: token.last_request_time || null,
      validity: {
        valid: null,
        message: '点击检测按钮查看状态',
        reason: 'not_checked'
      }
    }));

    res.json(tokensWithStatus);
  });
};

// 获取单个Token
exports.getToken = (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM tokens WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Token不存在' });
    }
    res.json(row);
  });
};

// 创建Token
exports.createToken = (req, res) => {
  const { auth_type, refresh_token, client_id, client_secret, description } = req.body;

  db.run(
    `INSERT INTO tokens (auth_type, refresh_token, client_id, client_secret, description)
     VALUES (?, ?, ?, ?, ?)`,
    [auth_type, refresh_token, client_id, client_secret, description],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '创建失败' });
      }
      res.json({ id: this.lastID, message: '创建成功' });
    }
  );
};

// 更新Token
exports.updateToken = (req, res) => {
  const { id } = req.params;
  const { auth_type, refresh_token, client_id, client_secret, description, disabled } = req.body;

  db.run(
    `UPDATE tokens
     SET auth_type = ?, refresh_token = ?, client_id = ?, client_secret = ?,
         description = ?, disabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [auth_type, refresh_token, client_id, client_secret, description, disabled, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '更新失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Token不存在' });
      }
      res.json({ message: '更新成功' });
    }
  );
};

// 删除Token
exports.deleteToken = (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM tokens WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: '删除失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Token不存在' });
    }
    res.json({ message: '删除成功' });
  });
};

// 切换Token启用状态
exports.toggleToken = (req, res) => {
  const { id } = req.params;

  db.get('SELECT disabled FROM tokens WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Token不存在' });
    }

    const newStatus = row.disabled === 1 ? 0 : 1;

    db.run(
      'UPDATE tokens SET disabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: '更新失败' });
        }
        res.json({ message: '状态更新成功', disabled: newStatus });
      }
    );
  });
};

// 导出Token配置（用于kiro2api）
exports.exportTokens = (req, res) => {
  db.all('SELECT * FROM tokens WHERE disabled = 0 ORDER BY id', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    const config = rows.map(token => {
      const obj = {
        auth: token.auth_type,
        refreshToken: token.refresh_token
      };

      if (token.auth_type === 'IdC') {
        obj.clientId = token.client_id;
        obj.clientSecret = token.client_secret;
      }

      if (token.description) {
        obj.description = token.description;
      }

      return obj;
    });

    res.json(config);
  });
};

// 检测Token有效性（调用AWS API）
exports.checkTokenValidity = async (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM tokens WHERE id = ?', [id], async (err, token) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!token) {
      return res.status(404).json({ error: 'Token不存在' });
    }

    if (token.disabled === 1) {
      return res.json({
        valid: false,
        message: 'Token已被禁用',
        reason: 'disabled'
      });
    }

    // 调用AWS API检测
    const result = await checkTokenValidityWithAWS(token);
    res.json(result);
  });
};

// 批量检测所有Token有效性（调用AWS API）
exports.checkAllTokensValidity = async (req, res) => {
  db.all('SELECT * FROM tokens WHERE disabled = 0', [], async (err, tokens) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    const results = await Promise.all(
      tokens.map(async (token) => ({
        id: token.id,
        description: token.description,
        auth_type: token.auth_type,
        validity: await checkTokenValidityWithAWS(token)
      }))
    );

    res.json(results);
  });
};

// 获取Token详细统计
exports.getTokenStats = (req, res) => {
  const { id } = req.params;

  const queries = {
    tokenInfo: 'SELECT * FROM tokens WHERE id = ?',
    dailyUsage: `
      SELECT
        DATE(request_time) as date,
        COUNT(*) as request_count,
        SUM(total_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens
      FROM usage_logs
      WHERE token_id = ?
      GROUP BY DATE(request_time)
      ORDER BY date DESC
      LIMIT 30
    `,
    modelUsage: `
      SELECT
        model,
        COUNT(*) as request_count,
        SUM(total_tokens) as total_tokens
      FROM usage_logs
      WHERE token_id = ?
      GROUP BY model
      ORDER BY request_count DESC
    `,
    recentLogs: `
      SELECT *
      FROM usage_logs
      WHERE token_id = ?
      ORDER BY request_time DESC
      LIMIT 20
    `
  };

  const results = {};

  db.serialize(() => {
    db.get(queries.tokenInfo, [id], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Token不存在' });
      }
      results.tokenInfo = row;
    });

    db.all(queries.dailyUsage, [id], (err, rows) => {
      results.dailyUsage = rows || [];
    });

    db.all(queries.modelUsage, [id], (err, rows) => {
      results.modelUsage = rows || [];
    });

    db.all(queries.recentLogs, [id], (err, rows) => {
      results.recentLogs = rows || [];
      res.json(results);
    });
  });
};
