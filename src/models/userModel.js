const db = require('../config/database');

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
}

function findById(id) {
  const row = db.prepare('SELECT id, username, role, status, created_at, updated_at FROM users WHERE id = ?').get(id);
  return mapUser(row);
}

function listUsers() {
  return db
    .prepare(`
      SELECT id, username, role, status, created_at, updated_at
      FROM users
      ORDER BY username COLLATE NOCASE ASC
    `)
    .all()
    .map(mapUser);
}

function findByUsernameExcludingId(username, excludedId) {
  return db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?').get(username, excludedId);
}

function createUser({ username, passwordHash, role, status, createdAt, updatedAt }) {
  const result = db
    .prepare(`
      INSERT INTO users (username, password_hash, role, status, created_at, updated_at)
      VALUES (@username, @password_hash, @role, @status, @created_at, @updated_at)
    `)
    .run({
      username,
      password_hash: passwordHash,
      role,
      status,
      created_at: createdAt,
      updated_at: updatedAt
    });

  return findById(result.lastInsertRowid);
}

function updateUser(id, { username, passwordHash, role, status, updatedAt }) {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  if (!existing) {
    return null;
  }

  db.prepare(`
    UPDATE users
    SET username = @username,
        password_hash = @password_hash,
        role = @role,
        status = @status,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    username,
    password_hash: passwordHash || existing.password_hash,
    role,
    status,
    updated_at: updatedAt
  });

  return findById(id);
}

module.exports = {
  findByUsername,
  findById,
  listUsers,
  findByUsernameExcludingId,
  createUser,
  updateUser
};
