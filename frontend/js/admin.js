/* admin.js — panel admin: dashboard, pesanan, inventaris, kurir, chat */
let adminOrders = [], adminInv = [], adminCouriers = [], orderFilter = '';
let admRoom = null, adminTimer = null, adminChatTimer = null, adminChatRequest = 0;

const COUR_BG = [
  '#e8eefb', '#e7f2ed', '#eef0f5', '#f4eee6',
];
const INV_STATUS = {
  rented: { cls: 'avail-few', txt: 'Sedang Disewa' },
  available: { cls: 'avail-yes', txt: 'Tersedia' },
  maintenance: { cls: 'avail-no', txt: 'Perawatan' },
};
const PS_OPTIONS = [{ value: 'ps4_slim', label: 'PS4 Slim' }, { value: 'ps4_pro', label: 'PS4 Pro' }];
const CONDITION_LABELS = { excellent: 'Sangat baik', good: 'Baik', fair: 'Cukup', poor: 'Perlu diperiksa' };
const COND_OPTIONS = Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }));

async function enterAdmin() {
  const s = $('adminScreen');
  s.classList.add('active'); s.style.display = 'flex';
  await Promise.all([loadOrders(), loadInventory(), loadCouriers()]);
  await loadStats();
  loadRooms();
  ChatNotifications.start();
  clearInterval(adminChatTimer);
  adminChatTimer = setInterval(() => { if (admRoom && ChatNotifications.active(admRoom)) loadAdminChat(); }, 5000);
  adminTimer = setInterval(refreshAdmin, 15000);
  toast('Panel admin siap', 'success');
}

function stopAdminPolling() { clearInterval(adminTimer); clearInterval(adminChatTimer); ++adminChatRequest; admRoom = null; }

async function refreshAdmin() {
  await Promise.all([loadOrders(), loadStats(), loadRooms()]);
}

/* ══════ DASHBOARD & LAPORAN ══════ */
async function loadStats() {
  try {
    const { stats: s, revenue7, monthlyOrders } = await api.get('/orders/stats');
    const totalUnits = adminInv.length;
    $('kpiOrders').textContent = s.orders_active;
    $('kpiSub1').textContent = `${s.orders_today} pesanan hari ini`;
    $('kpiRevenue').textContent = rupiahShort(s.revenue_month);
    $('kpiSub2').textContent = `Total ${rupiah(s.revenue_total)}`;
    $('kpiUnits').textContent = `${s.inventory_rented} / ${totalUnits}`;
    $('kpiSub3').textContent = totalUnits ? `${Math.round(s.inventory_rented / totalUnits * 100)}% unit sedang disewa` : 'Belum ada unit';
    $('kpiRating').textContent = s.avg_rating;
    $('kpiSub4').textContent = 'dari ulasan pelanggan';

    // 7 hari terakhir (isi hari kosong dengan 0)
    const byDay = Object.fromEntries(revenue7.map(r => [String(r.day).slice(0, 10), Number(r.total)]));
    const days = [...Array(7)].map((_, i) => new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10));
    renderBars($('revenueChart'), days.map(d => ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][new Date(d).getUTCDay()]),
      days.map(d => byDay[d] || 0), v => 'Rp' + Math.round(v / 1000) + 'rb');

    const byMonth = Object.fromEntries(monthlyOrders.map(m => [m.month, m.count]));
    renderBars($('monthChart'), ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
      [...Array(12)].map((_, i) => byMonth[String(i + 1).padStart(2, '0')] || 0), v => v,
      'linear-gradient(180deg,var(--pu4),var(--pu2))');

    $('summaryList').innerHTML = [
      ['Pendapatan Bulan Ini', rupiah(s.revenue_month)],
      ['Total Pendapatan', rupiah(s.revenue_total)],
      ['Unit Tersedia / Disewa', `${s.inventory_avail} / ${s.inventory_rented}`],
      ['Kurir Aktif', s.couriers_active],
    ].map(([l, v]) => `<div style="display:flex;justify-content:space-between;padding:14px;background:var(--pu6);border-radius:var(--r-sm)">
      <span style="font-size:14px">${l}</span><span style="font-weight:700;font-size:15px;color:var(--pu2)">${esc(v)}</span></div>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

function renderBars(el, labels, vals, fmt, grad) {
  const max = Math.max(...vals, 1);
  el.innerHTML = vals.every(v => !Number(v)) ? '<div class="admin-empty"><strong>Belum ada aktivitas</strong><p>Grafik muncul setelah ada transaksi.</p></div>' : `<div class="admin-bar-chart" style="grid-template-columns:repeat(${labels.length},minmax(0,1fr))">${vals.map((v, i) => `<div class="admin-bar-column"><span>${esc(fmt(v))}</span><div class="admin-data-bar" style="height:${Math.max(v / max * 130, 3)}px" title="${esc(labels[i] + ': ' + fmt(v))}"></div><small>${esc(labels[i])}</small></div>`).join('')}</div>`;
}

/* ══════ PESANAN ══════ */
async function loadOrders() {
  try { adminOrders = (await api.get('/orders?limit=100')).orders; }
  catch (e) { return toast(e.message, 'error'); }
  $('orderBadge').textContent = adminOrders.filter(o => o.status === 'pending').length;
  $('adminPendingCount').textContent = `${adminOrders.filter(o => o.status === 'pending').length} menunggu konfirmasi`;
  $('adminRecentOrders').innerHTML = adminOrders.slice(0, 5).map(o => `<button class="recent-order-row" onclick="viewOrder(${o.id})"><span class="recent-order-avatar">${esc((o.user_name || 'P').charAt(0))}</span><span><strong>${esc(o.user_name)}</strong><small>#${esc(o.order_code)} · ${esc(o.package_name)}</small></span><span class="recent-order-value">${rupiah(o.total)}${statusPill(o.status)}</span><span aria-hidden="true">${icon('arrow-up-right')}</span></button>`).join('') || '<div class="admin-empty"><strong>Belum ada pesanan</strong><p>Pesanan baru akan muncul di sini.</p></div>';
  renderOrders();
  renderPopular();
}

