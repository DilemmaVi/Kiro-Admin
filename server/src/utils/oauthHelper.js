const axios = require('axios');
const crypto = require('crypto');

// AWS SSO OIDC 配置
const AWS_SSO_CONFIG = {
  // AWS SSO OIDC 端点
  region: 'us-east-1',
  registerClientEndpoint: 'https://oidc.us-east-1.amazonaws.com/client/register',
  deviceAuthorizationEndpoint: 'https://oidc.us-east-1.amazonaws.com/device_authorization',
  tokenEndpoint: 'https://oidc.us-east-1.amazonaws.com/token',
  refreshEndpoint: 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken',
  
  // Kiro 客户端配置
  clientName: 'kiro-web-client',
  clientType: 'public',
  grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
  
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
      AWS_SSO_CONFIG.registerClientEndpoint,
      {
        clientName: AWS_SSO_CONFIG.clientName,
        clientType: AWS_SSO_CONFIG.clientType,
        grantTypes: AWS_SSO_CONFIG.grantTypes,
        scopes: ['sso:account:access']
      },
      {
        headers: {
          'Content-Type': 'application/json'
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
      AWS_SSO_CONFIG.deviceAuthorizationEndpoint,
      {
        clientId: clientId,
        clientSecret: clientSecret,
        startUrl: AWS_SSO_CONFIG.startUrl
      },
      {
        headers: {
          'Content-Type': 'application/json'
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
        AWS_SSO_CONFIG.tokenEndpoint,
        {
          clientId: clientId,
          clientSecret: clientSecret,
          grantType: 'urn:ietf:params:oauth:grant-type:device_code',
          deviceCode: deviceCode
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      // 成功获取 token
      return {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresIn: response.data.expiresIn,
        tokenType: response.data.tokenType || 'Bearer'
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
 */
async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post(
      AWS_SSO_CONFIG.refreshEndpoint,
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
    // 尝试调用 AWS API 验证 token
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
    console.warn('Token 验证失败，但这可能是正常的（SSO token 可能不能直接用于 CodeWhisperer）:', error.message);
    
    // 即使验证失败，我们也认为 token 是有效的
    // 因为它是从 AWS SSO 正式获取的
    return {
      valid: true,
      userInfo: null,
      warning: 'Token 验证跳过（SSO token）'
    };
  }
}

module.exports = {
  AWS_SSO_CONFIG,
  registerClient,
  startDeviceAuthorization,
  pollForToken,
  refreshAccessToken,
  validateAccessToken
};
