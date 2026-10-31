/* ui.js — helper tampilan: format, escape HTML, status, toast, modal form */
const $ = id => document.getElementById(id);
const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id');
const rupiahShort = n => n >= 1e6 ? 'Rp ' + (n / 1e6).toFixed(1) + 'jt' : rupiah(n);

// Shared outline icons. Only trusted paths are rendered; labels stay in the control text.
const ICON_PATHS = {
  gamepad: '<path d="M6 7h12a3 3 0 0 1 2.9 2.3l1 7a2.6 2.6 0 0 1-4.5 2.1L15 16H9l-2.4 2.4a2.6 2.6 0 0 1-4.5-2.1l1-7A3 3 0 0 1 6 7Z"/><path d="M7 10v5m-2.5-2.5h5M16 11h.01M19 14h.01"/>',
  package: '<path d="m3 7 9-4 9 4v10l-9 4-9-4Z"/><path d="m3 7 9 4 9-4M12 11v10M8 5l9 4"/>',
  box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4Z"/><path d="m3 7 9 4 9-4M12 11v10"/>',
  truck: '<path d="M3 6h11v12H3zM14 10h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  'map-pin': '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  'message-circle': '<path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 21l2.1-5.3A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 10h8m-8 4h5"/>',
  'book-open': '<path d="M12 5C9 3 5 3 3 4v16c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Zm0 0v16"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-up-right': '<path d="M6 18 18 6M6 6h12v12"/>',
  'external-link': '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  settings: '<path d="m10 3-1 3-3 1-3-1-1 4 2 2-1 3 2 3 3-1 2 2 4-1 1-3 3-1 1-4-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
  'credit-card': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'refresh-cw': '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  'log-out': '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m6-12 4 4-4 4m-7-4h11"/>',
  'bar-chart': '<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
  phone: '<path d="m6 3 4 5-3 3a17 17 0 0 0 6 6l3-3 5 4-2 3C10 23 1 14 3 5Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  navigation: '<path d="m21 3-6 18-4-8-8-4 18-6Z"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  home: '<path d="m3 10 9-7 9 7v10H14v-7h-4v7H3Z"/>',
  wrench: '<path d="M14 6a5 5 0 0 0-6 6l-5 5a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-4 3-3-3 3-4Z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z"/>'
};
function icon(name, className = '') {
  return `<svg class="icon ${esc(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ICON_PATHS.info}</svg>`;
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
});

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// SQLite menyimpan UTC "YYYY-MM-DD HH:MM:SS" → Date lokal
const parseDbDate = s => new Date(String(s).replace(' ', 'T') + 'Z');
const fmtTime = s => parseDbDate(s).toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' });

const PS_ICON = { ps4_slim: 'PS4 Slim', ps4_pro: 'PS4 Pro' };
const ORDER_STATUS = {
  pending: { label: 'Menunggu', pill: 'pill-pending', step: 5 },
  confirmed: { label: 'Dikonfirmasi', pill: 'pill-pending', step: 25 },
  preparing: { label: 'Disiapkan', pill: 'pill-pending', step: 50 },
  on_delivery: { label: 'Di jalan', pill: 'pill-moving', step: 75 },
  delivered: { label: 'Sudah tiba', pill: 'pill-done', step: 100 },
  active: { label: 'Sedang disewa', pill: 'pill-done', step: 100 },
  returning: { label: 'Penjemputan', pill: 'pill-moving', step: 100 },
  completed: { label: 'Selesai', pill: 'pill-done', step: 100 },
  cancelled: { label: 'Dibatalkan', pill: 'pill-cancelled', step: 0 },
};
const statusPill = s => {
  const m = ORDER_STATUS[s] || { label: s, pill: 'pill-pending' };
  return `<span class="track-pill ${m.pill}">${m.label}</span>`;
};

const bubble = (txt, side, time) =>
  `<div class="msg-row ${side}"><div class="msg-bubble">${esc(txt)}</div><div class="msg-time">${time || ''}</div></div>`;

/* ── Toast ── */
function toast(msg, type = '') {
  const d = document.createElement('div');
  d.className = 'toast-item' + (type ? ' ' + type : '');
  const mark = document.createElement('span');
  mark.innerHTML = icon(type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info');
  const text = document.createElement('span');
  text.textContent = msg;
  d.append(mark, text);
  $('toastContainer').appendChild(d);
  setTimeout(() => {
    d.style.cssText += 'opacity:0;transform:translateX(100%);transition:all .3s';
    setTimeout(() => d.remove(), 300);
  }, 3000);
}

/* ── Modal form generik (tambah/edit data admin, detail pesanan) ── */
function openForm({ title, fields = [], html = '', submitText = 'Simpan', onSubmit }) {
  clearAdminOrderMap();
  $('formTitle').textContent = title;
  $('formBody').innerHTML = fields.map(f => `
    <div class="form-group"><label class="form-label">${esc(f.label)}</label>
    ${f.options
      ? `<select class="form-ctrl" name="${f.name}">${f.options.map(o =>
          `<option value="${esc(o.value)}"${o.value == f.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`
      : `<input class="form-ctrl" name="${f.name}" value="${esc(f.value)}" placeholder="${esc(f.placeholder || '')}"/>`}
    </div>`).join('') + html;
  const btn = $('formSubmit');
  btn.style.display = onSubmit ? 'block' : 'none';
  btn.textContent = submitText;
  btn.onclick = async () => {
    const data = {};
    $('formBody').querySelectorAll('[name]').forEach(el => { data[el.name] = el.value.trim(); });
    try { await onSubmit(data); closeForm(); } catch (e) { toast(e.message, 'error'); }
  };
  $('formOv').classList.add('open');
}
function closeForm() { clearAdminOrderMap(); $('formOv').classList.remove('open'); }
