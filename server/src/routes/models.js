const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// 从 kiro2api 获取模型列表
router.get('/', modelController.getModelsFromKiro);
router.get('/:modelId', modelController.getModelDetail);

module.exports = router;