function filterTable(v) { orderFilter = v.toLowerCase(); renderOrders(); }

function renderOrders() {
  const rows = adminOrders.filter(o => !orderFilter
    || o.user_name.toLowerCase().includes(orderFilter) || o.order_code.toLowerCase().includes(orderFilter));
  const opts = cur => Object.entries(ORDER_STATUS)
    .map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v.label}</option>`).join('');
  $('ordersBody').innerHTML = rows.map(o => `
    <tr>
      <td data-label="ID pesanan"><span class="td-id">#${esc(o.order_code)}</span></td>
      <td data-label="Pelanggan">${esc(o.user_name)}<div class="order-location-badge">${icon('map-pin')}${validMapPoint(o.delivery_lat, o.delivery_lng) ? 'Titik tersimpan' : 'Belum ada titik'}</div></td><td data-label="Paket">${esc(o.package_name)}</td>
      <td data-label="Total" style="font-weight:600">${rupiah(o.total)}</td>
      <td data-label="Status">${statusPill(o.status)}</td><td data-label="Kurir">${esc(o.courier_name || 'Belum ditugaskan')}</td>
      <td data-label="Tindakan">
        <select class="form-ctrl" aria-label="Ubah status pesanan ${esc(o.order_code)}" style="width:auto;padding:6px 10px;font-size:12px" onchange="changeStatus(${o.id},this.value)">${opts(o.status)}</select>
        <button class="action-btn action-view" onclick="viewOrder(${o.id})">Detail ${icon('chevron-right')}</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" class="admin-empty">${orderFilter ? 'Tidak ada pesanan yang cocok.' : 'Belum ada pesanan.'}</td></tr>`;
}

