const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/dashboard', statsController.getDashboardOverview);
router.get('/usage', statsController.getUsageStats);
router.get('/tokens', statsController.getTokenUsageStats);
router.get('/models', statsController.getModelStats);
router.get('/kiro-status', statsController.getKiroStatus);
router.post('/log', statsController.logUsage);
router.delete('/clear', statsController.clearUsageLogs);

module.exports = router;
