/* user.js — halaman pelanggan: paket, booking, pelacakan (Leaflet), chat */
let PACKAGES = [], selectedPkg = null, myOrders = [], trackedOrderId = null;
let trackTimer = null, chatTimer = null, chatCount = -1, userChatLoading = false;
const STORE_POS = [5.5483, 95.3238]; // Void Play Box Store, Banda Aceh

async function enterUser(user) {
  const token = Session.token;
  document.body.classList.remove('guest-mode');
  $('userScreen').classList.add('active');
  $('userAvatar').textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
  $('welcomeName').textContent = (user.name?.trim() || 'teman main').split(' ')[0];
  initMap();
  showTut('ps4', null);
  await Promise.all([loadPackages(), loadMyOrders()]);
  if (token !== Session.token || Session.user?.role !== 'user') return;
  startChat();
  if (pendingPackageId !== null) {
    const packageId = pendingPackageId;
    pendingPackageId = null;
    document.querySelector(`.btn-pkg[onclick="bookPkg(${packageId})"]`)?.focus({ preventScroll: true });
    bookPkg(packageId);
  }
}

function stopUserPolling() {
  clearInterval(trackTimer); clearInterval(chatTimer);
  trackedOrderId = null; chatCount = -1; selectedPkg = null;
  userChatLoading = false;
  resetLocationSession();
}

/* ══════ PAKET ══════ */
async function loadPackages() {
  $('pkgGrid').innerHTML = '<div class="package-state" role="status">Memuat paket…</div>';
  $('pkgMore').hidden = true;
  try {
    PACKAGES = (await api.get('/packages')).packages.filter(p => ['ps4_slim', 'ps4_pro'].includes(p.ps_type));
    if (PACKAGES.length) $('startingPrice').textContent = `Mulai ${rupiah(Math.min(...PACKAGES.map(p => p.price)))}`;
    document.querySelectorAll('.pkg-tab').forEach((tab, index) => { tab.classList.toggle('active', index === 0); tab.setAttribute('aria-pressed', String(index === 0)); });
    renderPackages('all');
  } catch (e) {
    $('pkgCount').textContent = '';
    $('pkgGrid').innerHTML = '<div class="package-state" role="alert"><strong>Paket belum bisa dimuat.</strong><p>Periksa koneksi, lalu coba lagi.</p><button class="btn-sm" onclick="loadPackages()">Coba lagi</button></div>';
  }
}

let pkgCat = 'all', pkgExpanded = false;

/* Hide complete cards so collapsed packages never leave invisible focus targets. */
function applyPkgCollapse() {
  const grid = $('pkgGrid'), btn = $('pkgMore');
  if (!grid || !btn) return;
  grid.classList.remove('collapsed');
  grid.style.maxHeight = '';
  btn.hidden = true;
  const cards = [...grid.querySelectorAll('.pkg-card')];
  const limit = window.matchMedia('(max-width:768px)').matches ? 3 : 6;
  const collapsed = pkgCat === 'all' && !pkgExpanded && cards.length > limit;
  cards.forEach((card, i) => { card.hidden = collapsed && i >= limit; });
  btn.hidden = !collapsed;
  btn.textContent = `Lihat ${cards.length} paket`;
  btn.setAttribute('aria-expanded', String(!collapsed));
  btn.setAttribute('aria-controls', 'pkgGrid');
}

function expandPkg() {
  const firstHidden = $('pkgGrid').querySelector('.pkg-card[hidden] .btn-pkg');
  pkgExpanded = true;
  applyPkgCollapse();
  firstHidden?.focus({ preventScroll: true });
}

window.addEventListener('resize', applyPkgCollapse);

