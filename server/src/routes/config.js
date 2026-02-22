const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', configController.getAllConfigs);
router.post('/', configController.updateConfig);
router.post('/batch', configController.batchUpdateConfigs);
router.get('/export', configController.exportEnv);

module.exports = router;
