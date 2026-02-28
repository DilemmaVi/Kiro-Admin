const { db } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const svgCaptcha = require('svg-captcha');

// 存储验证码的临时对象（生产环境应使用 Redis）
const captchaStore = new Map();

// 清理过期验证码
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of captchaStore.entries()) {
    if (now - value.timestamp > 5 * 60 * 1000) { // 5分钟过期
      captchaStore.delete(key);
    }
  }
}, 60 * 1000); // 每分钟清理一次

// 生成验证码
exports.getCaptcha = (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: true,
    background: '#f0f0f0',
    width: 120,
    height: 48
  });

  const captchaId = Date.now() + Math.random().toString(36).substring(7);

  // 存储验证码（不区分大小写）
  captchaStore.set(captchaId, {
    text: captcha.text.toLowerCase(),
    timestamp: Date.now()
  });

  // 设置 cookie 存储验证码 ID
  res.cookie('captchaId', captchaId, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    maxAge: 5 * 60 * 1000 // 5分钟
  });

  res.type('svg');
  res.send(captcha.data);
};

// 登录
exports.login = (req, res) => {
  const { username, password, captcha } = req.body;
  const captchaId = req.cookies.captchaId;

  // 验证验证码
  if (!captchaId || !captchaStore.has(captchaId)) {
    return res.status(400).json({ error: '验证码已过期，请刷新' });
  }

  const storedCaptcha = captchaStore.get(captchaId);
  captchaStore.delete(captchaId); // 验证码一次性使用

  if (!captcha || captcha.toLowerCase() !== storedCaptcha.text) {
    return res.status(400).json({ error: '验证码错误' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpire }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  });
};

// 修改密码
exports.changePassword = (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少为6位' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    const isValidPassword = bcrypt.compareSync(oldPassword, user.password);

    if (!isValidPassword) {
      return res.status(400).json({ error: '原密码错误' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    db.run(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: '密码修改失败' });
        }
        res.json({ message: '密码修改成功' });
      }
    );
  });
};
