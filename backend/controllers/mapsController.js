
/**
 * Maps Controller
 * Menggunakan OpenStreetMap Nominatim (geocoding) + OSRM (routing) — 100% GRATIS
 * Tidak perlu API key apapun!
 *
 * Service yang dipakai:
 * - Nominatim (nominatim.openstreetmap.org) → geocoding / reverse geocoding
 * - OSRM Demo Server (router.project-osrm.org) → route / jarak / durasi
 * - Di frontend: Leaflet.js + OpenStreetMap tiles
 */

const { getDb } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

// User-Agent wajib untuk Nominatim (syarat usage policy mereka)
const NOMINATIM_HEADERS = {
  'User-Agent': 'PlayBox-Rental/1.0 (playbox@mail.id)',
  'Accept-Language': 'id,en'
};

// ── Geocode: alamat → koordinat ───────────────────────────
async function geocode(req, res, next) {
  try {
    const { q, city = 'Banda Aceh' } = req.query;
    if (!q) return fail(res, 'Parameter q (alamat) wajib diisi.');

    const query = encodeURIComponent(`${q}, ${city}, Aceh, Indonesia`);
    const url   = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&countrycodes=id`;

    const resp = await fetchWithTimeout(url, NOMINATIM_HEADERS);
    const data = await resp.json();

    const results = data.map(r => ({
      display_name: r.display_name,
      lat:  parseFloat(r.lat),
      lng:  parseFloat(r.lon),
      type: r.type,
      importance: r.importance
    }));

    return ok(res, { results });
  } catch (err) { next(err); }
}

// ── Reverse Geocode: koordinat → alamat ──────────────────
async function reverseGeocode(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return fail(res, 'lat dan lng wajib diisi.');

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const resp = await fetchWithTimeout(url, NOMINATIM_HEADERS);
    const data = await resp.json();

    return ok(res, {
      display_name: data.display_name,
      address:      data.address,
      lat:          parseFloat(data.lat),
      lng:          parseFloat(data.lon)
    });
  } catch (err) { next(err); }
}

// ── Route: hitung jarak & durasi antara 2 titik (OSRM) ──
async function getRoute(req, res, next) {
  try {
    const { from_lat, from_lng, to_lat, to_lng } = req.query;
    const rawCoords = [from_lat, from_lng, to_lat, to_lng];
    if (rawCoords.some(value => value == null || String(value).trim() === '')) {
      return fail(res, 'from_lat, from_lng, to_lat, to_lng wajib diisi.');
    }
    const coords = rawCoords.map(Number);
    if (coords.some(value => !Number.isFinite(value)) ||
        Math.abs(coords[0]) > 90 || Math.abs(coords[2]) > 90 ||
        Math.abs(coords[1]) > 180 || Math.abs(coords[3]) > 180) {
      return fail(res, 'from_lat, from_lng, to_lat, to_lng wajib diisi.');
    }

    const [fromLat, fromLng, toLat, toLng] = coords;

    // OSRM public demo server — gratis, tidak perlu API key
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
    const resp = await fetchWithTimeout(url, { 'User-Agent': 'PlayBox-Rental/1.0' });
    const data = await resp.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      return fail(res, 'Tidak bisa menghitung rute.');
    }

    const route = data.routes[0];
    return ok(res, {
      distance_m:  route.distance,
      distance_km: (route.distance / 1000).toFixed(2),
      duration_s:  route.duration,
      duration_min: Math.ceil(route.duration / 60),
      geometry:    route.geometry  // GeoJSON untuk ditampilkan di Leaflet
    });
  } catch (err) { next(err); }
}

// ── Posisi kurir untuk order tertentu ────────────────────
function getCourierLocation(req, res, next) {
  try {
    const db = getDb();
    const order = db.prepare(`
      SELECT o.id, o.status, o.delivery_lat, o.delivery_lng,
             c.name AS courier_name, c.phone AS courier_phone,
             c.current_lat AS courier_lat, c.current_lng AS courier_lng
      FROM orders o
      LEFT JOIN couriers c ON o.courier_id = c.id
      WHERE o.id = ?
    `).get(req.params.orderId);

    if (!order) return fail(res, 'Pesanan tidak ditemukan.', 404);

    // Hak akses: user hanya bisa lihat pesanan sendiri
    if (req.user.role !== 'admin') {
      const own = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(req.params.orderId);
      if (!own || own.user_id !== req.user.id) return fail(res, 'Akses ditolak.', 403);
    }

    // Return the courier's latest saved GPS position without fabricating movement.
    const courierPos = { lat: order.courier_lat, lng: order.courier_lng };

    return ok(res, {
      order_id:      order.id,
      order_status:  order.status,
      courier_name:  order.courier_name,
      courier_phone: order.courier_phone,
      courier_pos:   courierPos,
      destination:   { lat: order.delivery_lat, lng: order.delivery_lng },
      store_pos:     { lat: 5.5483, lng: 95.3238 }  // PlayBox Store Banda Aceh
    });
  } catch (err) { next(err); }
}

// ── Update posisi kurir (bisa dari kurir / admin) ────────
function updateCourierLocation(req, res, next) {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') {
      return fail(res, 'lat dan lng wajib diisi.');
    }
    const latitude = Number(lat), longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return fail(res, 'lat dan lng harus berupa koordinat yang valid.');
    }

    const db = getDb();
    const { courierId } = req.params;
    const result = db.prepare('UPDATE couriers SET current_lat = ?, current_lng = ? WHERE id = ?').run(latitude, longitude, courierId);
    if (!result.changes) return fail(res, 'Kurir tidak ditemukan.', 404);
    return ok(res, {}, 'Posisi kurir diperbarui.');
  } catch (err) { next(err); }
}

// ── Helper: fetch dengan timeout ─────────────────────────
async function fetchWithTimeout(url, headers = {}, timeout = 8000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const resp = await fetch(url, { headers, signal: ctrl.signal });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`Gagal menghubungi layanan maps: ${err.message}`);
  }
}

module.exports = { geocode, reverseGeocode, getRoute, getCourierLocation, updateCourierLocation };
