/* ui.js — helper tampilan: format, escape HTML, status, toast, modal form */
const $ = id => document.getElementById(id);
const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id');
const rupiahShort = n => n >= 1e6 ? 'Rp ' + (n / 1e6).toFixed(1) + 'jt' : rupiah(n);

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// SQLite menyimpan UTC "YYYY-MM-DD HH:MM:SS" → Date lokal
const parseDbDate = s => new Date(String(s).replace(' ', 'T') + 'Z');
const fmtTime = s => parseDbDate(s).toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' });

const PS_ICON = { ps4_slim: '🎮', ps4_pro: '⭐', ps5: '🚀' };

const ORDER_STATUS = {
  pending:     { label: '⏳ Menunggu',       pill: 'pill-pending', step: 5 },
  confirmed:   { label: '✔️ Dikonfirmasi',   pill: 'pill-pending', step: 25 },
  preparing:   { label: '🔧 Disiapkan',      pill: 'pill-pending', step: 50 },
  on_delivery: { label: '🛵 Di Jalan',       pill: 'pill-moving',  step: 75 },
  delivered:   { label: '📦 Diantar',        pill: 'pill-done',    step: 100 },
  active:      { label: '🎮 Sedang Disewa',  pill: 'pill-done',    step: 100 },
  returning:   { label: '↩️ Penjemputan',    pill: 'pill-moving',  step: 100 },
  completed:   { label: '✅ Selesai',        pill: 'pill-done',    step: 100 },
  cancelled:   { label: '❌ Dibatalkan',     pill: 'pill-pending', step: 0 },
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
  const icon = document.createElement('span');
  icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  const text = document.createElement('span');
  text.textContent = msg;
  d.append(icon, text);
  $('toastContainer').appendChild(d);
  setTimeout(() => {
    d.style.cssText += 'opacity:0;transform:translateX(100%);transition:all .3s';
    setTimeout(() => d.remove(), 300);
  }, 3000);
}

/* ── Modal form generik (tambah/edit data admin, detail pesanan) ── */
function openForm({ title, fields = [], html = '', submitText = 'Simpan', onSubmit }) {
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
function closeForm() { $('formOv').classList.remove('open'); }
