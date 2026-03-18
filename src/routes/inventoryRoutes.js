const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { ensureAuthenticated, ensureRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', ensureAuthenticated, inventoryController.getInventory);
router.post('/', ensureRole(['admin']), inventoryController.createInventoryItem);
router.put('/:id', ensureRole(['admin']), inventoryController.updateInventoryItem);
router.delete('/:id', ensureRole(['admin']), inventoryController.deleteInventoryItem);

module.exports = router;
