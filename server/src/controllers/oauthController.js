const { db } = require('../config/database');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const {
  registerClient,
  startDeviceAuthorization,
  pollForToken,
  validateAccessToken
} = require('../utils/oauthHelper');

// 存储 OAuth 会话（生产环境应使用 Redis）
const oauthSessions = new Map();

// 清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthSessions.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) { // 30分钟过期
      oauthSessions.delete(key);
    }
  }
}, 60 * 1000);

/**
 * 初始化设备授权流程
 * 返回用户需要访问的 URL 和验证码
 */
exports.initiateDeviceAuth = async (req, res) => {
  try {
    // 1. 注册客户端（或使用缓存的客户端信息）
    let clientInfo = oauthSessions.get('client_info');
    
    if (!clientInfo || Date.now() > clientInfo.expiresAt) {
      console.log('注册新的 OIDC 客户端...');
      const registration = await registerClient();
      
      clientInfo = {
        clientId: registration.clientId,
        clientSecret: registration.clientSecret,
        expiresAt: registration.clientSecretExpiresAt * 1000,
        timestamp: Date.now()
      };
      
      oauthSessions.set('client_info', clientInfo);
    }
    
    // 2. 启动设备授权
    const deviceAuth = await startDeviceAuthorization(
      clientInfo.clientId,
      clientInfo.clientSecret
    );
    
    // 3. 生成会话 ID
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    
    // 4. 存储会话信息
    oauthSessions.set(sessionId, {
      clientId: clientInfo.clientId,
      clientSecret: clientInfo.clientSecret,
      deviceCode: deviceAuth.deviceCode,
      interval: deviceAuth.interval,
      expiresAt: Date.now() + (deviceAuth.expiresIn * 1000),
      timestamp: Date.now()
    });
    
    // 5. 返回给前端
    res.json({
      sessionId: sessionId,
      userCode: deviceAuth.userCode,
      verificationUri: deviceAuth.verificationUri,
      verificationUriComplete: deviceAuth.verificationUriComplete,
      expiresIn: deviceAuth.expiresIn,
      interval: deviceAuth.interval
    });
  } catch (error) {
    console.error('Device auth initiation error:', error);
    res.status(500).json({ 
      error: '设备授权初始化失败',
      message: error.message 
    });
  }
};

/**
 * 轮询检查授权状态
 * 前端定期调用此接口检查用户是否完成授权
 */
exports.pollAuthStatus = async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: '缺少 sessionId' });
  }
  
  const session = oauthSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ 
      error: '会话不存在或已过期',
      status: 'expired'
    });
  }
  
  // 检查是否过期
  if (Date.now() > session.expiresAt) {
    oauthSessions.delete(sessionId);
    return res.json({ 
      status: 'expired',
      message: '授权已过期，请重新开始'
    });
  }
  
  try {
    // 尝试获取 token（单次尝试，不阻塞）
    const tokens = await pollForToken(
      session.clientId,
      session.clientSecret,
      session.deviceCode,
      session.interval,
      1 // 只尝试一次
    );
    
    // 成功获取 token
    oauthSessions.delete(sessionId);
    
    // 验证 token
    const validation = await validateAccessToken(tokens.accessToken);
    
    if (!validation.valid) {
      return res.json({
        status: 'error',
        message: 'Token 验证失败'
      });
    }
    
    // 查找或创建用户
    const userEmail = validation.userInfo?.email || `aws_user_${Date.now()}`;
    
    db.get('SELECT * FROM users WHERE username = ?', [userEmail], (err, user) => {
      if (err) {
        return res.status(500).json({ 
          status: 'error',
          error: '数据库错误' 
        });
      }
      
      const handleUserLogin = (userId) => {
        // 存储 refresh token
        db.run(
          `INSERT INTO tokens (auth_type, refresh_token, description, user_id)
           VALUES (?, ?, ?, ?)`,
          ['Social', tokens.refreshToken, 'AWS SSO 设备授权自动获取', userId],
          function (err) {
            if (err) {
              console.error('❌ 存储 refresh token 失败:', err);
              return res.status(500).json({
                status: 'error',
                error: '存储 token 失败',
                message: err.message
              });
            }
            
            const tokenId = this.lastID;
            console.log(`✅ 成功存储 refresh token (ID: ${tokenId}) 到用户 ${userId}`);
            
            // 生成 JWT
            const jwtToken = jwt.sign(
              { id: userId, username: userEmail, role: 'user' },
              config.jwtSecret,
              { expiresIn: config.jwtExpire }
            );
            
            res.json({
              status: 'success',
              token: jwtToken,
              user: {
                id: userId,
                username: userEmail,
                role: 'user'
              },
              tokenInfo: {
                id: tokenId,
                description: 'AWS SSO 设备授权自动获取',
                created: true
              }
            });
          }
        );
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
              return res.status(500).json({ 
                status: 'error',
                error: '用户创建失败' 
              });
            }
            handleUserLogin(this.lastID);
          }
        );
      }
    });
  } catch (error) {
    // 授权待处理或其他错误
    if (error.message.includes('authorization_pending') || error.message.includes('授权')) {
      return res.json({
        status: 'pending',
        message: '等待用户授权'
      });
    }
    
    res.json({
      status: 'error',
      message: error.message
    });
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
