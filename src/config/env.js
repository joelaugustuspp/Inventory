const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || 'development-session-secret',
  dbPath: process.env.DB_PATH
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.resolve(process.cwd(), 'data', 'inventory.sqlite'),
  nodeEnv: process.env.NODE_ENV || 'development'
};