function renderPackages(cat) {
  pkgCat = cat;
  const list = cat === 'all' ? PACKAGES : PACKAGES.filter(p => (p.catalog_group || p.category) === cat);
  const groups = { personal: 'Personal', harian: 'Harian', hemat: 'Hemat' };
  $('pkgCount').textContent = `${list.length} pilihan paket`;
  $('pkgGrid').innerHTML = list.map(p => `
    <article class="pkg-card${p.is_popular ? ' featured' : ''}">
      <div class="pkg-card-top">
      <div class="pkg-icon-wrap">${icon('gamepad')}</div>
      ${p.is_popular ? '<span class="pkg-popular">Favorit</span>' : `<span class="pkg-category">${esc(groups[p.catalog_group || p.category] || 'Paket sewa')}</span>`}
      </div>
      <h3 class="pkg-name">${esc(p.name)}</h3>
      <div class="pkg-dur"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(p.duration_label || `${p.duration} Hari`)}</div>
      <div class="pkg-price">${rupiah(p.price)}<span>/ paket</span></div>
      <ul class="pkg-features">${[...new Set([...(Array.isArray(p.features) ? p.features : []).filter(f => !/^ps4|pilih jadwal/i.test(f)), 'Main offline'])].slice(0, 3).map(f => `<li><span class="pkg-check">${icon('check')}</span>${esc(f)}</li>`).join('')}</ul>
      <button class="btn-pkg ${p.is_popular ? 'btn-pkg-main' : 'btn-pkg-outline'}" aria-label="${esc('Pilih ' + p.name)}" onclick="bookPkg(${p.id})">Pilih paket ${icon('arrow-right')}</button>
    </article>`).join('') || '<div class="package-state" role="status">Belum ada paket. Coba kategori lain.</div>';
  applyPkgCollapse();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyPkgCollapse);
}

function filterPkg(cat, el) {
  document.querySelectorAll('.pkg-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-pressed', 'false'); });
  el.classList.add('active');
  el.setAttribute('aria-pressed', 'true');
  pkgExpanded = false;
  renderPackages(cat);
}

/* ══════ BOOKING ══════ */
function bookPkg(id) {
  if (!Session.token || Session.user?.role !== 'user') { openAuth(id); return; }
  selectedPkg = PACKAGES.find(p => p.id === id);
  if (!selectedPkg) return toast('Paket ini belum tersedia. Pilih paket lainnya.');
  const u = Session.user || {};
  $('bsName').textContent = selectedPkg.name;
  $('bsDetail').textContent = `PS4 · ${selectedPkg.duration_label || `${selectedPkg.duration} Hari`} · 2 controller`;
  $('bsPrice').textContent = rupiah(selectedPkg.price);
  $('bsTotal').textContent = rupiah(Number(selectedPkg.price) + 15000);
  if (!$('bName').value) $('bName').value = u.name || '';
  if (!$('bPhone').value) $('bPhone').value = u.phone || '';
  if (!$('bAddr').value) $('bAddr').value = u.address || '';
  openBooking();
}

let bookingReturnFocus = null;
function openBooking() {
  if (!Session.token || Session.user?.role !== 'user') { openAuth(); return; }
  if (!selectedPkg) return toast('Pilih paket terlebih dahulu.');
  closeSidebar(false);
  ChatNotifications.closePanel();
  bookingReturnFocus = document.activeElement;
  $('bookingPanel').classList.add('open');
  document.body.classList.add('booking-is-open');
  setScreenInert(true);
  initBookingMap();
  requestAnimationFrame(() => $('bookingPanel').querySelector('.sheet-close')?.focus({ preventScroll: true }));
}
function closeBooking() {
  $('bookingPanel').classList.remove('open');
  document.body.classList.remove('booking-is-open');
  setScreenInert(false);
  if (bookingReturnFocus?.isConnected) bookingReturnFocus.focus({ preventScroll: true });
  bookingReturnFocus = null;
}
function closeBookingOutside(e) { if (e.target === $('bookingPanel')) closeBooking(); }
function closeModal(e) { if (e.target === $('modalOv')) closeModalDirect(); }
function closeModalDirect() { $('modalOv').classList.remove('open'); }

