/* admin.js — panel admin: dashboard, pesanan, inventaris, kurir, chat */
let adminOrders = [], adminInv = [], adminCouriers = [], orderFilter = '';
let admRoom = null, adminTimer = null;

const COUR_BG = [
  'linear-gradient(135deg,#F59E0B,#FBBF24)', 'linear-gradient(135deg,#10B981,#34D399)',
  'linear-gradient(135deg,#3B82F6,#60A5FA)', 'linear-gradient(135deg,#EC4899,#F472B6)',
];
const INV_STATUS = {
  rented: { cls: 'avail-few', txt: 'Sedang Disewa' },
  available: { cls: 'avail-yes', txt: 'Tersedia' },
  maintenance: { cls: 'avail-no', txt: 'Maintenance' },
};
const PS_OPTIONS = [{ value: 'ps4_slim', label: 'PS4 Slim' }, { value: 'ps4_pro', label: 'PS4 Pro' }, { value: 'ps5', label: 'PS5' }];
const COND_OPTIONS = ['excellent', 'good', 'fair', 'poor'].map(v => ({ value: v, label: v }));

async function enterAdmin() {
  const s = $('adminScreen');
  s.classList.add('active'); s.style.display = 'flex';
  await Promise.all([loadOrders(), loadInventory(), loadCouriers()]);
  await loadStats();
  loadRooms();
  adminTimer = setInterval(refreshAdmin, 15000);
  toast('Dashboard Admin siap 🛡️', 'success');
}

function stopAdminPolling() { clearInterval(adminTimer); admRoom = null; }

async function refreshAdmin() {
  await Promise.all([loadOrders(), loadStats(), loadRooms()]);
  if (admRoom) loadAdminChat();
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
    $('kpiSub3').textContent = totalUnits ? `${Math.round(s.inventory_rented / totalUnits * 100)}% utilisasi` : '—';
    $('kpiRating').textContent = s.avg_rating;
    $('kpiSub4').textContent = 'dari ulasan pelanggan';

    // 7 hari terakhir (isi hari kosong dengan 0)
    const byDay = Object.fromEntries(revenue7.map(r => [r.day, r.total]));
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
  el.innerHTML = `<div style="position:absolute;top:0;left:0;right:0;bottom:24px;display:flex;align-items:flex-end;gap:8px;padding:16px 0 0">
    ${vals.map((v, i) => `<div class="chart-bar-wrap">
      <div class="chart-bar" data-val="${fmt(v)}" style="height:${Math.max(v / max * 100, 3)}%${grad ? ';background:' + grad : ''}"></div>
      <div class="chart-lbl">${labels[i]}</div></div>`).join('')}</div>`;
}

