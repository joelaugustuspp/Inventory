const inventoryModel = require('../models/inventoryModel');

function getInventory(req, res) {
  const data = inventoryModel.listItems({
    search: req.query.search,
    status: req.query.status,
    category: req.query.category,
    page: req.query.page,
    pageSize: req.query.pageSize
  });

  return res.json({
    ...data,
    summary: inventoryModel.getSummary(),
    categories: inventoryModel.getCategories().map((entry) => entry.category),
    auditLogs: inventoryModel.getRecentAuditLogs()
  });
}

function createInventoryItem(req, res) {
  const { errors, data } = inventoryModel.validateInventoryPayload(req.body);

  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed.', errors });
  }

  const item = inventoryModel.createItem(data, req.session.user);
  return res.status(201).json({ message: 'Inventory item created successfully.', item });
}

function updateInventoryItem(req, res) {
  const itemId = Number(req.params.id);
  const { errors, data } = inventoryModel.validateInventoryPayload(req.body);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ message: 'Item id must be a positive integer.' });
  }

  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed.', errors });
  }

  const item = inventoryModel.updateItem(itemId, data, req.session.user);

  if (!item) {
    return res.status(404).json({ message: 'Inventory item not found.' });
  }

  return res.json({ message: 'Inventory item updated successfully.', item });
}

function deleteInventoryItem(req, res) {
  const itemId = Number(req.params.id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ message: 'Item id must be a positive integer.' });
  }

  const item = inventoryModel.deleteItem(itemId, req.session.user);

  if (!item) {
    return res.status(404).json({ message: 'Inventory item not found.' });
  }

  return res.json({ message: 'Inventory item deleted successfully.', item });
}

module.exports = {
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
};
