const express = require('express');
const router = express.Router();
const proxyController = require('../controllers/proxyController');
const apiKeyAuth = require('../middleware/apiKeyAuth');

// 使用 API 密钥认证
router.use(apiKeyAuth);

// Anthropic Messages API 代理
router.post('/messages', proxyController.proxyMessages);

// OpenAI Chat Completions API 代理
router.post('/chat/completions', proxyController.proxyChatCompletions);

module.exports = router;
