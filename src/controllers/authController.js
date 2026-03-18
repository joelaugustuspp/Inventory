const { comparePassword } = require('../utils/password');
const userModel = require('../models/userModel');

async function login(req, res) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = userModel.findByUsername(username);

  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  const passwordMatches = await comparePassword(password, user.password_hash);

  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  return res.json({
    message: 'Login successful.',
    user: req.session.user
  });
}

function logout(req, res) {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: 'Unable to log out. Please try again.' });
    }

    res.clearCookie('inventory.sid');
    return res.json({ message: 'Logged out successfully.' });
  });
}

function me(req, res) {
  return res.json({ user: req.session.user || null });
}

module.exports = {
  login,
  logout,
  me
};
