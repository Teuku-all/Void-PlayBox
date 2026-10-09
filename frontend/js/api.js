/* api.js — klien HTTP + penyimpanan sesi (JWT) */
const API_BASE = 'https://voidplaybox-backend.vercel.app/api';

const Session = {
  get token() { return localStorage.getItem('pbx_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('pbx_user')); } catch { return null; } },
  save(token, user) { localStorage.setItem('pbx_token', token); localStorage.setItem('pbx_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('pbx_token'); localStorage.removeItem('pbx_user'); },
};

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (Session.token) headers.Authorization = 'Bearer ' + Session.token;

  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Tidak bisa terhubung ke server. Pastikan backend berjalan.');
  }
  const json = await res.json().catch(() => ({}));

  // token kadaluarsa → kembali ke layar login
  if (res.status === 401 && Session.token) { Session.clear(); location.reload(); }
  if (!res.ok || json.success === false) throw new Error(json.message || 'Terjadi kesalahan.');
  return json.data || {};
}

const api = {
  get: p => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  put: (p, b) => request('PUT', p, b || {}),
  del: p => request('DELETE', p),
};
