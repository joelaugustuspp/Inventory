const express = require('express');
const adminController = require('../controllers/adminController');
const { ensureRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(ensureRole(['admin']));

router.get('/bootstrap', adminController.getAdminBootstrap);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.post('/item-masters', adminController.createItemMaster);
router.put('/item-masters/:id', adminController.updateItemMaster);
router.post('/category-masters', adminController.createCategoryMaster);
router.put('/category-masters/:id', adminController.updateCategoryMaster);

module.exports = router;
