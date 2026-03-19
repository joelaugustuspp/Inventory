const db = require('../config/database');
const { toIsoTimestamp } = require('../utils/date');

function sanitizeName(value) {
  return String(value || '').trim();
}

function validateMasterValue(name, label) {
  const trimmedName = sanitizeName(name);
  const errors = [];

  if (trimmedName.length < 2) {
    errors.push(`${label} name must be at least 2 characters long.`);
  }

  return {
    errors,
    name: trimmedName
  };
}

function listValues(tableName) {
  return db
    .prepare(`SELECT id, name, created_at, updated_at FROM ${tableName} ORDER BY name COLLATE NOCASE ASC`)
    .all();
}

function findValueById(tableName, id) {
  return db.prepare(`SELECT id, name, created_at, updated_at FROM ${tableName} WHERE id = ?`).get(id);
}

function findValueByName(tableName, name, excludedId = null) {
  return db
    .prepare(
      `SELECT id, name FROM ${tableName} WHERE LOWER(name) = LOWER(?) ${excludedId ? 'AND id != ?' : ''}`
    )
    .get(...(excludedId ? [name, excludedId] : [name]));
}

function createValue(tableName, name) {
  const now = toIsoTimestamp();
  const result = db
    .prepare(`INSERT INTO ${tableName} (name, created_at, updated_at) VALUES (?, ?, ?)`)
    .run(name, now, now);

  return findValueById(tableName, result.lastInsertRowid);
}

function updateValue(tableName, id, name) {
  const existing = findValueById(tableName, id);

  if (!existing) {
    return null;
  }

  const now = toIsoTimestamp();
  db.prepare(`UPDATE ${tableName} SET name = ?, updated_at = ? WHERE id = ?`).run(name, now, id);
  if (tableName === 'item_master') {
    db.prepare('UPDATE inventory_items SET item_name = ? WHERE item_master_id = ?').run(name, id);
  }

  if (tableName === 'category_master') {
    db.prepare('UPDATE inventory_items SET category = ? WHERE category_master_id = ?').run(name, id);
  }

  return findValueById(tableName, id);
}

function findItemById(id) {
  return findValueById('item_master', id);
}

function findCategoryById(id) {
  return findValueById('category_master', id);
}

function listItemMasters() {
  return listValues('item_master');
}

function listCategoryMasters() {
  return listValues('category_master');
}

module.exports = {
  sanitizeName,
  validateMasterValue,
  findValueByName,
  createValue,
  updateValue,
  findItemById,
  findCategoryById,
  listItemMasters,
  listCategoryMasters
};
