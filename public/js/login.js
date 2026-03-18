const loginForm = document.getElementById('login-form');
const messageBox = document.getElementById('message');

function showMessage(message, type = 'error') {
  messageBox.textContent = message;
  messageBox.className = `alert ${type}`;
}

async function checkExistingSession() {
  const response = await fetch('/api/auth/me');
  const payload = await response.json();

  if (payload.user) {
    window.location.href = '/app';
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');

  if (!username || !password) {
    showMessage('Please enter both username and password.');
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const payload = await response.json();

    if (!response.ok) {
      showMessage(payload.message || 'Unable to log in.');
      return;
    }

    showMessage('Login successful. Redirecting…', 'success');
    window.setTimeout(() => {
      window.location.href = '/app';
    }, 400);
  } catch (error) {
    showMessage('Unable to connect to the server.');
  }
});

checkExistingSession().catch(() => {
  // Best-effort session check for a cleaner login UX.
});
