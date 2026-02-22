const axios = require('axios');
const crypto = require('crypto');

// AWS CodeWhisperer API URLs
const SOCIAL_REFRESH_URL = 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken';
const IDC_REFRESH_URL = 'https://oidc.us-east-1.amazonaws.com/token';
const USAGE_LIMITS_URL = 'https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits';

// 生成请求ID
const generateInvocationID = () => {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
};

// 刷新 Social Token
const refreshSocialToken = async (refreshToken) => {
  try {
    const response = await axios.post(
      SOCIAL_REFRESH_URL,
      { refreshToken },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data && response.data.accessToken) {
      return {
        accessToken: response.data.accessToken,
        expiresIn: response.data.expiresIn || 3600
      };
    }

    throw new Error('无法获取访问令牌');
  } catch (error) {
    throw new Error(`Social Token刷新失败: ${error.message}`);
  }
};

// 刷新 IdC Token
const refreshIdCToken = async (refreshToken, clientId, clientSecret) => {
  try {
    // 使用 JSON 格式，而不是 form-urlencoded
    const requestData = {
      clientId: clientId,
      clientSecret: clientSecret,
      grantType: 'refresh_token',
      refreshToken: refreshToken
    };

    const headers = {
      'Content-Type': 'application/json',
      'Host': 'oidc.us-east-1.amazonaws.com',
      'Connection': 'keep-alive',
      'x-amz-user-agent': 'aws-sdk-js/3.738.0 ua/2.1 os/other lang/js md/browser#unknown_unknown api/sso-oidc#3.738.0 m/E KiroAdmin',
      'Accept': '*/*',
      'Accept-Language': '*',
      'sec-fetch-mode': 'cors',
      'User-Agent': 'node',
      'Accept-Encoding': 'br, gzip, deflate'
    };

    const response = await axios.post(IDC_REFRESH_URL, requestData, {
      headers,
      timeout: 10000
    });

    if (response.data && (response.data.accessToken || response.data.access_token)) {
      return {
        accessToken: response.data.accessToken || response.data.access_token,
        expiresIn: response.data.expiresIn || response.data.expires_in || 3600
      };
    }

    throw new Error('无法获取访问令牌');
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
    throw new Error(`IdC Token刷新失败: ${errorMsg}`);
  }
};

// 检查使用限制
const checkUsageLimits = async (accessToken) => {
  try {
    const url = `${USAGE_LIMITS_URL}?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-user-agent': 'aws-sdk-js/1.0.0 KiroAdmin-1.0.0',
        'user-agent': 'aws-sdk-js/1.0.0 ua/2.1 os/darwin lang/js md/nodejs KiroAdmin-1.0.0',
        'host': 'codewhisperer.us-east-1.amazonaws.com',
        'amz-sdk-invocation-id': generateInvocationID(),
        'amz-sdk-request': 'attempt=1; max=1',
        'Connection': 'close'
      },
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    throw new Error(`用量检查失败: ${error.message}`);
  }
};

// 计算可用次数
const calculateAvailableCount = (usageLimits) => {
  if (!usageLimits || !usageLimits.usageBreakdownList) {
    return 0;
  }

  for (const breakdown of usageLimits.usageBreakdownList) {
    if (breakdown.resourceType === 'CREDIT') {
      let totalLimit = 0;
      let totalUsed = 0;

      // 基础额度
      totalLimit += breakdown.usageLimitWithPrecision || 0;
      totalUsed += breakdown.currentUsageWithPrecision || 0;

      // 免费试用额度
      if (breakdown.freeTrialInfo && breakdown.freeTrialInfo.freeTrialStatus === 'ACTIVE') {
        totalLimit += breakdown.freeTrialInfo.usageLimitWithPrecision || 0;
        totalUsed += breakdown.freeTrialInfo.currentUsageWithPrecision || 0;
      }

      const available = totalLimit - totalUsed;
      return available > 0 ? available : 0;
    }
  }

  return 0;
};

// 获取用量详情
const getUsageDetails = (usageLimits) => {
  if (!usageLimits || !usageLimits.usageBreakdownList) {
    return null;
  }

  for (const breakdown of usageLimits.usageBreakdownList) {
    if (breakdown.resourceType === 'CREDIT') {
      const baseLimit = breakdown.usageLimitWithPrecision || 0;
      const baseUsed = breakdown.currentUsageWithPrecision || 0;

      let freeTrialLimit = 0;
      let freeTrialUsed = 0;
      let freeTrialStatus = 'NONE';

      if (breakdown.freeTrialInfo) {
        freeTrialLimit = breakdown.freeTrialInfo.usageLimitWithPrecision || 0;
        freeTrialUsed = breakdown.freeTrialInfo.currentUsageWithPrecision || 0;
        freeTrialStatus = breakdown.freeTrialInfo.freeTrialStatus || 'NONE';
      }

      const totalLimit = baseLimit + freeTrialLimit;
      const totalUsed = baseUsed + freeTrialUsed;
      const available = totalLimit - totalUsed;

      return {
        totalLimit,
        totalUsed,
        available: available > 0 ? available : 0,
        baseLimit,
        baseUsed,
        freeTrialLimit,
        freeTrialUsed,
        freeTrialStatus,
        userEmail: usageLimits.userInfo?.email || null
      };
    }
  }

  return null;
};

module.exports = {
  refreshSocialToken,
  refreshIdCToken,
  checkUsageLimits,
  calculateAvailableCount,
  getUsageDetails
};
