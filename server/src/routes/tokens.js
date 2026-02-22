const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/tokenController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', tokenController.getAllTokens);
router.get('/export', tokenController.exportTokens);
router.get('/check-all', tokenController.checkAllTokensValidity);
router.get('/:id', tokenController.getToken);
router.get('/:id/stats', tokenController.getTokenStats);
router.get('/:id/check', tokenController.checkTokenValidity);
router.post('/', tokenController.createToken);
router.put('/:id', tokenController.updateToken);
router.delete('/:id', tokenController.deleteToken);
router.patch('/:id/toggle', tokenController.toggleToken);

module.exports = router;
