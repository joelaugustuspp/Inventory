const { hashPassword } = require('../utils/password');
const userModel = require('../models/userModel');
const masterDataModel = require('../models/masterDataModel');
const { toIsoTimestamp } = require('../utils/date');

function validateUserPayload(payload, { isEdit = false } = {}) {
  const errors = [];
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');
  const role = String(payload.role || '').trim();
  const status = String(payload.status || '').trim();

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long.');
  }

  if (!isEdit && password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  if (isEdit && password && password.length < 6) {
    errors.push('Password must be at least 6 characters long when updating it.');
  }

  if (!['admin', 'viewer'].includes(role)) {
    errors.push('Role must be admin or viewer.');
  }

  if (!['active', 'inactive'].includes(status)) {
    errors.push('Status must be active or inactive.');
  }

  return {
    errors,
    data: {
      username,
      password,
      role,
      status
    }
  };
}

function getAdminBootstrap(_req, res) {
  return res.json({
    users: userModel.listUsers(),
    masterData: {
      items: masterDataModel.listItemMasters(),
      categories: masterDataModel.listCategoryMasters()
    }
  });
}

async function createUser(req, res) {
  const { errors, data } = validateUserPayload(req.body);

  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed.', errors });
  }

  if (userModel.findByUsername(data.username)) {
    return res.status(400).json({ message: 'Username already exists.' });
  }

  const now = toIsoTimestamp();
  const user = userModel.createUser({
    username: data.username,
    passwordHash: await hashPassword(data.password),
    role: data.role,
    status: data.status,
    createdAt: now,
    updatedAt: now
  });

  return res.status(201).json({
    message: 'User created successfully.',
    user
  });
}

async function updateUser(req, res) {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'User id must be a positive integer.' });
  }

  const existingUser = userModel.findById(userId);

  if (!existingUser) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const { errors, data } = validateUserPayload(req.body, { isEdit: true });

  if (errors.length) {
    return res.status(400).json({ message: 'Validation failed.', errors });
  }

  if (userModel.findByUsernameExcludingId(data.username, userId)) {
    return res.status(400).json({ message: 'Username already exists.' });
  }

  if (req.session.user.id === userId) {
    if (data.role !== 'admin') {
      return res.status(400).json({ message: 'You cannot remove your own admin role.' });
    }

    if (data.status !== 'active') {
      return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    }
  }

  const user = userModel.updateUser(userId, {
    username: data.username,
    passwordHash: data.password ? await hashPassword(data.password) : null,
    role: data.role,
    status: data.status,
    updatedAt: toIsoTimestamp()
  });

  if (req.session.user.id === userId) {
    req.session.user.username = user.username;
    req.session.user.role = user.role;
    req.session.user.status = user.status;
  }

  return res.json({
    message: 'User updated successfully.',
    user
  });
}

function createMasterValue(tableName, label) {
  return (req, res) => {
    const { errors, name } = masterDataModel.validateMasterValue(req.body.name, label);

    if (errors.length) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    if (masterDataModel.findValueByName(tableName, name)) {
      return res.status(400).json({ message: `${label} already exists.` });
    }

    const entry = masterDataModel.createValue(tableName, name);
    return res.status(201).json({
      message: `${label} created successfully.`,
      entry
    });
  };
}

function updateMasterValue(tableName, label) {
  return (req, res) => {
    const entryId = Number(req.params.id);

    if (!Number.isInteger(entryId) || entryId <= 0) {
      return res.status(400).json({ message: `${label} id must be a positive integer.` });
    }

    const { errors, name } = masterDataModel.validateMasterValue(req.body.name, label);

    if (errors.length) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    if (masterDataModel.findValueByName(tableName, name, entryId)) {
      return res.status(400).json({ message: `${label} already exists.` });
    }

    const entry = masterDataModel.updateValue(tableName, entryId, name);

    if (!entry) {
      return res.status(404).json({ message: `${label} not found.` });
    }

    return res.json({
      message: `${label} updated successfully.`,
      entry
    });
  };
}

module.exports = {
  getAdminBootstrap,
  createUser,
  updateUser,
  createItemMaster: createMasterValue('item_master', 'Item'),
  updateItemMaster: updateMasterValue('item_master', 'Item'),
  createCategoryMaster: createMasterValue('category_master', 'Category'),
  updateCategoryMaster: updateMasterValue('category_master', 'Category')
};
