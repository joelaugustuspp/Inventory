function ensureAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  return next();
}

function ensureRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({ message: 'You are not authorized to perform this action.' });
    }

    return next();
  };
}

module.exports = {
  ensureAuthenticated,
  ensureRole
};