// alamat → koordinat (Nominatim via backend); coba alamat penuh, lalu 2 bagian terakhir
async function geocodeAddress(addr) {
  const tries = [addr, addr.split(',').slice(-2).join(',')];
  for (const q of [...new Set(tries)]) {
    try {
      const { results } = await api.get('/maps/geocode?q=' + encodeURIComponent(q));
      if (results && results[0]) return { delivery_lat: results[0].lat, delivery_lng: results[0].lng };
    } catch { /* lanjut ke percobaan berikutnya */ }
  }
  return {};
}

async function submitBooking() {
  if ($('bookBtn').disabled) return;
  if (!Session.token || Session.user?.role !== 'user') { closeBooking(); openAuth(); return; }
  const name = $('bName').value.trim(), phone = $('bPhone').value.trim(), addr = $('bAddr').value.trim();
  if (!selectedPkg) return toast('Pilih paket terlebih dahulu.');
  if (locationBusy) return toast('Tunggu pencarian lokasi selesai.');
  if (!name || !phone || !addr) {
    const missing = !name ? $('bName') : !phone ? $('bPhone') : $('bAddr');
    missing.focus();
    return toast('Lengkapi nama, WhatsApp, dan alamat.', 'error');
  }

  const btn = $('bookBtn');
  const token = Session.token, packageId = selectedPkg.id;
  btn.disabled = true; btn.textContent = 'Memproses…';
  try {
    const pos = deliveryLocation
      ? { delivery_lat: deliveryLocation.lat, delivery_lng: deliveryLocation.lng }
      : await geocodeAddress(addr);
    if (token !== Session.token) return;
    const { order } = await api.post('/orders', {
      package_id: packageId,
      payment_method: $('bPay').value,
      delivery_address: addr,
      notes: `Penerima: ${name} · WA: ${phone}`,
      ...pos,
    });
    if (token !== Session.token) return;
    closeBooking();
    $('modalOrderId').textContent = '#' + order.order_code;
    $('modalOv').classList.add('open');
    selectedPkg = null;
    clearDeliveryLocation();
    await loadMyOrders();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Kirim pesanan';
  }
}

/* ══════ PESANAN & PELACAKAN ══════ */
async function loadMyOrders() {
  if (!Session.token || Session.user?.role !== 'user') return;
  const token = Session.token;
  try {
    const { orders } = await api.get('/orders/my');
    if (token !== Session.token) return;
    myOrders = orders;
  }
  catch (e) { if (token === Session.token) toast(e.message, 'error'); return; }
  renderTrackList();

  const sel = $('trackSelect');
  sel.innerHTML = myOrders.length
    ? myOrders.map(o => `<option value="${o.id}">${esc(o.order_code)} — ${esc(o.package_name)}</option>`).join('')
    : '<option value="">Belum ada pesanan</option>';
  sel.disabled = !myOrders.length;
  $('refreshMapBtn').disabled = !myOrders.length;
  $('copyTrackBtn').disabled = !myOrders.length;
  const pick = myOrders.find(o => o.id === trackedOrderId)
    || myOrders.find(o => !['completed', 'cancelled'].includes(o.status))
    || myOrders[0];
  if (pick) { sel.value = pick.id; trackOrder(pick.id); }
  else resetTrackingMap();
  updateLocationUI();
}

function renderTrackList() {
  const steps = ['Konfirmasi', 'Disiapkan', 'Diantar', 'Tiba'];
  if (!myOrders.length) {
    $('trackList').innerHTML = `<div class="tracking-empty"><span aria-hidden="true">${icon('package')}</span><div><strong>Belum ada pesanan</strong><p>Paket pilihanmu akan muncul di sini.</p></div><button class="btn-sm" onclick="userScroll('packages')">Pilih paket</button></div>`;
    return;
  }
  $('trackList').innerHTML = `<div class="tracking-cards">
    ${myOrders.slice(0, 4).map(o => `
      <div class="track-card">
        <div class="track-head"><div class="track-id">#${esc(o.order_code)}</div>${statusPill(o.status)}</div>
        <div class="track-package"><strong>${esc(o.package_name)}</strong><span>${rupiah(o.total)}</span></div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${(ORDER_STATUS[o.status] || {}).step || 0}%"></div></div>
        <div class="track-steps">${steps.map(s => `<span>${s}</span>`).join('')}</div>
        <div class="courier-row">
          <div class="courier-av">${icon(o.courier_name ? 'truck' : 'clock')}</div>
          <div class="courier-info"><div class="courier-name">${esc(o.courier_name || 'Menunggu kurir')}</div>
          <div class="courier-sub">${o.courier_name ? 'Kurir pesananmu' : 'Pengantaran sedang diatur'}</div></div>
        </div>
        <div class="track-actions"><button class="btn-sm" onclick="focusOrder(${o.id})">Lihat peta ${icon('arrow-up-right')}</button>${['pending', 'confirmed'].includes(o.status) ? `<button class="btn-sm" onclick="cancelOrder(${o.id})">Batalkan</button>` : ''}</div>
      </div>`).join('')}
  </div>`;
}

