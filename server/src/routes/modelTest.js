const express = require('express');
const router = express.Router();
const modelTestController = require('../controllers/modelTestController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// 模型测试 - 聊天接口
router.post('/chat', modelTestController.testChat);

module.exports = router;
