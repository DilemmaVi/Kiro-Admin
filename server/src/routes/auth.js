const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const oauthController = require('../controllers/oauthController');
const authMiddleware = require('../middleware/auth');

// 传统登录
router.get('/captcha', authController.getCaptcha);
router.post('/login', authController.login);
router.post('/change-password', authMiddleware, authController.changePassword);

// AWS SSO 设备授权登录
router.post('/device-auth/initiate', oauthController.initiateDeviceAuth);
router.post('/device-auth/poll', oauthController.pollAuthStatus);
router.get('/oauth/status', authMiddleware, oauthController.getOAuthStatus);

// Token 管理页面的 OAuth 授权（需要登录）
router.post('/token-auth/initiate', authMiddleware, oauthController.initiateTokenAuth);
router.post('/token-auth/poll', authMiddleware, oauthController.pollTokenAuthStatus);

module.exports = router;
