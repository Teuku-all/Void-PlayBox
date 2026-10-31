/* auth.js — login, register, sesi */
let authMode = 'login';
let pendingPackageId = null, authReturnFocus = null, authEpoch = 0;
let googleInitialized = false;
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
  el?.classList.add('active');
  $('regFields').style.display = mode === 'register' ? 'block' : 'none';
  $('authBtn').textContent = mode === 'register' ? 'Buat akun' : 'Masuk';
  $('loginPass').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
}

function setScreenInert(inert) {
  document.querySelectorAll('.screen').forEach(screen => { screen.inert = inert; });
}

function openAuth(packageId = null) {
  const opener = document.activeElement;
  pendingPackageId = Number.isInteger(packageId) ? packageId : null;
  closeSidebar(false);
  closeBooking();
  closeModalDirect();
  $('formOv').classList.remove('open');
  authReturnFocus = opener?.closest('#userSidebar') ? $('userMenuBtn') : opener;
  $('loginScreen').style.display = 'flex';
  $('loginScreen').classList.add('open');
  document.body.classList.add('auth-is-open');
  setScreenInert(true);
  requestAnimationFrame(() => $('loginEmail').focus({ preventScroll: true }));
  if (!googleInitialized) { googleInitialized = true; initializeGoogleSignIn(); }
}

function closeAuth() {
  ++authEpoch;
  pendingPackageId = null;
  $('authBtn').disabled = false;
  $('loginPass').value = '';
  $('loginScreen').style.display = 'none';
  $('loginScreen').classList.remove('open');
  document.body.classList.remove('auth-is-open');
  setScreenInert(false);
  if (authReturnFocus?.isConnected) authReturnFocus.focus({ preventScroll: true });
  authReturnFocus = null;
}

async function enterGuest() {
  document.body.classList.add('guest-mode');
  $('loginScreen').style.display = 'none';
  $('loginScreen').classList.remove('open');
  document.body.classList.remove('auth-is-open');
  setScreenInert(false);
  document.querySelectorAll('.screen').forEach(screen => { screen.classList.remove('active'); screen.style.display = ''; });
  $('userScreen').classList.add('active');
  $('welcomeName').textContent = 'teman main';
  showTut('ps4', null);
  if (PACKAGES.length) renderPackages(pkgCat); else await loadPackages();
}

async function submitAuth() {
  if ($('authBtn').disabled) return;
  const email = $('loginEmail').value.trim(), password = $('loginPass').value;
  if (!email || !password) return toast('Isi email dan password.', 'error');
  if (!$('loginEmail').checkValidity()) return toast('Periksa kembali alamat email.', 'error');
  if (authMode === 'register' && (!$('regName').value.trim() || !$('regPhone').value.trim())) return toast('Isi nama dan nomor WhatsApp.', 'error');
  const epoch = ++authEpoch;
  const btn = $('authBtn');
  btn.disabled = true;
  try {
    const data = authMode === 'register'
      ? await api.post('/auth/register', { name: $('regName').value, phone: $('regPhone').value, email, password })
      : await api.post('/auth/login', { email, password });
    if (epoch !== authEpoch) return;
    Session.save(data.token, data.user);
    await enterApp(data.user);
  } catch (e) {
    if (epoch === authEpoch) toast(e.message, 'error');
  } finally {
    if (epoch === authEpoch) btn.disabled = false;
  }
}

function quickLogin(role) {
  setAuthMode('login', document.querySelector('#roleToggle .role-btn'));
  [$('loginEmail').value, $('loginPass').value] = DEMO[role];
  submitAuth();
}

function enterApp(user) {
  $('loginScreen').style.display = 'none';
  $('loginScreen').classList.remove('open');
  $('loginPass').value = '';
  document.body.classList.remove('auth-is-open', 'guest-mode');
  setScreenInert(false);
  document.querySelectorAll('.screen').forEach(screen => { screen.classList.remove('active'); screen.style.display = ''; });
  if (user.role === 'admin') pendingPackageId = null;
  const result = user.role === 'admin' ? enterAdmin(user) : enterUser(user);
  authReturnFocus = null;
  return result;
}

function logout() {
  ++authEpoch;
  pendingPackageId = null;
  ChatNotifications.stop();
  closeSidebar(false);
  stopUserPolling();
  stopAdminPolling();
  Session.clear();
  myOrders = [];
  $('trackList').replaceChildren();
  $('trackSelect').innerHTML = '<option value="">Belum ada pesanan</option>';
  for (const id of ['trackSelect', 'refreshMapBtn', 'copyTrackBtn']) $(id).disabled = true;
  $('chatMsgs').replaceChildren();
  delete $('chatMsgs').dataset.messageIds;
  $('chatIn').value = '';
  for (const id of ['admRooms', 'admChatMsgs', 'recentOrdersBody', 'ordersBody']) $(id)?.replaceChildren();
  closeModalDirect();
  $('formOv').classList.remove('open');
  $('formBody').replaceChildren();
  enterGuest();
  window.scrollTo({ top: 0, behavior: 'instant' });
  toast('Kamu sudah keluar.');
}

// pulihkan sesi saat halaman dimuat ulang
document.addEventListener('DOMContentLoaded', async () => {
  const initialToken = Session.token;
  if (!initialToken) return enterGuest();
  try {
    const { user } = await api.get('/auth/profile');
    if (initialToken !== Session.token) return;
    Session.save(Session.token, user);
    await enterApp(user);
  } catch { if (initialToken === Session.token) { Session.clear(); enterGuest(); } }
});

document.addEventListener('keydown', event => {
  if (!document.body.classList.contains('auth-is-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeAuth(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...$('loginScreen').querySelectorAll('button,a[href],input,select,iframe,[tabindex="0"]')]
    .filter(el => !el.disabled && el.getClientRects().length);
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});

async function initializeGoogleSignIn() {
  const message = $('googleAuthMessage');
  try {
    const { clientId } = await api.get('/auth/google/config');
    if (!clientId) {
      message.textContent = 'Gunakan email untuk masuk.';
      return;
    }
    const waitForGoogle = () => new Promise((resolve, reject) => {
      let attempts = 0;
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(timer); resolve(); }
        else if (++attempts > 100) { clearInterval(timer); reject(new Error('Google Sign-In gagal dimuat.')); }
      }, 100);
    });
    await waitForGoogle();
    google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential });
    google.accounts.id.renderButton($('googleSignInButton'), {
      type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
      text: 'continue_with', width: Math.min(352, $('googleSignInButton').clientWidth || 352),
      locale: 'id'
    });
    message.textContent = '';
  } catch (error) {
    message.textContent = error.message || 'Login Google tidak tersedia saat ini.';
  }
}

async function handleGoogleCredential(response) {
  const epoch = ++authEpoch;
  const button = $('authBtn');
  const message = $('googleAuthMessage');
  button.disabled = true;
  message.textContent = 'Memverifikasi akun Google…';
  try {
    const data = await api.post('/auth/google', { credential: response.credential });
    if (epoch !== authEpoch) return;
    Session.save(data.token, data.user);
    await enterApp(data.user);
  } catch (error) {
    if (epoch === authEpoch) { message.textContent = error.message; toast(error.message, 'error'); }
  } finally {
    if (epoch === authEpoch) button.disabled = false;
  }
}
