const db = require('../config/database');

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findById(id) {
  return db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
}

module.exports = {
  findByUsername,
  findById
};
