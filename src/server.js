const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const { initializeDatabase } = require('./models/schema');
const { ensureAuthenticated, ensureRole } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const adminRoutes = require('./routes/adminRoutes');
const env = require('./config/env');

const SQLiteStore = SQLiteStoreFactory(session);
const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.sqlite',
      dir: path.dirname(env.dbPath)
    }),
    name: 'inventory.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get(['/app', '/inventory.html'], ensureAuthenticated, (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'inventory.html'));
});

app.get(['/admin', '/admin.html'], ensureRole(['admin']), (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

app.use(express.static(path.join(process.cwd(), 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

async function startServer() {
  await initializeDatabase();

  app.listen(env.port, () => {
    console.log(`Inventory Management System running on http://localhost:${env.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
