const { query } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');
const NOMINATIM_HEADERS = { 'User-Agent': 'PlayBox-Rental/1.0 (playbox@mail.id)', 'Accept-Language': 'id,en' };

async function geocode(req, res, next) {
  try {
    const { q, city = 'Banda Aceh' } = req.query;
    if (!q) return fail(res, 'Parameter q (alamat) wajib diisi.');
    const encoded = encodeURIComponent(`${q}, ${city}, Aceh, Indonesia`);
    const resp = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&countrycodes=id`, NOMINATIM_HEADERS);
    if (!resp.ok) return fail(res, 'Layanan pencarian alamat sedang bermasalah.', 502);
    const data = await resp.json();
    return ok(res, { results: data.map(r => ({ display_name: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon), type: r.type, importance: r.importance })) });
  } catch (err) { return next(err); }
}

async function reverseGeocode(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return fail(res, 'lat dan lng wajib diisi.');
    const resp = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json`, NOMINATIM_HEADERS);
    if (!resp.ok) return fail(res, 'Layanan pencarian alamat sedang bermasalah.', 502);
    const data = await resp.json();
    return ok(res, { display_name: data.display_name, address: data.address, lat: parseFloat(data.lat), lng: parseFloat(data.lon) });
  } catch (err) { return next(err); }
}

async function getRoute(req, res, next) {
  try {
    const { from_lat, from_lng, to_lat, to_lng } = req.query;
    const raw = [from_lat, from_lng, to_lat, to_lng];
    if (raw.some(v => v == null || String(v).trim() === '')) return fail(res, 'from_lat, from_lng, to_lat, to_lng wajib diisi.');
    const coords = raw.map(Number);
    if (coords.some(v => !Number.isFinite(v)) || Math.abs(coords[0]) > 90 || Math.abs(coords[2]) > 90 || Math.abs(coords[1]) > 180 || Math.abs(coords[3]) > 180) {
      return fail(res, 'Koordinat tidak valid.');
    }
    const [fromLat, fromLng, toLat, toLng] = coords;
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
    const resp = await fetchWithTimeout(url, { 'User-Agent': 'PlayBox-Rental/1.0' });
    if (!resp.ok) return fail(res, 'Layanan rute sedang bermasalah.', 502);
    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes?.length) return fail(res, 'Tidak bisa menghitung rute.');
    const route = data.routes[0];
    return ok(res, { distance_m: route.distance, distance_km: (route.distance / 1000).toFixed(2), duration_s: route.duration, duration_min: Math.ceil(route.duration / 60), geometry: route.geometry });
  } catch (err) { return next(err); }
}

async function getCourierLocation(req, res, next) {
  try {
    const result = await query(
      `SELECT o.id, o.user_id, o.status, o.delivery_lat, o.delivery_lng,
              c.name AS courier_name, c.phone AS courier_phone, c.current_lat AS courier_lat, c.current_lng AS courier_lng
       FROM orders o LEFT JOIN couriers c ON o.courier_id = c.id WHERE o.id = $1`,
      [req.params.orderId]
    );
    const order = result.rows[0];
    if (!order) return fail(res, 'Pesanan tidak ditemukan.', 404);
    if (req.user.role !== 'admin' && Number(order.user_id) !== Number(req.user.id)) return fail(res, 'Akses ditolak.', 403);
    return ok(res, {
      order_id: order.id,
      order_status: order.status,
      courier_name: order.courier_name,
      courier_phone: order.courier_phone,
      courier_pos: { lat: order.courier_lat, lng: order.courier_lng },
      destination: { lat: order.delivery_lat, lng: order.delivery_lng },
      store_pos: { lat: 5.5483, lng: 95.3238 }
    });
  } catch (err) { return next(err); }
}

async function updateCourierLocation(req, res, next) {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') return fail(res, 'lat dan lng wajib diisi.');
    const latitude = Number(lat), longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return fail(res, 'lat dan lng harus berupa koordinat yang valid.');
    const result = await query('UPDATE couriers SET current_lat = $1, current_lng = $2 WHERE id = $3 RETURNING id', [latitude, longitude, req.params.courierId]);
    if (!result.rows[0]) return fail(res, 'Kurir tidak ditemukan.', 404);
    return ok(res, {}, 'Posisi kurir diperbarui.');
  } catch (err) { return next(err); }
}

async function fetchWithTimeout(url, headers = {}, timeout = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, { headers, signal: ctrl.signal });
  } catch (err) {
    throw new Error(`Gagal menghubungi layanan maps: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}
module.exports = { geocode, reverseGeocode, getRoute, getCourierLocation, updateCourierLocation };
