/* auth.js — login, register, sesi */
let authMode = 'login';
const DEMO = { user: ['user@playbox.id', 'user123'], admin: ['admin@playbox.id', 'admin123'] };

function togglePasswordVisibility() {
  const input = $('loginPass');
  const button = document.querySelector('.password-toggle');
  const showPassword = input.type === 'password';
  input.type = showPassword ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(showPassword));
  button.setAttribute('aria-label', showPassword ? 'Sembunyikan password' : 'Lihat password');
  input.focus({ preventScroll: true });
}

function setAuthMode(mode, el) {
  authMode = mode;
  document.querySelectorAll('#roleToggle .role-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  $('regFields').style.display = mode === 'register' ? 'block' : 'none';
  $('authBtn').textContent = mode === 'register' ? 'Daftar Sekarang' : 'Masuk ke Void Play Box';
}

async function submitAuth() {
  const email = $('loginEmail').value.trim(), password = $('loginPass').value;
  if (!email || !password) return toast('⚠️ Email dan password wajib diisi', 'error');
  const btn = $('authBtn');
  btn.disabled = true;
  try {
    const data = authMode === 'register'
      ? await api.post('/auth/register', { name: $('regName').value, phone: $('regPhone').value, email, password })
      : await api.post('/auth/login', { email, password });
    Session.save(data.token, data.user);
    enterApp(data.user);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function quickLogin(role) {
  setAuthMode('login', document.querySelector('#roleToggle .role-btn'));
  [$('loginEmail').value, $('loginPass').value] = DEMO[role];
  submitAuth();
}

function enterApp(user) {
  $('loginScreen').style.display = 'none';
  return user.role === 'admin' ? enterAdmin(user) : enterUser(user);
}

function logout() {
  stopUserPolling();
  stopAdminPolling();
  Session.clear();
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = ''; });
  $('loginScreen').style.display = 'flex';
  toast('Berhasil keluar. Sampai jumpa! 👋');
}

// pulihkan sesi saat halaman dimuat ulang
document.addEventListener('DOMContentLoaded', async () => {
  if (!Session.token) return;
  try {
    const { user } = await api.get('/auth/profile');
    Session.save(Session.token, user);
    enterApp(user);
  } catch { Session.clear(); }
});
