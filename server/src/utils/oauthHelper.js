const axios = require('axios');
const crypto = require('crypto');

// AWS OAuth 配置
const AWS_OAUTH_CONFIG = {
  // AWS SSO OAuth 端点
  authorizationEndpoint: 'https://prod.us-east-1.auth.desktop.kiro.dev/authorize',
  tokenEndpoint: 'https://prod.us-east-1.auth.desktop.kiro.dev/token',
  refreshEndpoint: 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken',
  
  // 客户端配置（模拟 Kiro 客户端）
  clientId: 'kiro-desktop-client',
  clientType: 'public', // public client 不需要 client_secret
  
  // 重定向 URI
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3001/api/auth/oauth/callback',
  
  // Scopes
  scopes: ['codewhisperer:completions', 'codewhisperer:analysis']
};

/**
 * 生成 PKCE 验证码
 */
function generatePKCE() {
  // 生成 code_verifier (43-128 字符的随机字符串)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  
  // 生成 code_challenge (code_verifier 的 SHA256 hash)
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

/**
 * 生成 OAuth 授权 URL
 */
function generateAuthorizationUrl(state, pkce) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: AWS_OAUTH_CONFIG.clientId,
    redirect_uri: AWS_OAUTH_CONFIG.redirectUri,
    scope: AWS_OAUTH_CONFIG.scopes.join(' '),
    state: state,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: pkce.codeChallengeMethod
  });
  
  return `${AWS_OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;
}

/**
 * 使用授权码交换 token
 */
async function exchangeCodeForToken(code, codeVerifier) {
  try {
    const response = await axios.post(
      AWS_OAUTH_CONFIG.tokenEndpoint,
      {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: AWS_OAUTH_CONFIG.redirectUri,
        client_id: AWS_OAUTH_CONFIG.clientId,
        code_verifier: codeVerifier
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    return {
      accessToken: response.data.accessToken || response.data.access_token,
      refreshToken: response.data.refreshToken || response.data.refresh_token,
      expiresIn: response.data.expiresIn || response.data.expires_in || 3600,
      tokenType: response.data.tokenType || response.data.token_type || 'Bearer'
    };
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    throw new Error(`Token 交换失败: ${error.response?.data?.error_description || error.message}`);
  }
}

/**
 * 使用 refresh token 获取新的 access token
 */
async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post(
      AWS_OAUTH_CONFIG.refreshEndpoint,
      {
        refreshToken: refreshToken
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    return {
      accessToken: response.data.accessToken || response.data.access_token,
      expiresIn: response.data.expiresIn || response.data.expires_in || 3600
    };
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    throw new Error(`Token 刷新失败: ${error.response?.data?.error_description || error.message}`);
  }
}

/**
 * 验证 access token 是否有效
 */
async function validateAccessToken(accessToken) {
  try {
    // 调用 AWS API 验证 token
    const response = await axios.get(
      'https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          isEmailRequired: true,
          origin: 'AI_EDITOR',
          resourceType: 'AGENTIC_REQUEST'
        },
        timeout: 10000
      }
    );
    
    return {
      valid: true,
      userInfo: response.data.userInfo || null
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  AWS_OAUTH_CONFIG,
  generatePKCE,
  generateAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  validateAccessToken
};
