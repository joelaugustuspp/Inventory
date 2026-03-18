const state = {
  user: null,
  role: null,
  page: 1,
  pageSize: 5,
  totalPages: 1,
  filters: {
    search: '',
    status: '',
    category: ''
  }
};

const currentUser = document.getElementById('current-user');
const currentRole = document.getElementById('current-role');
const logoutBtn = document.getElementById('logout-btn');
const summaryGrid = document.getElementById('summary-grid');
const inventoryMessage = document.getElementById('inventory-message');
const inventoryTableBody = document.getElementById('inventory-table-body');
const addItemBtn = document.getElementById('add-item-btn');
const actionsHeader = document.getElementById('actions-header');
const auditLog = document.getElementById('audit-log');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const categoryFilter = document.getElementById('category-filter');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const paginationText = document.getElementById('pagination-text');
const itemDialog = document.getElementById('item-dialog');
const dialogTitle = document.getElementById('dialog-title');
const itemForm = document.getElementById('item-form');
const formMessage = document.getElementById('form-message');
const closeDialogBtn = document.getElementById('close-dialog');
const cancelDialogBtn = document.getElementById('cancel-dialog');

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

function statusClass(status) {
  return status.replace(/\s+/g, '-');
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function renderSummary(summary) {
  const cards = [
    { label: 'Total SKUs', value: summary.totalItems ?? 0 },
    { label: 'Low Stock', value: summary.lowStock ?? 0 },
    { label: 'Out of Stock', value: summary.outOfStock ?? 0 },
    { label: 'Units on Hand', value: summary.totalUnits ?? 0 }
  ];

  summaryGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card material-card">
          <p class="subtitle">${card.label}</p>
          <p class="summary-value">${card.value}</p>
        </article>
      `
    )
    .join('');
}

function renderCategories(categories) {
  categoryFilter.innerHTML = '<option value="">All categories</option>';
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    if (category === state.filters.category) {
      option.selected = true;
    }
    categoryFilter.appendChild(option);
  });
}

function renderAuditLogs(logs) {
  if (!logs.length) {
    auditLog.innerHTML = '<p class="subtitle">No audit activity available yet.</p>';
    return;
  }

  auditLog.innerHTML = logs
    .map(
      (log) => `
        <article class="audit-item">
          <strong>${escapeHtml(log.actor_username)}</strong>
          <p>${escapeHtml(log.action)} • ${escapeHtml(log.item_name || 'Deleted item')}</p>
          <p class="subtitle">${escapeHtml(log.details || '')}</p>
          <p class="subtitle">${formatDate(log.created_at)}</p>
        </article>
      `
    )
    .join('');
}

function openItemDialog(item = null) {
  clearBanner(formMessage);
  dialogTitle.textContent = item ? 'Edit item' : 'Add item';
  document.getElementById('item-id').value = item?.id || '';
  document.getElementById('item-name').value = item?.item_name || '';
  document.getElementById('item-category').value = item?.category || '';
  document.getElementById('item-quantity').value = item?.quantity ?? 0;
  document.getElementById('item-price').value = item?.price ?? '0.00';
  document.getElementById('item-status').value = item?.status || 'in stock';
  itemDialog.showModal();
}

function closeItemDialog() {
  itemDialog.close();
}

function renderTable(items) {
  if (!items.length) {
    const columnCount = state.role === 'admin' ? 9 : 8;
    inventoryTableBody.innerHTML = `<tr><td colspan="${columnCount}" class="subtitle">No inventory items match your filters.</td></tr>`;
    return;
  }

  inventoryTableBody.innerHTML = items
    .map((item) => {
      const adminActions = state.role === 'admin'
        ? `
          <td>
            <div class="table-actions">
              <button class="btn btn-secondary" data-action="edit" data-id="${item.id}">Edit</button>
              <button class="btn btn-secondary" data-action="delete" data-id="${item.id}">Delete</button>
            </div>
          </td>
        `
        : '';

      return `
        <tr>
          <td>${item.id}</td>
          <td>${escapeHtml(item.item_name)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.price)}</td>
          <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
          <td>${formatDate(item.last_updated)}</td>
          <td>${escapeHtml(item.updated_by_username || 'System')}</td>
          ${adminActions}
        </tr>
      `;
    })
    .join('');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.href = '/';
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    const message = payload.errors?.join(' ') || payload.message || 'Request failed.';
    throw new Error(message);
  }

  return payload;
}

async function loadCurrentUser() {
  const payload = await fetchJson('/api/auth/me');
  if (!payload.user) {
    window.location.href = '/';
    return;
  }

  state.user = payload.user.username;
  state.role = payload.user.role;
  currentUser.textContent = payload.user.username;
  currentRole.textContent = payload.user.role;

  if (state.role === 'admin') {
    addItemBtn.classList.remove('hidden');
    actionsHeader.classList.remove('hidden');
  }
}

async function loadInventory() {
  clearBanner(inventoryMessage);
  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.pageSize)
  });

  Object.entries(state.filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  try {
    const payload = await fetchJson(`/api/inventory?${params.toString()}`);
    renderSummary(payload.summary);
    renderCategories(payload.categories);
    renderAuditLogs(payload.auditLogs);
    renderTable(payload.items);
    state.totalPages = payload.pagination.totalPages;
    paginationText.textContent = `Page ${payload.pagination.page} of ${payload.pagination.totalPages} • ${payload.pagination.total} item(s)`;
    prevPageBtn.disabled = payload.pagination.page <= 1;
    nextPageBtn.disabled = payload.pagination.page >= payload.pagination.totalPages;
  } catch (error) {
    showBanner(inventoryMessage, error.message);
  }
}

async function handleDelete(itemId) {
  if (!window.confirm('Are you sure you want to delete this inventory item?')) {
    return;
  }

  try {
    const payload = await fetchJson(`/api/inventory/${itemId}`, { method: 'DELETE' });
    showBanner(inventoryMessage, payload.message, 'success');
    loadInventory();
  } catch (error) {
    showBanner(inventoryMessage, error.message);
  }
}

inventoryTableBody.addEventListener('click', async (event) => {
  const target = event.target.closest('button[data-action]');
  if (!target) {
    return;
  }

  const itemId = target.dataset.id;
  const row = target.closest('tr');

  if (target.dataset.action === 'delete') {
    handleDelete(itemId);
    return;
  }

  if (target.dataset.action === 'edit') {
    const cells = row.querySelectorAll('td');
    openItemDialog({
      id: Number(itemId),
      item_name: cells[1].textContent.trim(),
      category: cells[2].textContent.trim(),
      quantity: Number(cells[3].textContent.trim()),
      price: Number(cells[4].textContent.replace(/[^0-9.-]+/g, '')),
      status: cells[5].textContent.trim().toLowerCase()
    });
  }
});

function validateForm(payload) {
  const errors = [];
  if (payload.itemName.trim().length < 2) errors.push('Item name must be at least 2 characters.');
  if (payload.category.trim().length < 2) errors.push('Category must be at least 2 characters.');
  if (!Number.isInteger(Number(payload.quantity)) || Number(payload.quantity) < 0) errors.push('Quantity must be a whole number 0 or greater.');
  if (Number.isNaN(Number(payload.price)) || Number(payload.price) < 0) errors.push('Price must be 0 or greater.');
  if (!['in stock', 'low stock', 'out of stock'].includes(payload.status)) errors.push('Status is invalid.');
  return errors;
}

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    itemName: document.getElementById('item-name').value.trim(),
    category: document.getElementById('item-category').value.trim(),
    quantity: document.getElementById('item-quantity').value,
    price: document.getElementById('item-price').value,
    status: document.getElementById('item-status').value
  };
  const itemId = document.getElementById('item-id').value;

  const errors = validateForm(payload);
  if (errors.length) {
    showBanner(formMessage, errors.join(' '));
    return;
  }

  try {
    const payloadResponse = await fetchJson(itemId ? `/api/inventory/${itemId}` : '/api/inventory', {
      method: itemId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    closeItemDialog();
    showBanner(inventoryMessage, payloadResponse.message, 'success');
    loadInventory();
  } catch (error) {
    showBanner(formMessage, error.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

addItemBtn.addEventListener('click', () => openItemDialog());
closeDialogBtn.addEventListener('click', closeItemDialog);
cancelDialogBtn.addEventListener('click', closeItemDialog);
searchInput.addEventListener('input', (event) => {
  state.filters.search = event.target.value.trim();
  state.page = 1;
  loadInventory();
});
statusFilter.addEventListener('change', (event) => {
  state.filters.status = event.target.value;
  state.page = 1;
  loadInventory();
});
categoryFilter.addEventListener('change', (event) => {
  state.filters.category = event.target.value;
  state.page = 1;
  loadInventory();
});
prevPageBtn.addEventListener('click', () => {
  state.page = Math.max(1, state.page - 1);
  loadInventory();
});
nextPageBtn.addEventListener('click', () => {
  state.page = Math.min(state.totalPages, state.page + 1);
  loadInventory();
});

(async function init() {
  try {
    await loadCurrentUser();
    await loadInventory();
  } catch (error) {
    showBanner(inventoryMessage, error.message);
  }
})();
