const loginCard = document.getElementById('loginCard');
const dashboardCard = document.getElementById('dashboardCard');
const loginForm = document.getElementById('loginForm');
const detailsForm = document.getElementById('detailsForm');
const loginMessage = document.getElementById('loginMessage');
const detailsMessage = document.getElementById('detailsMessage');
const welcomeText = document.getElementById('welcomeText');
const logoutBtn = document.getElementById('logoutBtn');

let currentUserEmail = '';

function showMessage(node, text, color = '#b42318') {
  node.textContent = text;
  node.style.color = color;
}

function setLoggedIn(email, name) {
  currentUserEmail = email;
  localStorage.setItem('crmUserEmail', email);
  localStorage.setItem('crmUserName', name || '');

  loginCard.classList.add('hidden');
  dashboardCard.classList.remove('hidden');
  welcomeText.textContent = `Logged in as ${name ? `${name} (${email})` : email}`;
  fetchDetails();
}

function logout() {
  localStorage.removeItem('crmUserEmail');
  localStorage.removeItem('crmUserName');
  currentUserEmail = '';

  dashboardCard.classList.add('hidden');
  loginCard.classList.remove('hidden');
  loginForm.reset();
  detailsForm.reset();
  showMessage(loginMessage, 'Logged out.', '#344054');
  showMessage(detailsMessage, '');
}

async function fetchDetails() {
  if (!currentUserEmail) return;

  showMessage(detailsMessage, 'Loading details...', '#344054');

  const response = await fetch(`/api/details?email=${encodeURIComponent(currentUserEmail)}`);
  const result = await response.json();

  if (!response.ok) {
    showMessage(detailsMessage, result.message || 'Unable to load details.');
    return;
  }

  const fields = result.record?.fields;
  if (fields) {
    document.getElementById('company').value = fields.Company || '';
    document.getElementById('phone').value = fields.Phone || '';
    document.getElementById('notes').value = fields.Notes || '';
    showMessage(detailsMessage, 'Loaded existing details.', '#027a48');
  } else {
    detailsForm.reset();
    showMessage(detailsMessage, 'No details found yet. Add your first record.', '#344054');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  showMessage(loginMessage, 'Logging in...', '#344054');

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const result = await response.json();

  if (!response.ok) {
    showMessage(loginMessage, result.message || 'Login failed.');
    return;
  }

  showMessage(loginMessage, result.message, '#027a48');
  setLoggedIn(result.email, result.name);
});

detailsForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    email: currentUserEmail,
    company: document.getElementById('company').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    notes: document.getElementById('notes').value.trim()
  };

  showMessage(detailsMessage, 'Saving...', '#344054');

  const response = await fetch('/api/details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok) {
    showMessage(detailsMessage, result.message || 'Save failed.');
    return;
  }

  showMessage(detailsMessage, result.message, '#027a48');
});

logoutBtn.addEventListener('click', logout);

(function restoreSession() {
  const email = localStorage.getItem('crmUserEmail');
  if (!email) return;
  const name = localStorage.getItem('crmUserName') || '';
  setLoggedIn(email, name);
})();
