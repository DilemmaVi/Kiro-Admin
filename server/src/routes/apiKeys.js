const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', apiKeyController.getAllApiKeys);
router.post('/', apiKeyController.createApiKey);
router.put('/:id', apiKeyController.updateApiKey);
router.delete('/:id', apiKeyController.deleteApiKey);
router.patch('/:id/toggle', apiKeyController.toggleApiKey);

module.exports = router;
