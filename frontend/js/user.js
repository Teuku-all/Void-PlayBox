/* user.js — halaman pelanggan: paket, booking, pelacakan (Leaflet), chat */
let PACKAGES = [], selectedPkg = null, myOrders = [], trackedOrderId = null;
let trackTimer = null, chatTimer = null, chatCount = -1, userChatLoading = false;
const STORE_POS = [5.5483, 95.3238]; // Void Play Box Store, Banda Aceh

async function enterUser(user) {
  $('userScreen').classList.add('active');
  $('userAvatar').textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
  $('welcomeName').textContent = (user.name?.trim() || 'teman main').split(' ')[0];
  initMap();
  showTut('ps4', null);
  await Promise.all([loadPackages(), loadMyOrders()]);
  startChat();
  toast(`Selamat datang, ${(user.name || '').split(' ')[0]}! 🎮`, 'success');
}

function stopUserPolling() {
  clearInterval(trackTimer); clearInterval(chatTimer);
  trackedOrderId = null; chatCount = -1; selectedPkg = null;
  resetLocationSession();
}

/* ══════ PAKET ══════ */
async function loadPackages() {
  $('pkgGrid').innerHTML = '<div class="package-state" role="status">Menyiapkan paket main untukmu…</div>';
  $('pkgMore').hidden = true;
  try {
    PACKAGES = (await api.get('/packages')).packages.filter(p => ['ps4_slim', 'ps4_pro'].includes(p.ps_type));
    if (PACKAGES.length) $('startingPrice').textContent = `Mulai ${rupiah(Math.min(...PACKAGES.map(p => p.price)))}`;
    renderPackages('all');
  } catch (e) {
    $('pkgCount').textContent = '';
    $('pkgGrid').innerHTML = `<div class="package-state" role="alert">Paket belum bisa dimuat. ${esc(e.message)}<button class="btn-sm" onclick="loadPackages()">Coba lagi</button></div>`;
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
  btn.textContent = `Lihat semua ${cards.length} paket ↓`;
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
      <div class="pkg-icon-wrap">${PS_ICON[p.ps_type] || '🎮'}</div>
      ${p.is_popular ? '<span class="pkg-popular">✦ Favorit pemain</span>' : `<span class="pkg-category">${esc(groups[p.catalog_group || p.category] || 'Paket sewa')}</span>`}
      </div>
      <h3 class="pkg-name">${esc(p.name)}</h3>
      <div class="pkg-dur"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(p.duration_label || `${p.duration} Hari`)}</div>
      <div class="pkg-price">${rupiah(p.price)}<span>/ paket · sesuai durasi pilihan</span></div>
      <ul class="pkg-features">${[...new Set([...p.features, 'Mode bermain offline'])].map(f => `<li><span class="pkg-check">✓</span>${esc(f)}</li>`).join('')}</ul>
      <button class="btn-pkg ${p.is_popular ? 'btn-pkg-main' : 'btn-pkg-outline'}" aria-label="${esc('Pilih ' + p.name)}" onclick="bookPkg(${p.id})">Pilih paket ini <span aria-hidden="true">↗</span></button>
    </article>`).join('') || '<div class="package-state" role="status">Belum ada paket di kategori ini. Coba kategori lainnya, ya.</div>';
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
  selectedPkg = PACKAGES.find(p => p.id === id);
  const u = Session.user || {};
  $('bsName').textContent = selectedPkg.name;
  $('bsDetail').textContent = `${PS_ICON[selectedPkg.ps_type]} · ${selectedPkg.duration_label || `${selectedPkg.duration} Hari`} · 2 Controller`;
  $('bsPrice').textContent = rupiah(selectedPkg.price);
  $('bsTotal').textContent = rupiah(Number(selectedPkg.price) + 15000);
  if (!$('bName').value) $('bName').value = u.name || '';
  if (!$('bPhone').value) $('bPhone').value = u.phone || '';
  if (!$('bAddr').value) $('bAddr').value = u.address || '';
  $('bookingPanel').classList.add('open');
  initBookingMap();
}

function openBooking() {
  if (selectedPkg) { $('bookingPanel').classList.add('open'); initBookingMap(); }
  else toast('Pilih paket terlebih dahulu ya!');
}
function closeBooking() { $('bookingPanel').classList.remove('open'); }
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
  const name = $('bName').value.trim(), phone = $('bPhone').value.trim(), addr = $('bAddr').value.trim();
  if (!selectedPkg) return toast('Pilih paket terlebih dahulu ya!');
  if (locationBusy) return toast('Tunggu pencarian lokasi selesai, atau hapus titik untuk melanjutkan dengan alamat manual.');
  if (!name || !phone || !addr) return toast('⚠️ Lengkapi semua data dulu ya!', 'error');

  const btn = $('bookBtn');
  btn.disabled = true; btn.textContent = 'Memproses…';
  try {
    const pos = deliveryLocation
      ? { delivery_lat: deliveryLocation.lat, delivery_lng: deliveryLocation.lng }
      : await geocodeAddress(addr);
    const { order } = await api.post('/orders', {
      package_id: selectedPkg.id,
      payment_method: $('bPay').value,
      delivery_address: addr,
      notes: `Penerima: ${name} · WA: ${phone}`,
      ...pos,
    });
    closeBooking();
    $('modalOrderId').textContent = '#' + order.order_code;
    $('modalOv').classList.add('open');
    selectedPkg = null;
    clearDeliveryLocation();
    await loadMyOrders();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Konfirmasi Booking';
  }
}

/* ══════ PESANAN & PELACAKAN ══════ */
async function loadMyOrders() {
  try { myOrders = (await api.get('/orders/my')).orders; }
  catch (e) { return toast(e.message, 'error'); }
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
    $('trackList').innerHTML = '<div class="tracking-empty"><span aria-hidden="true">↗</span><div><strong>Belum ada perjalanan</strong><p>Pilih paket main pertamamu. Kamu tetap bisa menandai lokasi di peta.</p></div><button class="btn-sm" onclick="userScroll(\'packages\')">Pilih paket</button></div>';
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
          <div class="courier-av" style="background:#FEF3C7">${o.courier_name ? '🛵' : '⏳'}</div>
          <div class="courier-info"><div class="courier-name">${esc(o.courier_name || 'Menunggu penugasan kurir')}</div>
          <div class="courier-sub">${o.courier_name ? 'Kurir untuk pesananmu' : 'Admin sedang mengatur pengantaran'}</div></div>
        </div>
        <div class="track-actions"><button class="btn-sm" onclick="focusOrder(${o.id})">Lihat di peta ↗</button>${['pending', 'confirmed'].includes(o.status) ? `<button class="btn-sm" onclick="cancelOrder(${o.id})">Batalkan pesanan</button>` : ''}</div>
      </div>`).join('')}
  </div>`;
}

function focusOrder(id) {
  $('trackSelect').value = id;
  trackOrder(id);
  $('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function cancelOrder(id) {
  if (!confirm('Batalkan pesanan ini?')) return;
  try {
    await api.put(`/orders/${id}/cancel`);
    toast('Pesanan dibatalkan', 'success');
    await loadMyOrders();
  } catch (e) { toast(e.message, 'error'); }
}

function copyTrackCode() {
  const o = myOrders.find(x => x.id === trackedOrderId);
  if (!o) return toast('Belum ada pesanan untuk dilacak');
  navigator.clipboard?.writeText(o.order_code);
  toast('🔗 Kode pesanan disalin!', 'success');
}

/* LIVE CHAT */
const myRoom = () => `user_${Session.user.id}`;

function startChat() {
  ChatNotifications.start();
  loadChat();
  clearInterval(chatTimer);
  chatTimer = setInterval(() => { if (ChatNotifications.active(myRoom())) loadChat(); }, 5000);
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
      box.innerHTML = bubble('Halo! Selamat datang di Void Play Box. Tanyakan paket PS4, pilihan game, atau bantuan pemasangan di sini.', 'theirs', '')
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
  const inp = $('chatIn'), txt = inp.value.trim();
  if (!txt || $('userSendBtn').disabled) return;
  $('userSendBtn').disabled = true;
  try {
    await api.post(`/chat/${myRoom()}/messages`, { message: txt });
    inp.value = '';
    loadChat();
  } catch (e) { toast(e.message, 'error'); }
  finally { $('userSendBtn').disabled = false; }
}
function sendQuick(txt) { $('chatIn').value = txt; sendChat(); }