function renderPopular() {
  const count = {};
  adminOrders.forEach(o => { count[o.package_name] = (count[o.package_name] || 0) + 1; });
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 4);
  $('popularPkgs').innerHTML = top.map(([name, n]) => {
    const pct = Math.round(n / adminOrders.length * 100);
    return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
      <span>${esc(name)}</span><span style="font-weight:700;color:var(--pu2)">${pct}%</span></div>
      <div style="height:6px;background:var(--pu5);border-radius:99px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:var(--pu2);border-radius:99px"></div></div></div>`;
  }).join('') || '<p style="color:var(--muted);font-size:13px">Belum ada data</p>';
}

async function changeStatus(id, status) {
  const o = adminOrders.find(x => x.id === id), body = { status };
  try {
    // otomatis pilih unit PS yang cocok & kurir aktif bila belum ditugaskan
    if (status === 'preparing' && !o.inventory_id) {
      const unit = adminInv.find(u => u.ps_type === o.ps_type && u.status === 'available');
      if (!unit) throw new Error('Tidak ada unit ' + o.ps_type + ' yang tersedia.');
      body.inventory_id = unit.id;
    }
    if (['on_delivery', 'returning'].includes(status) && !o.courier_id) {
      const c = adminCouriers.find(x => x.status === 'active');
      if (!c) throw new Error('Tidak ada kurir aktif.');
      body.courier_id = c.id;
    }
    await api.put(`/orders/${id}/status`, body);
    toast('Status pesanan diperbarui', 'success');
    await Promise.all([loadOrders(), loadInventory(), loadCouriers()]);
    loadStats();
  } catch (e) {
    toast(e.message, 'error');
    renderOrders(); // kembalikan dropdown ke status semula
  }
}

async function viewOrder(id) {
  try {
    const { order: o, tracking } = await api.get('/orders/' + id);
    const hasLocation = validMapPoint(o.delivery_lat, o.delivery_lng);
    const coords = hasLocation ? `${Number(o.delivery_lat).toFixed(6)}, ${Number(o.delivery_lng).toFixed(6)}` : '';
    openForm({
      title: '#' + o.order_code,
      html: `<div class="admin-order-summary">
        <div>${icon('users')}<span><small>Pelanggan</small><strong>${esc(o.user_name)}</strong><span>${esc(o.user_phone || 'Nomor belum tersedia')}</span></span></div>
        <div>${icon('package')}<span><small>Paket sewa</small><strong>${esc(o.package_name)}</strong><span>${rupiah(o.total)} · ${esc(o.payment_method.toUpperCase())} · ${esc(o.payment_status)}</span></span></div>
        <div>${icon('map-pin')}<span><small>Alamat pengiriman</small><strong>${esc(o.delivery_address)}</strong></span></div>
        ${o.notes ? `<div>${icon('info')}<span><small>Catatan pelanggan</small><span>${esc(o.notes)}</span></span></div>` : ''}</div>
        <div class="admin-location-card"><h4>Tujuan pengantaran</h4>
        ${hasLocation ? `<p>${coords}</p><div id="adminOrderMap" role="region" aria-label="Peta tujuan pengantaran pelanggan"></div><div class="admin-location-actions"><a class="btn-sm" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords)}" target="_blank" rel="noopener noreferrer">${icon('navigation')} Buka rute Maps</a><button type="button" class="btn-sm" onclick="copyCoordinates(${Number(o.delivery_lat)},${Number(o.delivery_lng)})">${icon('copy')} Salin koordinat</button></div>` : '<p>Belum ada titik tujuan. Gunakan alamat di atas atau minta pelanggan menambahkan titik pengiriman.</p>'}
        </div>
        <div class="admin-order-timeline">
        ${tracking.map(t => `<div>${icon('clock')}<span><time>${fmtTime(t.created_at)}</time>${esc(t.message)}</span></div>`).join('')}</div>`,
    });
    if (hasLocation) showAdminOrderMap(o);
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════ INVENTARIS ══════ */
async function loadInventory() {
  try { adminInv = (await api.get('/inventory')).inventory; } catch (e) { return toast(e.message, 'error'); }
  const n = k => adminInv.filter(u => u.status === k).length;
  $('invSummary').textContent = `${adminInv.length} unit total · ${n('rented')} disewa · ${n('available')} tersedia`;
  $('adminAvailableCount').textContent = `${n('available')} unit siap disewa`;
  $('invGrid').innerHTML = adminInv.map(u => `
    <div class="inv-card">
      <div class="inv-img">${icon('gamepad')}</div>
      <div class="inv-name">${esc(u.name)}</div>
      <div class="inv-description">${esc(u.serial_no)} · ${esc(CONDITION_LABELS[u.condition] || u.condition)}</div>
      <div class="inv-status-row"><span class="inv-avail ${INV_STATUS[u.status].cls}">${INV_STATUS[u.status].txt}</span></div>
      <button class="btn-sm w-full mt-2" onclick="editInventory(${u.id})">${icon('settings')} Kelola unit</button>
    </div>`).join('') || '<div class="admin-empty"><strong>Belum ada unit PS4</strong><p>Tambahkan unit untuk mulai mengelola inventaris.</p></div>';
}

function addInventory() {
  openForm({
    title: 'Tambah Unit PS',
    fields: [
      { name: 'serial_no', label: 'Nomor Seri', placeholder: 'PBX-PS4S-004' },
      { name: 'ps_type', label: 'Tipe', options: PS_OPTIONS },
      { name: 'name', label: 'Nama Unit', placeholder: 'PS4 Slim - Unit 04' },
      { name: 'condition', label: 'Kondisi', options: COND_OPTIONS, value: 'good' },
    ],
    onSubmit: async d => { await api.post('/inventory', d); toast('Unit ditambahkan', 'success'); await loadInventory(); loadStats(); },
  });
}

function editInventory(id) {
  const u = adminInv.find(x => x.id === id);
  openForm({
    title: 'Edit ' + u.name,
    fields: [
      { name: 'name', label: 'Nama Unit', value: u.name },
      { name: 'status', label: 'Status', value: u.status, options: Object.entries(INV_STATUS).map(([value, v]) => ({ value, label: v.txt })) },
      { name: 'condition', label: 'Kondisi', value: u.condition, options: COND_OPTIONS },
      { name: 'notes', label: 'Catatan', value: u.notes },
    ],
    onSubmit: async d => { await api.put('/inventory/' + id, d); toast('Unit diperbarui', 'success'); await loadInventory(); loadStats(); },
  });
}

/* ══════ KURIR ══════ */
async function loadCouriers() {
  try { adminCouriers = (await api.get('/couriers')).couriers; } catch (e) { return toast(e.message, 'error'); }
  $('courSummary').textContent = `${adminCouriers.filter(c => c.status === 'active').length} kurir aktif`;
  $('courierGrid').innerHTML = adminCouriers.map((c, i) => `
    <div class="cour-card">
      <div class="cour-av" style="background:${COUR_BG[i % COUR_BG.length]}">${icon('truck')}</div>
      <div class="cour-info">
        <div class="cour-name">${esc(c.name)}</div>
        <div class="cour-sub">${esc(c.phone)}</div>
        <div class="cour-sub" style="margin-top:4px">${c.status === 'active'
          ? '<span class="cour-status cour-status-active">Aktif</span>'
          : `<span class="cour-status">${c.status === 'off' ? 'Istirahat' : 'Nonaktif'}</span>`}</div>
        <div class="cour-stats">
          <div class="cour-stat"><div class="cour-stat-v">${c.total_deliver}</div><div class="cour-stat-l">Antar</div></div>
          <div class="cour-stat"><div class="cour-stat-v">${c.rating}</div><div class="cour-stat-l">Rating</div></div>
        </div>
      </div>
      <button class="btn-sm" onclick="editCourier(${c.id})">Detail</button>
    </div>`).join('') || '<div class="admin-empty"><strong>Belum ada kurir</strong><p>Tambahkan kurir untuk mengatur pengantaran.</p></div>';
}

const COUR_FIELDS = (c = {}) => [
  { name: 'name', label: 'Nama', value: c.name },
  { name: 'phone', label: 'Nomor HP', value: c.phone, placeholder: '08xx-xxxx-xxxx' },
  { name: 'email', label: 'Email', value: c.email },
];

function addCourier() {
  openForm({
    title: 'Tambah Kurir', fields: COUR_FIELDS(),
    onSubmit: async d => { await api.post('/couriers', d); toast('Kurir ditambahkan', 'success'); await loadCouriers(); },
  });
}

function editCourier(id) {
  const c = adminCouriers.find(x => x.id === id);
  openForm({
    title: 'Kurir — ' + c.name,
    fields: [...COUR_FIELDS(c), { name: 'status', label: 'Status', value: c.status,
      options: [{ value: 'active', label: 'Aktif' }, { value: 'off', label: 'Istirahat' }, { value: 'inactive', label: 'Nonaktif' }] }],
    onSubmit: async d => { await api.put('/couriers/' + id, d); toast('Kurir diperbarui', 'success'); await loadCouriers(); },
  });
}

/* ══════ CHAT ADMIN ══════ */
async function loadRooms() {
  const token = Session.token;
  try {
    const { rooms } = await api.get('/chat/rooms');
    if (token !== Session.token || Session.user?.role !== 'admin') return;
    const html = rooms.map(r => `
      <button type="button" class="chat-item${r.room_id === admRoom ? ' active' : ''}" data-room="${esc(r.room_id)}">
        <span class="chat-av room-avatar">${esc((r.user_name || 'P').charAt(0).toUpperCase())}</span>
        <span class="chat-room-text"><span class="chat-item-name">${esc(r.user_name || 'Pelanggan')}</span><span class="chat-item-prev">${esc(r.last_message || 'Belum ada pesan')}</span></span>
        ${r.unread ? `<span class="chat-unread">${r.unread}</span>` : ''}
      </button>`).join('') || '<div class="admin-empty"><strong>Belum ada percakapan</strong><p>Chat pelanggan akan muncul di sini.</p></div>';
    if ($('admRooms').innerHTML !== html) $('admRooms').innerHTML = html;
  } catch { /* Keep the previous list until the next successful refresh. */ }
}

function openRoom(id) {
  if (!/^user_\d+$/.test(id)) return;
  admRoom = id;
  $('admChatHead').textContent = 'Memuat percakapan...';
  $('admChatMsgs').dataset.messageIds = '';
  $('admChatMsgs').innerHTML = '<div class="chat-placeholder">Memuat pesan...</div>';
  $('admChatIn').disabled = false;
  $('adminSendBtn').disabled = false;
  loadAdminChat(); loadRooms();
}

async function loadAdminChat() {
  if (!admRoom || Session.user?.role !== 'admin') return;
  const room = admRoom, token = Session.token, request = ++adminChatRequest;
  try {
    const { messages } = await api.get(`/chat/${room}/messages`);
    if (room !== admRoom || token !== Session.token || request !== adminChatRequest) return;
    const box = $('admChatMsgs');
    const nearBottom = ChatNotifications.atBottom(box), first = !box.dataset.messageIds;
    const signature = messages.map(m => m.id).join(',');
    if (signature !== box.dataset.messageIds || first) {
      box.innerHTML = messages.map(m => bubble(m.message, m.sender_role === 'admin' ? 'mine' : 'theirs', fmtTime(m.created_at))).join('') || '<div class="chat-placeholder">Belum ada pesan di percakapan ini.</div>';
      box.dataset.messageIds = signature;
      if (nearBottom || first) box.scrollTop = box.scrollHeight;
    }
    $('admChatHead').textContent = messages.find(m => m.sender_role === 'user')?.sender_name || 'Pelanggan';
    await ChatNotifications.ack(room, messages, box);
  } catch { /* A visible conversation will retry on the next poll. */ }
}

async function sendAdminChat() {
  const inp = $('admChatIn'), txt = inp.value.trim(), room = admRoom;
  if (!txt || !room || $('adminSendBtn').disabled) return;
  $('adminSendBtn').disabled = true;
  try {
    await api.post(`/chat/${room}/messages`, { message: txt });
    if (admRoom === room) { inp.value = ''; await loadAdminChat(); }
  } catch (e) { toast(e.message, 'error'); }
  finally { $('adminSendBtn').disabled = false; }
}

document.addEventListener('DOMContentLoaded', () => {
  $('admRooms').addEventListener('click', event => { const room = event.target.closest('[data-room]'); if (room) openRoom(room.dataset.room); });
  $('admChatMsgs').addEventListener('scroll', () => { if (admRoom && ChatNotifications.atBottom($('admChatMsgs'))) loadAdminChat(); }, { passive: true });
});
