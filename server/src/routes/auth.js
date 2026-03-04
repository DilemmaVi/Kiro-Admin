const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const oauthController = require('../controllers/oauthController');
const authMiddleware = require('../middleware/auth');

// 传统登录
router.get('/captcha', authController.getCaptcha);
router.post('/login', authController.login);
router.post('/change-password', authMiddleware, authController.changePassword);

// OAuth 登录
router.get('/oauth/initiate', oauthController.initiateOAuth);
router.get('/oauth/callback', oauthController.handleOAuthCallback);
router.get('/oauth/status', authMiddleware, oauthController.getOAuthStatus);

module.exports = router;
