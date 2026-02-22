const { db } = require('../config/database');
const axios = require('axios');
const config = require('../config/config');

// 获取使用统计
exports.getUsageStats = (req, res) => {
  const { startDate, endDate } = req.query;

  let query = `
    SELECT
      DATE(request_time) as date,
      COUNT(*) as request_count,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(total_tokens) as total_tokens,
      AVG(response_time) as avg_response_time
    FROM usage_logs
  `;

  const params = [];

  if (startDate && endDate) {
    query += ' WHERE DATE(request_time) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  query += ' GROUP BY DATE(request_time) ORDER BY date DESC LIMIT 30';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
};

// 获取Token使用统计
exports.getTokenUsageStats = (req, res) => {
  const query = `
    SELECT
      t.id,
      t.description,
      t.auth_type,
      t.usage_count,
      t.last_used,
      COUNT(ul.id) as request_count,
      SUM(ul.total_tokens) as total_tokens
    FROM tokens t
    LEFT JOIN usage_logs ul ON t.id = ul.token_id
    GROUP BY t.id
    ORDER BY t.usage_count DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
};

// 获取模型使用统计
exports.getModelStats = (req, res) => {
  const query = `
    SELECT
      model,
      COUNT(*) as request_count,
      SUM(total_tokens) as total_tokens,
      AVG(response_time) as avg_response_time
    FROM usage_logs
    WHERE model IS NOT NULL
    GROUP BY model
    ORDER BY request_count DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
};

// 记录使用日志
exports.logUsage = (req, res) => {
  const { token_id, model, input_tokens, output_tokens, total_tokens, response_time, status, error_message } = req.body;

  db.run(
    `INSERT INTO usage_logs (token_id, model, input_tokens, output_tokens, total_tokens, response_time, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [token_id, model, input_tokens, output_tokens, total_tokens, response_time, status, error_message],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '记录失败' });
      }

      // 更新token使用次数
      if (token_id) {
        db.run(
          'UPDATE tokens SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?',
          [token_id]
        );
      }

      res.json({ id: this.lastID, message: '记录成功' });
    }
  );
};

// 获取kiro2api状态
exports.getKiroStatus = async (req, res) => {
  try {
    const response = await axios.get(`${config.kiroApiUrl}/api/tokens`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: '无法连接到kiro2api服务',
      message: error.message
    });
  }
};

// 获取仪表盘概览数据
exports.getDashboardOverview = (req, res) => {
  const queries = {
    totalTokens: 'SELECT COUNT(*) as count FROM tokens WHERE disabled = 0',
    totalApiKeys: 'SELECT COUNT(*) as count FROM api_keys WHERE disabled = 0',
    todayRequests: `SELECT COUNT(*) as count FROM usage_logs WHERE DATE(request_time) = DATE('now')`,
    todayTokens: `SELECT SUM(total_tokens) as total FROM usage_logs WHERE DATE(request_time) = DATE('now')`,
    recentLogs: 'SELECT * FROM usage_logs ORDER BY request_time DESC LIMIT 10'
  };

  const results = {};

  db.serialize(() => {
    db.get(queries.totalTokens, [], (err, row) => {
      results.totalTokens = row?.count || 0;
    });

    db.get(queries.totalApiKeys, [], (err, row) => {
      results.totalApiKeys = row?.count || 0;
    });

    db.get(queries.todayRequests, [], (err, row) => {
      results.todayRequests = row?.count || 0;
    });

    db.get(queries.todayTokens, [], (err, row) => {
      results.todayTokens = row?.total || 0;
    });

    db.all(queries.recentLogs, [], (err, rows) => {
      results.recentLogs = rows || [];
      res.json(results);
    });
  });
};

// 清理使用日志
exports.clearUsageLogs = (req, res) => {
  const { startDate, endDate } = req.body;

  console.log('清理请求参数:', { startDate, endDate });

  let query = 'DELETE FROM usage_logs';
  const params = [];

  // 如果指定了日期范围，只删除该范围内的数据
  if (startDate && endDate) {
    query += ' WHERE DATE(request_time) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  } else if (startDate) {
    query += ' WHERE DATE(request_time) >= ?';
    params.push(startDate);
  } else if (endDate) {
    query += ' WHERE DATE(request_time) <= ?';
    params.push(endDate);
  }

  console.log('执行SQL:', query, '参数:', params);

  db.run(query, params, function (err) {
    if (err) {
      console.error('清理失败:', err);
      return res.status(500).json({ error: '清理失败', details: err.message });
    }

    console.log('删除记录数:', this.changes);

    // 重置所有token的使用计数（如果是全部清理）
    if (!startDate && !endDate) {
      db.run('UPDATE tokens SET usage_count = 0', [], (err) => {
        if (err) {
          console.error('重置token使用计数失败:', err);
        }
      });
    }

    res.json({
      message: '清理成功',
      deletedCount: this.changes
    });
  });
};