function focusOrder(id) {
  $('trackSelect').value = id;
  trackOrder(id);
  $('map').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
}

async function cancelOrder(id) {
  if (!confirm('Batalkan pesanan ini?')) return;
  try {
    await api.put(`/orders/${id}/cancel`);
    toast('Pesanan dibatalkan', 'success');
    await loadMyOrders();
  } catch (e) { toast(e.message, 'error'); }
}

async function copyTrackCode() {
  const o = myOrders.find(x => x.id === trackedOrderId);
  if (!o) return toast('Belum ada pesanan untuk dilacak');
  try { await navigator.clipboard.writeText(o.order_code); toast('Kode pesanan disalin.', 'success'); }
  catch { toast('Kode belum tersalin. Salin nomor pesanan secara manual.', 'error'); }
}

/* LIVE CHAT */
const myRoom = () => `user_${Session.user.id}`;

function startChat() {
  if (!Session.token || Session.user?.role !== 'user') return;
  ChatNotifications.start();
  loadChat();
  clearInterval(chatTimer);
  chatTimer = setInterval(() => { if (Session.user?.role === 'user' && ChatNotifications.active(myRoom())) loadChat(); }, 5000);
}

async function loadChat() {
  if (userChatLoading || Session.user?.role !== 'user') return;
  userChatLoading = true;
  const token = Session.token, room = myRoom();
  try {
    const { messages } = await api.get(`/chat/${room}/messages`);
    if (token !== Session.token) return;
    const box = $('chatMsgs');
    const signature = messages.map(m => m.id).join(',');
    const nearBottom = ChatNotifications.atBottom(box);
    if (signature !== box.dataset.messageIds || chatCount === -1) {
      box.innerHTML = bubble('Halo! Mau tanya paket atau pilihan game?', 'theirs', '')
      + messages.map(m => bubble(m.message, m.sender_role === 'admin' ? 'theirs' : 'mine', fmtTime(m.created_at))).join('');
      if (nearBottom || chatCount === -1) box.scrollTop = box.scrollHeight;
      box.dataset.messageIds = signature;
    }
    chatCount = messages.length;
    await ChatNotifications.ack(room, messages, box);
  } catch { /* abaikan, coba lagi pada polling berikutnya */ }
  finally { userChatLoading = false; }
}

async function sendChat() {
  if (!Session.token || Session.user?.role !== 'user') { openAuth(); return; }
  const inp = $('chatIn'), txt = inp.value.trim();
  if (!txt || $('userSendBtn').disabled) return;
  $('userSendBtn').disabled = true;
  const token = Session.token;
  try {
    await api.post(`/chat/${myRoom()}/messages`, { message: txt });
    if (token !== Session.token) return;
    inp.value = '';
    loadChat();
  } catch (e) { toast(e.message, 'error'); }
  finally { $('userSendBtn').disabled = false; }
}
function sendQuick(txt) { $('chatIn').value = txt; sendChat(); }

document.addEventListener('keydown', event => {
  if (!$('bookingPanel').classList.contains('open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeBooking(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...$('bookingPanel').querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')]
    .filter(el => !el.disabled && el.getClientRects().length);
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
