const { db } = require('../config/database');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const {
  generatePKCE,
  generateAuthorizationUrl,
  exchangeCodeForToken,
  validateAccessToken
} = require('../utils/oauthHelper');

// 存储 OAuth 会话（生产环境应使用 Redis）
const oauthSessions = new Map();

// 清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthSessions.entries()) {
    if (now - value.timestamp > 10 * 60 * 1000) { // 10分钟过期
      oauthSessions.delete(key);
    }
  }
}, 60 * 1000);

/**
 * 初始化 OAuth 授权流程
 */
exports.initiateOAuth = (req, res) => {
  try {
    // 生成 state 和 PKCE
    const state = require('crypto').randomBytes(16).toString('hex');
    const pkce = generatePKCE();
    
    // 存储会话信息
    oauthSessions.set(state, {
      codeVerifier: pkce.codeVerifier,
      timestamp: Date.now()
    });
    
    // 生成授权 URL
    const authUrl = generateAuthorizationUrl(state, pkce);
    
    res.json({
      authUrl,
      state
    });
  } catch (error) {
    console.error('OAuth initiation error:', error);
    res.status(500).json({ error: 'OAuth 初始化失败' });
  }
};

/**
 * OAuth 回调处理
 */
exports.handleOAuthCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;
  
  // 检查是否有错误
  if (error) {
    return res.redirect(`/login?error=${encodeURIComponent(error_description || error)}`);
  }
  
  // 验证必需参数
  if (!code || !state) {
    return res.redirect('/login?error=缺少必需参数');
  }
  
  // 验证 state
  const session = oauthSessions.get(state);
  if (!session) {
    return res.redirect('/login?error=无效的会话或会话已过期');
  }
  
  // 删除已使用的会话
  oauthSessions.delete(state);
  
  try {
    // 使用授权码交换 token
    const tokens = await exchangeCodeForToken(code, session.codeVerifier);
    
    // 验证 access token
    const validation = await validateAccessToken(tokens.accessToken);
    if (!validation.valid) {
      return res.redirect('/login?error=Token验证失败');
    }
    
    // 查找或创建用户
    const userEmail = validation.userInfo?.email || 'oauth_user';
    
    db.get('SELECT * FROM users WHERE username = ?', [userEmail], (err, user) => {
      if (err) {
        return res.redirect('/login?error=数据库错误');
      }
      
      const handleUserLogin = (userId) => {
        // 存储 refresh token
        db.run(
          `INSERT INTO tokens (auth_type, refresh_token, description, user_id)
           VALUES (?, ?, ?, ?)`,
          ['Social', tokens.refreshToken, 'OAuth 自动获取', userId],
          (err) => {
            if (err) {
              console.error('Failed to store refresh token:', err);
            }
          }
        );
        
        // 生成 JWT
        const jwtToken = jwt.sign(
          { id: userId, username: userEmail, role: 'user' },
          config.jwtSecret,
          { expiresIn: config.jwtExpire }
        );
        
        // 重定向到前端，携带 token
        res.redirect(`/login?token=${jwtToken}&success=1`);
      };
      
      if (user) {
        // 用户已存在
        handleUserLogin(user.id);
      } else {
        // 创建新用户
        const bcrypt = require('bcryptjs');
        const randomPassword = require('crypto').randomBytes(16).toString('hex');
        const hashedPassword = bcrypt.hashSync(randomPassword, 10);
        
        db.run(
          `INSERT INTO users (username, password, role)
           VALUES (?, ?, ?)`,
          [userEmail, hashedPassword, 'user'],
          function (err) {
            if (err) {
              return res.redirect('/login?error=用户创建失败');
            }
            handleUserLogin(this.lastID);
          }
        );
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * 获取 OAuth 状态
 */
exports.getOAuthStatus = (req, res) => {
  // 检查用户是否有有效的 refresh token
  const userId = req.user.id;
  
  db.get(
    'SELECT * FROM tokens WHERE user_id = ? AND auth_type = ? AND disabled = 0 ORDER BY created_at DESC LIMIT 1',
    [userId, 'Social'],
    (err, token) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      res.json({
        hasToken: !!token,
        token: token ? {
          id: token.id,
          description: token.description,
          created_at: token.created_at
        } : null
      });
    }
  );
};
