const state = {
  user: null,
  users: [],
  masterData: {
    items: [],
    categories: []
  }
};

const currentUser = document.getElementById('current-user');
const currentRole = document.getElementById('current-role');
const logoutBtn = document.getElementById('logout-btn');
const adminMessage = document.getElementById('admin-message');
const userMessage = document.getElementById('user-message');
const itemMasterMessage = document.getElementById('item-master-message');
const categoryMasterMessage = document.getElementById('category-master-message');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const usersTableBody = document.getElementById('users-table-body');
const userForm = document.getElementById('user-form');
const userFormTitle = document.getElementById('user-form-title');
const userResetBtn = document.getElementById('user-reset-btn');
const itemMasterForm = document.getElementById('item-master-form');
const itemMasterFormTitle = document.getElementById('item-master-form-title');
const itemMasterResetBtn = document.getElementById('item-master-reset-btn');
const itemMasterTableBody = document.getElementById('item-master-table-body');
const categoryMasterForm = document.getElementById('category-master-form');
const categoryMasterFormTitle = document.getElementById('category-master-form-title');
const categoryMasterResetBtn = document.getElementById('category-master-reset-btn');
const categoryMasterTableBody = document.getElementById('category-master-table-body');

function showBanner(target, message, type = 'error') {
  target.textContent = message;
  target.className = `alert ${type}`;
}

function clearBanner(target) {
  target.textContent = '';
  target.className = 'alert hidden';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.href = '/';
    throw new Error('Authentication required');
  }

  if (response.status === 403) {
    window.location.href = '/app';
    throw new Error(payload.message || 'You are not authorized to access this page.');
  }

  if (!response.ok) {
    throw new Error(payload.errors?.join(' ') || payload.message || 'Request failed.');
  }

  return payload;
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle('tab-btn-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `tab-${tabName}`);
  });
}

function renderUsers() {
  if (!state.users.length) {
    usersTableBody.innerHTML = '<tr><td colspan="4" class="subtitle">No users found.</td></tr>';
    return;
  }

  usersTableBody.innerHTML = state.users
    .map((user) => {
      const selfLabel = state.user && user.id === state.user.id ? ' <span class="badge">You</span>' : '';

      return `
        <tr>
          <td>${escapeHtml(user.username)}${selfLabel}</td>
          <td><span class="badge">${escapeHtml(user.role)}</span></td>
          <td><span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-muted'}">${escapeHtml(user.status)}</span></td>
          <td>
            <button
              class="btn btn-secondary"
              data-user-action="edit"
              data-id="${user.id}"
              data-username="${escapeHtml(user.username)}"
              data-role="${escapeHtml(user.role)}"
              data-status="${escapeHtml(user.status)}"
            >
              Edit
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderMasterTable(target, entries, emptyMessage, type) {
  if (!entries.length) {
    target.innerHTML = `<tr><td colspan="2" class="subtitle">${emptyMessage}</td></tr>`;
    return;
  }

  target.innerHTML = entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.name)}</td>
          <td>
            <button
              class="btn btn-secondary"
              data-master-action="edit"
              data-type="${type}"
              data-id="${entry.id}"
              data-name="${escapeHtml(entry.name)}"
            >
              Edit
            </button>
          </td>
        </tr>
      `
    )
    .join('');
}

function renderMasterData() {
  renderMasterTable(itemMasterTableBody, state.masterData.items, 'No item master values yet.', 'item');
  renderMasterTable(categoryMasterTableBody, state.masterData.categories, 'No category master values yet.', 'category');
}

function resetUserForm() {
  userForm.reset();
  document.getElementById('user-id').value = '';
  document.getElementById('user-role').value = 'admin';
  document.getElementById('user-status').value = 'active';
  userFormTitle.textContent = 'Add user';
  clearBanner(userMessage);
}

function resetItemMasterForm() {
  itemMasterForm.reset();
  document.getElementById('item-master-id').value = '';
  itemMasterFormTitle.textContent = 'Add item';
  clearBanner(itemMasterMessage);
}

function resetCategoryMasterForm() {
  categoryMasterForm.reset();
  document.getElementById('category-master-id').value = '';
  categoryMasterFormTitle.textContent = 'Add category';
  clearBanner(categoryMasterMessage);
}

function populateUserForm(button) {
  document.getElementById('user-id').value = button.dataset.id;
  document.getElementById('user-username').value = button.dataset.username;
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value = button.dataset.role;
  document.getElementById('user-status').value = button.dataset.status;
  userFormTitle.textContent = 'Edit user';
  clearBanner(userMessage);
}

function populateMasterForm(type, button) {
  if (type === 'item') {
    document.getElementById('item-master-id').value = button.dataset.id;
    document.getElementById('item-master-name').value = button.dataset.name;
    itemMasterFormTitle.textContent = 'Edit item';
    clearBanner(itemMasterMessage);
    return;
  }

  document.getElementById('category-master-id').value = button.dataset.id;
  document.getElementById('category-master-name').value = button.dataset.name;
  categoryMasterFormTitle.textContent = 'Edit category';
  clearBanner(categoryMasterMessage);
}

function validateUserForm(payload, isEdit) {
  const errors = [];
  if (payload.username.trim().length < 3) errors.push('Username must be at least 3 characters.');
  if (!isEdit && payload.password.length < 6) errors.push('Password must be at least 6 characters.');
  if (isEdit && payload.password && payload.password.length < 6) errors.push('Updated password must be at least 6 characters.');
  if (!['admin', 'viewer'].includes(payload.role)) errors.push('Role is invalid.');
  if (!['active', 'inactive'].includes(payload.status)) errors.push('Status is invalid.');
  return errors;
}

function validateMasterName(name, label) {
  if (name.trim().length < 2) {
    return [`${label} name must be at least 2 characters.`];
  }

  return [];
}

async function loadCurrentUser() {
  const payload = await fetchJson('/api/auth/me');

  if (!payload.user || payload.user.role !== 'admin') {
    window.location.href = '/app';
    return;
  }

  state.user = payload.user;
  currentUser.textContent = payload.user.username;
  currentRole.textContent = payload.user.role;
}

async function loadAdminData(successMessage = '') {
  clearBanner(adminMessage);
  const payload = await fetchJson('/api/admin/bootstrap');
  state.users = payload.users;
  state.masterData = payload.masterData;
  renderUsers();
  renderMasterData();

  if (successMessage) {
    showBanner(adminMessage, successMessage, 'success');
  }
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveTab(button.dataset.tab);
  });
});

usersTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-user-action="edit"]');
  if (!button) {
    return;
  }

  populateUserForm(button);
});

itemMasterTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-master-action="edit"]');
  if (!button) {
    return;
  }

  populateMasterForm('item', button);
});

categoryMasterTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-master-action="edit"]');
  if (!button) {
    return;
  }

  populateMasterForm('category', button);
});

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const userId = document.getElementById('user-id').value;
  const payload = {
    username: document.getElementById('user-username').value.trim(),
    password: document.getElementById('user-password').value,
    role: document.getElementById('user-role').value,
    status: document.getElementById('user-status').value
  };

  const errors = validateUserForm(payload, Boolean(userId));
  if (errors.length) {
    showBanner(userMessage, errors.join(' '));
    return;
  }

  try {
    const response = await fetchJson(userId ? `/api/admin/users/${userId}` : '/api/admin/users', {
      method: userId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (state.user && response.user.id === state.user.id) {
      state.user = { ...state.user, ...response.user };
      currentUser.textContent = response.user.username;
      currentRole.textContent = response.user.role;
    }

    resetUserForm();
    await loadAdminData(response.message);
  } catch (error) {
    showBanner(userMessage, error.message);
  }
});

itemMasterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const entryId = document.getElementById('item-master-id').value;
  const payload = {
    name: document.getElementById('item-master-name').value.trim()
  };

  const errors = validateMasterName(payload.name, 'Item');
  if (errors.length) {
    showBanner(itemMasterMessage, errors.join(' '));
    return;
  }

  try {
    const response = await fetchJson(entryId ? `/api/admin/item-masters/${entryId}` : '/api/admin/item-masters', {
      method: entryId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    resetItemMasterForm();
    await loadAdminData(response.message);
  } catch (error) {
    showBanner(itemMasterMessage, error.message);
  }
});

categoryMasterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const entryId = document.getElementById('category-master-id').value;
  const payload = {
    name: document.getElementById('category-master-name').value.trim()
  };

  const errors = validateMasterName(payload.name, 'Category');
  if (errors.length) {
    showBanner(categoryMasterMessage, errors.join(' '));
    return;
  }

  try {
    const response = await fetchJson(entryId ? `/api/admin/category-masters/${entryId}` : '/api/admin/category-masters', {
      method: entryId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    resetCategoryMasterForm();
    await loadAdminData(response.message);
  } catch (error) {
    showBanner(categoryMasterMessage, error.message);
  }
});

userResetBtn.addEventListener('click', resetUserForm);
itemMasterResetBtn.addEventListener('click', resetItemMasterForm);
categoryMasterResetBtn.addEventListener('click', resetCategoryMasterForm);

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

(async function init() {
  try {
    setActiveTab('users');
    resetUserForm();
    resetItemMasterForm();
    resetCategoryMasterForm();
    await loadCurrentUser();
    await loadAdminData();
  } catch (error) {
    showBanner(adminMessage, error.message);
  }
})();
