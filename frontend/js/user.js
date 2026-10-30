/* user.js — halaman pelanggan: paket, booking, pelacakan (Leaflet), chat */
let PACKAGES = [], selectedPkg = null, myOrders = [], trackedOrderId = null;
let map = null, mapLayers = {}, trackTimer = null, chatTimer = null, chatCount = -1;
const STORE_POS = [5.5483, 95.3238]; // Void Play Box Store, Banda Aceh

async function enterUser(user) {
  $('userScreen').classList.add('active');
  $('userAvatar').textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
  $('welcomeName').textContent = (user.name || 'Player').split(' ')[0];
  initMap();
  showTut('ps4', null);
  await Promise.all([loadPackages(), loadMyOrders()]);
  startChat();
  toast(`Selamat datang, ${(user.name || '').split(' ')[0]}! 🎮`, 'success');
}

function stopUserPolling() {
  clearInterval(trackTimer); clearInterval(chatTimer);
  trackedOrderId = null; chatCount = -1; selectedPkg = null;
}

/* ══════ PAKET ══════ */
async function loadPackages() {
  $('pkgGrid').innerHTML = '<div class="package-state" role="status">Menyiapkan paket main untukmu…</div>';
  $('pkgMore').hidden = true;
  try {
    PACKAGES = (await api.get('/packages')).packages;
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
      <ul class="pkg-features">${p.features.map(f => `<li><span class="pkg-check">✓</span>${esc(f)}</li>`).join('')}</ul>
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
  if (!$('bName').value) $('bName').value = u.name || '';
  if (!$('bPhone').value) $('bPhone').value = u.phone || '';
  if (!$('bAddr').value) $('bAddr').value = u.address || '';
  $('bookingPanel').classList.add('open');
}

function openBooking() {
  if (selectedPkg) $('bookingPanel').classList.add('open');
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
  if (!name || !phone || !addr) return toast('⚠️ Lengkapi semua data dulu ya!', 'error');

  const btn = $('bookBtn');
  btn.disabled = true; btn.textContent = 'Memproses…';
  try {
    const pos = await geocodeAddress(addr);
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
    : '<option>Belum ada pesanan</option>';
  const pick = myOrders.find(o => o.id === trackedOrderId)
    || myOrders.find(o => !['completed', 'cancelled'].includes(o.status))
    || myOrders[0];
  if (pick) { sel.value = pick.id; trackOrder(pick.id); }
}

function renderTrackList() {
  const steps = ['Dikonfirmasi', 'Disiapkan', 'Di Jalan', 'Tiba'];
  if (!myOrders.length) {
    $('trackList').innerHTML = '<p style="color:var(--muted);margin-bottom:28px">Belum ada pesanan. Pilih paket untuk mulai menyewa 🎮</p>';
    return;
  }
  $('trackList').innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-bottom:28px">
    ${myOrders.slice(0, 4).map(o => `
      <div class="track-card">
        <div class="track-head"><div class="track-id">#${esc(o.order_code)}</div>${statusPill(o.status)}</div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${(ORDER_STATUS[o.status] || {}).step || 0}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:16px">${steps.map(s => `<span>${s}</span>`).join('')}</div>
        <div class="courier-row">
          <div class="courier-av" style="background:#FEF3C7">${o.courier_name ? '🛵' : '⏳'}</div>
          <div><div class="courier-name">${esc(o.courier_name || 'Menunggu kurir')}</div>
          <div class="courier-sub">${esc(o.package_name)} · ${rupiah(o.total)}</div></div>
          <button class="btn-sm" onclick="focusOrder(${o.id})">Lacak</button>
          ${['pending', 'confirmed'].includes(o.status) ? `<button class="btn-sm" onclick="cancelOrder(${o.id})">Batal</button>` : ''}
        </div>
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

/* ── Peta (Leaflet + OpenStreetMap) ── */
function initMap() {
  if (map) return map.invalidateSize();
  map = L.map('map').setView(STORE_POS, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  setMarker('store', STORE_POS, '🏪', 'Void Play Box Store');
}

function setMarker(key, pos, emoji, label) {
  if (mapLayers[key]) return mapLayers[key].setLatLng(pos);
  mapLayers[key] = L.marker(pos, { icon: L.divIcon({ html: emoji, className: 'emoji-pin', iconSize: [32, 32] }) })
    .addTo(map).bindTooltip(label);
}

function removeLayer(key) {
  if (mapLayers[key]) { map.removeLayer(mapLayers[key]); delete mapLayers[key]; }
}

async function trackOrder(id) {
  trackedOrderId = id;
  clearInterval(trackTimer);
  await refreshTracking(true);
  trackTimer = setInterval(() => refreshTracking(false), 10000);
}

async function refreshTracking(fit) {
  if (!trackedOrderId || !map) return;
  try {
    const d = await api.get('/maps/courier/' + trackedOrderId);
    const dest = d.destination, cp = d.courier_pos;
    const live = ['on_delivery', 'returning'].includes(d.order_status);
    const pts = [STORE_POS];

    if (dest.lat != null) { setMarker('home', [dest.lat, dest.lng], '📍', 'Alamat pengantaran'); pts.push([dest.lat, dest.lng]); }
    else removeLayer('home');

    if (live && cp.lat != null) { setMarker('courier', [cp.lat, cp.lng], '🛵', 'Kurir ' + d.courier_name); pts.push([cp.lat, cp.lng]); }
    else removeLayer('courier');

    let dist = '—', eta = '—';
    removeLayer('route');
    if (live && cp.lat != null && dest.lat != null) {
      try {
        const r = await api.get(`/maps/route?from_lat=${cp.lat}&from_lng=${cp.lng}&to_lat=${dest.lat}&to_lng=${dest.lng}`);
        dist = r.distance_km + ' km'; eta = '~' + r.duration_min + ' menit';
        mapLayers.route = L.geoJSON(r.geometry, { style: { color: '#7C3AED', weight: 5, opacity: 0.8 } }).addTo(map);
      } catch { /* rute opsional */ }
    }
    $('mapDist').textContent = dist;
    $('mapEta').textContent = eta;
    $('mapStatus').textContent = (ORDER_STATUS[d.order_status] || {}).label || d.order_status;
    $('mapCourier').textContent = d.courier_name || '—';
    if (fit && pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
  } catch (e) {
    if (fit) toast(e.message, 'error');
  }
}

/* ══════ LIVE CHAT ══════ */
const myRoom = () => `user_${Session.user.id}`;

function startChat() {
  loadChat();
  chatTimer = setInterval(loadChat, 5000);
}

async function loadChat() {
  try {
    const { messages } = await api.get(`/chat/${myRoom()}/messages`);
    if (messages.length === chatCount) return;
    chatCount = messages.length;
    const box = $('chatMsgs');
    box.innerHTML = bubble('Halo kak! 👋 Selamat datang di Void Play Box. Ada yang bisa kami bantu hari ini?', 'theirs', '')
      + messages.map(m => bubble(m.message, m.sender_role === 'admin' ? 'theirs' : 'mine', fmtTime(m.created_at))).join('');
    box.scrollTop = box.scrollHeight;
  } catch { /* abaikan, coba lagi pada polling berikutnya */ }
}

async function sendChat() {
  const inp = $('chatIn'), txt = inp.value.trim();
  if (!txt) return;
  inp.value = '';
  try {
    await api.post(`/chat/${myRoom()}/messages`, { message: txt });
    loadChat();
  } catch (e) { toast(e.message, 'error'); }
}
function sendQuick(txt) { $('chatIn').value = txt; sendChat(); }
