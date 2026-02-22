const { db } = require('../config/database');

// 获取所有API密钥
exports.getAllApiKeys = (req, res) => {
  db.all('SELECT * FROM api_keys ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
};

// 创建API密钥
exports.createApiKey = (req, res) => {
  const { key_name, key_value, description } = req.body;

  db.run(
    `INSERT INTO api_keys (key_name, key_value, description)
     VALUES (?, ?, ?)`,
    [key_name, key_value, description],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'API密钥已存在' });
        }
        return res.status(500).json({ error: '创建失败' });
      }
      res.json({ id: this.lastID, message: '创建成功' });
    }
  );
};

// 更新API密钥
exports.updateApiKey = (req, res) => {
  const { id } = req.params;
  const { key_name, key_value, description, disabled } = req.body;

  db.run(
    `UPDATE api_keys
     SET key_name = ?, key_value = ?, description = ?, disabled = ?
     WHERE id = ?`,
    [key_name, key_value, description, disabled, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '更新失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'API密钥不存在' });
      }
      res.json({ message: '更新成功' });
    }
  );
};

// 删除API密钥
exports.deleteApiKey = (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM api_keys WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: '删除失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'API密钥不存在' });
    }
    res.json({ message: '删除成功' });
  });
};

// 切换API密钥启用状态
exports.toggleApiKey = (req, res) => {
  const { id } = req.params;

  db.get('SELECT disabled FROM api_keys WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!row) {
      return res.status(404).json({ error: 'API密钥不存在' });
    }

    const newStatus = row.disabled === 1 ? 0 : 1;

    db.run(
      'UPDATE api_keys SET disabled = ? WHERE id = ?',
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