/* ══════ PESANAN ══════ */
async function loadOrders() {
  try { adminOrders = (await api.get('/orders?limit=100')).orders; }
  catch (e) { return toast(e.message, 'error'); }
  $('orderBadge').textContent = adminOrders.filter(o => o.status === 'pending').length;
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
      <td><span class="td-id">#${esc(o.order_code)}</span></td>
      <td>${esc(o.user_name)}</td><td>${esc(o.package_name)}</td>
      <td style="font-weight:600">${rupiah(o.total)}</td>
      <td>${statusPill(o.status)}</td><td>${esc(o.courier_name || '—')}</td>
      <td>
        <select class="form-ctrl" style="width:auto;padding:6px 10px;font-size:12px" onchange="changeStatus(${o.id},this.value)">${opts(o.status)}</select>
        <button class="action-btn action-view" onclick="viewOrder(${o.id})">Detail</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Belum ada pesanan</td></tr>';
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
    openForm({
      title: '#' + o.order_code,
      html: `<div style="font-size:14px;line-height:1.8">
        👤 ${esc(o.user_name)} · ${esc(o.user_phone || '—')}<br>
        📦 ${esc(o.package_name)} · ${rupiah(o.total)} (${esc(o.payment_method.toUpperCase())}, ${esc(o.payment_status)})<br>
        📍 ${esc(o.delivery_address)}<br>📝 ${esc(o.notes || '—')}</div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--pu5);font-size:13px">
        ${tracking.map(t => `<div style="padding:5px 0">🕒 ${fmtTime(t.created_at)} · ${esc(t.message)}</div>`).join('')}</div>`,
    });
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════ INVENTARIS ══════ */
async function loadInventory() {
  try { adminInv = (await api.get('/inventory')).inventory; } catch (e) { return toast(e.message, 'error'); }
  const n = k => adminInv.filter(u => u.status === k).length;
  $('invSummary').textContent = `${adminInv.length} unit total · ${n('rented')} disewa · ${n('available')} tersedia`;
  $('invGrid').innerHTML = adminInv.map(u => `
    <div class="inv-card">
      <div class="inv-img">${PS_ICON[u.ps_type] || '🎮'}</div>
      <div class="inv-name">${esc(u.name)}</div>
      <div style="font-size:12px;color:var(--muted)">${esc(u.serial_no)} · kondisi ${esc(u.condition)}</div>
      <div class="inv-status-row"><span class="inv-avail ${INV_STATUS[u.status].cls}">${INV_STATUS[u.status].txt}</span></div>
      <button class="btn-sm w-full mt-2" onclick="editInventory(${u.id})">Edit</button>
    </div>`).join('');
}

function addInventory() {
  openForm({
    title: 'Tambah Unit PS',
    fields: [
      { name: 'serial_no', label: 'Nomor Seri', placeholder: 'PBX-PS5-003' },
      { name: 'ps_type', label: 'Tipe', options: PS_OPTIONS },
      { name: 'name', label: 'Nama Unit', placeholder: 'PS5 - Unit 03' },
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
      <div class="cour-av" style="background:${COUR_BG[i % COUR_BG.length]}">🛵</div>
      <div class="cour-info">
        <div class="cour-name">${esc(c.name)}</div>
        <div class="cour-sub">${esc(c.phone)}</div>
        <div class="cour-sub" style="margin-top:4px">${c.status === 'active'
          ? '<span style="color:#10B981;font-weight:600">● Aktif</span>'
          : `<span style="color:var(--muted)">○ ${c.status === 'off' ? 'Off' : 'Nonaktif'}</span>`}</div>
        <div class="cour-stats">
          <div class="cour-stat"><div class="cour-stat-v">${c.total_deliver}</div><div class="cour-stat-l">Antar</div></div>
          <div class="cour-stat"><div class="cour-stat-v">${c.rating}</div><div class="cour-stat-l">Rating</div></div>
        </div>
      </div>
      <button class="btn-sm" onclick="editCourier(${c.id})">Detail</button>
    </div>`).join('');
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
      options: [{ value: 'active', label: 'Aktif' }, { value: 'off', label: 'Off' }, { value: 'inactive', label: 'Nonaktif' }] }],
    onSubmit: async d => { await api.put('/couriers/' + id, d); toast('Kurir diperbarui', 'success'); await loadCouriers(); },
  });
}

/* ══════ CHAT ADMIN ══════ */
async function loadRooms() {
  try {
    const { rooms } = await api.get('/chat/rooms');
    const unread = rooms.reduce((a, r) => a + (r.unread || 0), 0);
    const badge = $('chatBadge');
    badge.textContent = unread; badge.style.display = unread ? '' : 'none';
    $('admRooms').innerHTML = rooms.map(r => `
      <div class="chat-item${r.room_id === admRoom ? ' active' : ''}" onclick="openRoom('${esc(r.room_id)}')">
        <div class="chat-av" style="background:linear-gradient(135deg,#7C3AED,#A855F7)">👤</div>
        <div style="flex:1;min-width:0"><div class="chat-item-name">${esc(r.user_name || r.room_id)}</div>
        <div class="chat-item-prev">${esc(r.last_message || '')}</div></div>
        ${r.unread ? `<div class="chat-unread">${r.unread}</div>` : ''}
      </div>`).join('') || '<p style="padding:16px;color:var(--muted);font-size:13px">Belum ada percakapan</p>';
  } catch { /* abaikan */ }
}

function openRoom(id) {
  admRoom = id;
  $('admChatHead').textContent = id;
  loadAdminChat();
  loadRooms();
}

async function loadAdminChat() {
  if (!admRoom) return;
  try {
    const { messages } = await api.get(`/chat/${admRoom}/messages`);
    const box = $('admChatMsgs');
    box.innerHTML = messages.map(m => bubble(m.message, m.sender_role === 'admin' ? 'mine' : 'theirs', fmtTime(m.created_at))).join('');
    box.scrollTop = box.scrollHeight;
    if (messages[0]) $('admChatHead').textContent = (messages.find(m => m.sender_role === 'user') || messages[0]).sender_name;
  } catch (e) { toast(e.message, 'error'); }
}

async function sendAdminChat() {
  const inp = $('admChatIn'), txt = inp.value.trim();
  if (!txt || !admRoom) return;
  inp.value = '';
  try { await api.post(`/chat/${admRoom}/messages`, { message: txt }); loadAdminChat(); }
  catch (e) { toast(e.message, 'error'); }
}
