# Inventory Management System

A simple full-stack Inventory Management System built with Node.js, Express, SQLite, and vanilla HTML/CSS/JavaScript. It includes session-based authentication, role-based access control, search/filtering, pagination, dashboard summary cards, and a basic audit log.

## Features

- Material Design inspired login and inventory dashboard
- Session-based login with bcrypt password hashing
- Two roles:
  - **Admin**: view, add, edit, delete inventory items
  - **Viewer**: view inventory only
- Backend route protection for unauthorized access attempts
- Inventory search, filtering, pagination, summary cards, and recent activity log
- Frontend and backend form validation with clear success/error messaging
- SQLite database initialization and seed data script
- Modular project structure for easy extension later

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML, CSS, JavaScript
- **Database:** SQLite via `better-sqlite3`
- **Authentication:** `express-session` + SQLite session store

## Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment example and update values if needed:

   ```bash
   cp .env.example .env
   ```

3. Initialize the database with seed data:

   ```bash
   npm run db:init
   ```

## Run Locally

Start the application:

```bash
npm start
```

The app runs by default at `http://localhost:3000`.

## Default Login Credentials

- **Admin**
  - Username: `admin`
  - Password: `admin123`
- **Viewer**
  - Username: `viewer`
  - Password: `viewer123`

## Available Scripts

- `npm start` - Start the Express server
- `npm run dev` - Start the server in watch mode (Node.js built-in watcher)
- `npm run db:init` - Create tables and seed demo data
- `npm run lint` - Run syntax checks on project JavaScript files

## Project Structure

```text
.
├── data/                 # SQLite database files
├── public/
│   ├── css/              # Material Design inspired styles
│   ├── js/               # Frontend login/dashboard logic
│   ├── index.html        # Login page
│   └── inventory.html    # Inventory dashboard
├── scripts/
│   └── initDb.js         # Database initialization helper
└── src/
    ├── config/           # Environment and database setup
    ├── controllers/      # Route handler logic
    ├── middleware/       # Authentication and authorization middleware
    ├── models/           # Database access + validation helpers
    ├── routes/           # Express API route definitions
    ├── utils/            # Utility helpers
    └── server.js         # Application entry point
```

## Notes

- The database layer is isolated in the model/config files so SQLite can be swapped later with a different persistence layer.
- Session cookies are configured for secure defaults and automatically switch to `secure` cookies in production.
- Viewer accounts do not see admin actions in the UI and are blocked from admin API endpoints on the server.
