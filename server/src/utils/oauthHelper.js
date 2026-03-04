const axios = require('axios');
const crypto = require('crypto');

// Kiro OAuth 配置
const KIRO_OAUTH_CONFIG = {
  // Kiro OAuth 端点
  region: 'us-east-1',
  registerClientEndpoint: 'https://oidc.us-east-1.amazonaws.com/client/register',
  deviceAuthorizationEndpoint: 'https://oidc.us-east-1.amazonaws.com/device_authorization',
  tokenEndpoint: 'https://oidc.us-east-1.amazonaws.com/token',
  refreshEndpoint: 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken',
  
  // Kiro 客户端配置
  clientName: 'kiro-desktop-client',
  clientType: 'public',
  grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
  scopes: ['codewhisperer:completions', 'codewhisperer:analysis', 'codewhisperer:conversations'],
  
  // AWS Builder ID 起始 URL
  startUrl: 'https://view.awsapps.com/start'
};

/**
 * 注册 OIDC 客户端
 * 这一步是必需的，用于获取 client_id 和 client_secret
 */
async function registerClient() {
  try {
    const response = await axios.post(
      KIRO_OAUTH_CONFIG.registerClientEndpoint,
      {
        clientName: KIRO_OAUTH_CONFIG.clientName,
        clientType: KIRO_OAUTH_CONFIG.clientType,
        grantTypes: KIRO_OAUTH_CONFIG.grantTypes,
        scopes: KIRO_OAUTH_CONFIG.scopes
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KiroIDE'
        },
        timeout: 10000
      }
    );
    
    return {
      clientId: response.data.clientId,
      clientSecret: response.data.clientSecret,
      clientIdIssuedAt: response.data.clientIdIssuedAt,
      clientSecretExpiresAt: response.data.clientSecretExpiresAt
    };
  } catch (error) {
    console.error('Client registration error:', error.response?.data || error.message);
    throw new Error(`客户端注册失败: ${error.response?.data?.error_description || error.message}`);
  }
}

/**
 * 启动设备授权流程
 * 返回用户需要访问的 URL 和验证码
 */
async function startDeviceAuthorization(clientId, clientSecret) {
  try {
    const response = await axios.post(
      KIRO_OAUTH_CONFIG.deviceAuthorizationEndpoint,
      {
        clientId: clientId,
        clientSecret: clientSecret,
        startUrl: KIRO_OAUTH_CONFIG.startUrl,
        scopes: KIRO_OAUTH_CONFIG.scopes
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KiroIDE'
        },
        timeout: 10000
      }
    );
    
    return {
      deviceCode: response.data.deviceCode,
      userCode: response.data.userCode,
      verificationUri: response.data.verificationUri,
      verificationUriComplete: response.data.verificationUriComplete,
      expiresIn: response.data.expiresIn,
      interval: response.data.interval || 5
    };
  } catch (error) {
    console.error('Device authorization error:', error.response?.data || error.message);
    throw new Error(`设备授权失败: ${error.response?.data?.error_description || error.message}`);
  }
}

/**
 * 轮询获取 token
 * 在用户完成授权后，使用 device_code 获取 token
 */
async function pollForToken(clientId, clientSecret, deviceCode, interval = 5, maxAttempts = 60) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      const response = await axios.post(
        KIRO_OAUTH_CONFIG.tokenEndpoint,
        {
          clientId: clientId,
          clientSecret: clientSecret,
          grantType: 'urn:ietf:params:oauth:grant-type:device_code',
          deviceCode: deviceCode
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'KiroIDE'
          },
          timeout: 10000
        }
      );
      
      // 打印原始响应以便调试
      console.log('🎉 Token API 响应:', JSON.stringify(response.data, null, 2));
      
      // 成功获取 token
      // AWS OIDC API 可能返回 camelCase 或 snake_case
      const accessToken = response.data.accessToken || response.data.access_token;
      const refreshToken = response.data.refreshToken || response.data.refresh_token;
      const expiresIn = response.data.expiresIn || response.data.expires_in;
      const tokenType = response.data.tokenType || response.data.token_type || 'Bearer';
      
      console.log('📦 解析后的 token:');
      console.log('  - accessToken:', accessToken ? `${accessToken.substring(0, 30)}...` : 'null');
      console.log('  - refreshToken:', refreshToken ? `${refreshToken.substring(0, 30)}...` : 'null');
      console.log('  - expiresIn:', expiresIn);
      console.log('  - tokenType:', tokenType);
      
      if (!accessToken || !refreshToken) {
        console.error('❌ Token 字段缺失！完整响应:', response.data);
        throw new Error('Token 响应格式错误：缺少 accessToken 或 refreshToken');
      }
      
      return {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType
      };
    } catch (error) {
      const errorCode = error.response?.data?.error;
      
      if (errorCode === 'authorization_pending') {
        // 用户还未完成授权，继续等待
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        continue;
      } else if (errorCode === 'slow_down') {
        // 请求太频繁，增加等待时间
        interval = interval + 5;
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        continue;
      } else if (errorCode === 'expired_token') {
        // 设备码已过期
        throw new Error('设备授权码已过期，请重新开始');
      } else if (errorCode === 'access_denied') {
        // 用户拒绝授权
        throw new Error('用户拒绝授权');
      } else {
        // 其他错误
        throw new Error(`Token 获取失败: ${error.response?.data?.error_description || error.message}`);
      }
    }
  }
  
  throw new Error('授权超时，请重新尝试');
}

/**
 * 使用 refresh token 获取新的 access token
 * 注意：Kiro 使用的是 Social Token 刷新端点，不需要 clientId/clientSecret
 */
async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post(
      KIRO_OAUTH_CONFIG.refreshEndpoint,
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
 * 通过调用 CodeWhisperer API 检查用量限制
 */
async function validateAccessToken(accessToken) {
  try {
    // 调用 CodeWhisperer API 验证 token
    const response = await axios.get(
      'https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-amz-user-agent': 'aws-sdk-js/1.0.0 KiroAdmin-1.0.0',
          'user-agent': 'aws-sdk-js/1.0.0 ua/2.1 os/darwin lang/js md/nodejs KiroAdmin-1.0.0'
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
      userInfo: response.data.userInfo || null,
      usageLimits: response.data
    };
  } catch (error) {
    console.warn('Token 验证失败:', error.message);
    
    // 如果是 403 错误，说明 token 格式正确但可能没有权限
    if (error.response?.status === 403) {
      return {
        valid: true,
        userInfo: null,
        warning: 'Token 有效但可能没有 CodeWhisperer 权限'
      };
    }
    
    // 其他错误认为 token 无效
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  KIRO_OAUTH_CONFIG,
  registerClient,
  startDeviceAuthorization,
  pollForToken,
  refreshAccessToken,
  validateAccessToken
};
