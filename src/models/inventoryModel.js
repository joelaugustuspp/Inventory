const db = require('../config/database');
const { toIsoTimestamp } = require('../utils/date');

function buildFilters({ search, status, category }) {
  const conditions = [];
  const params = {};

  if (search) {
    conditions.push('(item_name LIKE @search OR category LIKE @search OR CAST(id AS TEXT) LIKE @search)');
    params.search = `%${search}%`;
  }

  if (status) {
    conditions.push('status = @status');
    params.status = status;
  }

  if (category) {
    conditions.push('category = @category');
    params.category = category;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

function listItems({ search, status, category, page = 1, pageSize = 10 }) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
  const offset = (safePage - 1) * safePageSize;
  const { whereClause, params } = buildFilters({ search, status, category });

  const items = db.prepare(`
    SELECT inventory_items.*, users.username AS updated_by_username
    FROM inventory_items
    LEFT JOIN users ON users.id = inventory_items.updated_by
    ${whereClause}
    ORDER BY inventory_items.last_updated DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: safePageSize, offset });

  const total = db.prepare(`SELECT COUNT(*) AS count FROM inventory_items ${whereClause}`).get(params).count;

  return {
    items,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(Math.ceil(total / safePageSize), 1)
    }
  };
}

function getItemById(id) {
  return db.prepare(`
    SELECT inventory_items.*, users.username AS updated_by_username
    FROM inventory_items
    LEFT JOIN users ON users.id = inventory_items.updated_by
    WHERE inventory_items.id = ?
  `).get(id);
}

function getCategories() {
  return db.prepare('SELECT DISTINCT category FROM inventory_items ORDER BY category ASC').all();
}

function getSummary() {
  return db.prepare(`
    SELECT
      COUNT(*) AS totalItems,
      SUM(CASE WHEN status = 'low stock' THEN 1 ELSE 0 END) AS lowStock,
      SUM(CASE WHEN status = 'out of stock' THEN 1 ELSE 0 END) AS outOfStock,
      SUM(quantity) AS totalUnits
    FROM inventory_items
  `).get();
}

function getRecentAuditLogs(limit = 8) {
  return db.prepare(`
    SELECT audit_logs.*, inventory_items.item_name
    FROM audit_logs
    LEFT JOIN inventory_items ON inventory_items.id = audit_logs.item_id
    ORDER BY audit_logs.created_at DESC
    LIMIT ?
  `).all(limit);
}

function validateInventoryPayload(payload) {
  const errors = [];
  const itemName = String(payload.itemName || '').trim();
  const category = String(payload.category || '').trim();
  const quantity = Number(payload.quantity);
  const price = Number(payload.price);
  const status = String(payload.status || '').trim();
  const allowedStatuses = ['in stock', 'low stock', 'out of stock'];

  if (!itemName || itemName.length < 2) {
    errors.push('Item name must be at least 2 characters long.');
  }

  if (!category || category.length < 2) {
    errors.push('Category must be at least 2 characters long.');
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    errors.push('Quantity must be a whole number greater than or equal to 0.');
  }

  if (!Number.isFinite(price) || price < 0) {
    errors.push('Price must be a valid amount greater than or equal to 0.');
  }

  if (!allowedStatuses.includes(status)) {
    errors.push('Status must be one of: in stock, low stock, out of stock.');
  }

  return {
    errors,
    data: {
      item_name: itemName,
      category,
      quantity,
      price: Number(price.toFixed(2)),
      status
    }
  };
}

function createItem(payload, actor) {
  const now = toIsoTimestamp();
  const insertItem = db.prepare(`
    INSERT INTO inventory_items (item_name, category, quantity, price, status, updated_by, last_updated)
    VALUES (@item_name, @category, @quantity, @price, @status, @updated_by, @last_updated)
  `);

  const insertLog = db.prepare(`
    INSERT INTO audit_logs (item_id, action, actor_user_id, actor_username, details, created_at)
    VALUES (@item_id, @action, @actor_user_id, @actor_username, @details, @created_at)
  `);

  const transaction = db.transaction(() => {
    const result = insertItem.run({ ...payload, updated_by: actor.id, last_updated: now });
    insertLog.run({
      item_id: result.lastInsertRowid,
      action: 'created',
      actor_user_id: actor.id,
      actor_username: actor.username,
      details: `Created ${payload.item_name}`,
      created_at: now
    });

    return getItemById(result.lastInsertRowid);
  });

  return transaction();
}

function updateItem(id, payload, actor) {
  const now = toIsoTimestamp();
  const existing = getItemById(id);

  if (!existing) {
    return null;
  }

  const updateStatement = db.prepare(`
    UPDATE inventory_items
    SET item_name = @item_name,
        category = @category,
        quantity = @quantity,
        price = @price,
        status = @status,
        updated_by = @updated_by,
        last_updated = @last_updated
    WHERE id = @id
  `);

  const insertLog = db.prepare(`
    INSERT INTO audit_logs (item_id, action, actor_user_id, actor_username, details, created_at)
    VALUES (@item_id, @action, @actor_user_id, @actor_username, @details, @created_at)
  `);

  const transaction = db.transaction(() => {
    updateStatement.run({ ...payload, id, updated_by: actor.id, last_updated: now });
    insertLog.run({
      item_id: id,
      action: 'updated',
      actor_user_id: actor.id,
      actor_username: actor.username,
      details: `Updated ${existing.item_name} to ${payload.item_name}`,
      created_at: now
    });

    return getItemById(id);
  });

  return transaction();
}

function deleteItem(id, actor) {
  const existing = getItemById(id);

  if (!existing) {
    return null;
  }

  const now = toIsoTimestamp();
  const insertLog = db.prepare(`
    INSERT INTO audit_logs (item_id, action, actor_user_id, actor_username, details, created_at)
    VALUES (@item_id, @action, @actor_user_id, @actor_username, @details, @created_at)
  `);

  const deleteStatement = db.prepare('DELETE FROM inventory_items WHERE id = ?');

  const transaction = db.transaction(() => {
    insertLog.run({
      item_id: id,
      action: 'deleted',
      actor_user_id: actor.id,
      actor_username: actor.username,
      details: `Deleted ${existing.item_name}`,
      created_at: now
    });
    deleteStatement.run(id);
  });

  transaction();
  return existing;
}

module.exports = {
  listItems,
  getItemById,
  getCategories,
  getSummary,
  getRecentAuditLogs,
  validateInventoryPayload,
  createItem,
  updateItem,
  deleteItem
};
