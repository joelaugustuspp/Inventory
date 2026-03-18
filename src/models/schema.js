const db = require('../config/database');
const { hashPassword } = require('../utils/password');
const { toIsoTimestamp } = require('../utils/date');

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
      status TEXT NOT NULL CHECK(status IN ('in stock', 'low stock', 'out of stock')),
      updated_by INTEGER,
      last_updated TEXT NOT NULL,
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

async function seedUsers() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;

  if (userCount > 0) {
    return;
  }

  const now = toIsoTimestamp();
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, role, created_at, updated_at)
    VALUES (@username, @password_hash, @role, @created_at, @updated_at)
  `);

  const users = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'viewer', password: 'viewer123', role: 'viewer' }
  ];

  for (const user of users) {
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

async function initializeDatabase() {
  createTables();
  await seedUsers();
  seedInventory();
}

module.exports = {
  initializeDatabase
};
