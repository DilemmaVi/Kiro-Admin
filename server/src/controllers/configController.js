const { db } = require('../config/database');

// 获取所有系统配置
exports.getAllConfigs = (req, res) => {
  db.all('SELECT * FROM system_config ORDER BY config_key', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
};

// 更新系统配置
exports.updateConfig = (req, res) => {
  const { config_key, config_value, description } = req.body;

  db.run(
    `INSERT INTO system_config (config_key, config_value, description)
     VALUES (?, ?, ?)
     ON CONFLICT(config_key) DO UPDATE SET
       config_value = excluded.config_value,
       description = excluded.description,
       updated_at = CURRENT_TIMESTAMP`,
    [config_key, config_value, description],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '更新失败' });
      }
      res.json({ message: '更新成功' });
    }
  );
};

// 批量更新配置
exports.batchUpdateConfigs = (req, res) => {
  const configs = req.body;

  if (!Array.isArray(configs)) {
    return res.status(400).json({ error: '请求格式错误' });
  }

  const stmt = db.prepare(`
    INSERT INTO system_config (config_key, config_value, description)
    VALUES (?, ?, ?)
    ON CONFLICT(config_key) DO UPDATE SET
      config_value = excluded.config_value,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    configs.forEach(config => {
      stmt.run([config.config_key, config.config_value, config.description]);
    });

    stmt.finalize();

    db.run('COMMIT', (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: '批量更新失败' });
      }
      res.json({ message: '批量更新成功' });
    });
  });
};

// 导出环境变量格式
exports.exportEnv = (req, res) => {
  db.all('SELECT * FROM system_config ORDER BY config_key', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    const envContent = rows
      .map(row => `${row.config_key}=${row.config_value}`)
      .join('\n');

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=".env"');
    res.send(envContent);
  });
};
