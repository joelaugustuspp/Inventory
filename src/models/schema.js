const db = require('../config/database');
const { hashPassword } = require('../utils/password');
const { toIsoTimestamp } = require('../utils/date');

function columnExists(tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      item_master_id INTEGER,
      category_master_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
      status TEXT NOT NULL CHECK(status IN ('in stock', 'low stock', 'out of stock')),
      updated_by INTEGER,
      last_updated TEXT NOT NULL,
      FOREIGN KEY(item_master_id) REFERENCES item_master(id),
      FOREIGN KEY(category_master_id) REFERENCES category_master(id),
      FOREIGN KEY(updated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('created', 'updated', 'deleted')),
      actor_user_id INTEGER,
      actor_username TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(actor_user_id) REFERENCES users(id)
    );

  `);
}

function migrateTables() {
  if (!columnExists('users', 'status')) {
    db.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  }

  if (!columnExists('inventory_items', 'item_master_id')) {
    db.exec(`ALTER TABLE inventory_items ADD COLUMN item_master_id INTEGER`);
  }

  if (!columnExists('inventory_items', 'category_master_id')) {
    db.exec(`ALTER TABLE inventory_items ADD COLUMN category_master_id INTEGER`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_inventory_item_master_id ON inventory_items(item_master_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_category_master_id ON inventory_items(category_master_id);
  `);
}

function upsertMasterValue(tableName, value, now) {
  const trimmedValue = String(value || '').trim();

  if (!trimmedValue) {
    return null;
  }

  const existing = db
    .prepare(`SELECT id, name FROM ${tableName} WHERE LOWER(name) = LOWER(?)`)
    .get(trimmedValue);

  if (existing) {
    return existing;
  }

  const result = db
    .prepare(`INSERT INTO ${tableName} (name, created_at, updated_at) VALUES (?, ?, ?)`)
    .run(trimmedValue, now, now);

  return db.prepare(`SELECT id, name FROM ${tableName} WHERE id = ?`).get(result.lastInsertRowid);
}

async function seedUsers() {
  const now = toIsoTimestamp();
  const users = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'viewer', password: 'viewer123', role: 'viewer' }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, role, status, created_at, updated_at)
    VALUES (@username, @password_hash, @role, 'active', @created_at, @updated_at)
  `);

  for (const user of users) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);

    if (existing) {
      db.prepare(`UPDATE users SET status = COALESCE(status, 'active') WHERE id = ?`).run(existing.id);
      continue;
    }

    insertUser.run({
      username: user.username,
      password_hash: await hashPassword(user.password),
      role: user.role,
      created_at: now,
      updated_at: now
    });
  }
}

function seedInventory() {
  const itemCount = db.prepare('SELECT COUNT(*) AS count FROM inventory_items').get().count;

  if (itemCount > 0) {
    return;
  }

  const adminUser = db.prepare(`SELECT id, username FROM users WHERE username = 'admin'`).get();
  const now = toIsoTimestamp();

  const items = [
    ['Laptop Pro 14', 'Electronics', 12, 1499.99, 'in stock'],
    ['Wireless Mouse', 'Accessories', 4, 24.5, 'low stock'],
    ['Standing Desk', 'Furniture', 0, 399.0, 'out of stock'],
    ['Notebook Pack', 'Office', 54, 12.99, 'in stock'],
    ['Label Printer', 'Office', 2, 89.99, 'low stock'],
    ['USB-C Dock', 'Electronics', 8, 74.99, 'in stock']
  ];

  const insertItem = db.prepare(`
    INSERT INTO inventory_items (
      item_name, category, quantity, price, status, updated_by, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO audit_logs (item_id, action, actor_user_id, actor_username, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const [itemName, category, quantity, price, status] of items) {
      const result = insertItem.run(itemName, category, quantity, price, status, adminUser.id, now);
      insertLog.run(
        result.lastInsertRowid,
        'created',
        adminUser.id,
        adminUser.username,
        `Seeded item ${itemName}`,
        now
      );
    }
  });

  transaction();
}

function seedMasterData() {
  const now = toIsoTimestamp();
  const inventoryValues = db
    .prepare('SELECT item_name, category FROM inventory_items ORDER BY id ASC')
    .all();

  const transaction = db.transaction(() => {
    for (const entry of inventoryValues) {
      upsertMasterValue('item_master', entry.item_name, now);
      upsertMasterValue('category_master', entry.category, now);
    }

    const itemMasters = db.prepare('SELECT id, name FROM item_master').all();
    const categoryMasters = db.prepare('SELECT id, name FROM category_master').all();
    const itemLookup = new Map(itemMasters.map((entry) => [entry.name.toLowerCase(), entry.id]));
    const categoryLookup = new Map(categoryMasters.map((entry) => [entry.name.toLowerCase(), entry.id]));

    const inventoryRows = db.prepare('SELECT id, item_name, category FROM inventory_items').all();
    const updateInventory = db.prepare(`
      UPDATE inventory_items
      SET item_master_id = @item_master_id,
          category_master_id = @category_master_id
      WHERE id = @id
    `);

    for (const row of inventoryRows) {
      updateInventory.run({
        id: row.id,
        item_master_id: itemLookup.get(String(row.item_name).toLowerCase()) || null,
        category_master_id: categoryLookup.get(String(row.category).toLowerCase()) || null
      });
    }
  });

  transaction();
}

async function initializeDatabase() {
  createTables();
  migrateTables();
  await seedUsers();
  seedInventory();
  seedMasterData();
}

module.exports = {
  initializeDatabase
};
