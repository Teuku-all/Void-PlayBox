/* Delivery maps and an explicit, one-time location selection shared with booking. */
let map = null, mapLayers = {}, bookingMap = null, bookingPin = null, bookingAccuracy = null;
let deliveryLocation = null, locationBusy = false, locationEpoch = 0, trackingEpoch = 0;
let adminOrderMap = null;
const EDITABLE_LOCATION_STATUSES = ['pending', 'confirmed', 'preparing'];

function validMapPoint(lat, lng) {
  return [lat, lng].every(v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v)))
    && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}

function mapIcon(kind) {
  const symbols = { store: 'box', home: 'home', self: 'map-pin', courier: 'truck' };
  return L.divIcon({ className: 'delivery-pin-icon', html: `<span class="delivery-pin delivery-pin-${kind}"><span>${icon(symbols[kind] || 'map-pin')}</span></span>`, iconSize: [38, 44], iconAnchor: [19, 42], tooltipAnchor: [0, -38] });
}

function addMapTiles(instance, onError) {
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
  if (onError) tiles.on('tileerror', onError);
  return tiles;
}

function initMap() {
  if (map) { map.invalidateSize(); return; }
  if (!window.L) { $('mapNotice').textContent = 'Peta belum bisa dimuat. Muat ulang halaman atau lanjutkan dengan alamat tertulis.'; return; }
  map = L.map('map', { scrollWheelZoom: false, zoomControl: false }).setView(STORE_POS, 13);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  addMapTiles(map, () => { $('mapNotice').textContent = 'Gambar peta belum bisa dimuat. Periksa koneksi; alamat dan titik pesanan tetap tersimpan.'; });
  setMarker('store', STORE_POS, 'store', 'Void Play Box · Toko');
  if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe($('map'));
}

function setMarker(key, pos, kind, label) {
  if (!map) return;
  if (mapLayers[key]) return mapLayers[key].setLatLng(pos);
  mapLayers[key] = L.marker(pos, { icon: mapIcon(kind) }).addTo(map).bindTooltip(label);
}

function removeLayer(key) {
  if (mapLayers[key]) { map?.removeLayer(mapLayers[key]); delete mapLayers[key]; }
}

function fitDeliveryMap() {
  if (!map) return;
  const points = Object.values(mapLayers).filter(layer => typeof layer.getLatLng === 'function' && !(layer instanceof L.Circle)).map(layer => layer.getLatLng());
  if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
}

function initBookingMap() {
  requestAnimationFrame(() => {
    if (!$('bookingPanel').classList.contains('open')) return;
    if (!window.L) { $('bookingLocationStatus').textContent = 'Peta belum tersedia. Kamu tetap bisa mengisi alamat secara manual.'; return; }
    if (!bookingMap) {
      bookingMap = L.map('bookingMap', { scrollWheelZoom: false }).setView(deliveryLocation ? [deliveryLocation.lat, deliveryLocation.lng] : STORE_POS, deliveryLocation ? 16 : 13);
      addMapTiles(bookingMap);
      bookingMap.on('click', e => chooseDeliveryPoint(e.latlng.lat, e.latlng.lng));
      if (window.ResizeObserver) new ResizeObserver(() => bookingMap.invalidateSize()).observe($('bookingMap'));
    }
    bookingMap.invalidateSize();
    renderSelectedPoint();
    if (deliveryLocation) bookingMap.setView([deliveryLocation.lat, deliveryLocation.lng], 16, { animate: false });
  });
}

function locationStatus(message) {
  $('mapLocationStatus').textContent = message;
  $('bookingLocationStatus').textContent = message;
}

function updateLocationUI() {
  for (const id of ['locateMapBtn', 'locateBookingBtn']) {
    $(id).disabled = locationBusy;
    $(id).innerHTML = icon(locationBusy ? 'refresh-cw' : 'map-pin') + (locationBusy ? ' Mencari lokasi…' : ' Gunakan lokasi saya');
  }
  const point = deliveryLocation;
  const coords = point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : '';
  $('mapLocationDetails').hidden = !point;
  $('mapLocationCoords').textContent = coords;
  $('mapLocationAddress').textContent = point?.address || 'Alamat tetap bisa dilengkapi saat booking.';
  $('bookingLocationCoords').textContent = coords || 'Belum ada titik dipilih';
  $('clearBookingLocationBtn').hidden = !point;
  const order = myOrders.find(o => o.id === trackedOrderId);
  const editable = order && EDITABLE_LOCATION_STATUSES.includes(order.status);
  $('saveLocationBtn').hidden = !(point && editable);
  $('saveLocationHint').textContent = editable
    ? 'Simpan titik untuk pesanan #' + order.order_code + '. Pastikan titik ini adalah tujuan pengantaran.'
    : order ? 'Tujuan pesanan ini sudah dikunci. Hubungi admin untuk perubahan; titik pilihan tetap bisa dipakai untuk booking baru.'
      : 'Titik pilihan bisa digunakan untuk booking baru.';
}

function renderSelectedPoint() {
  updateLocationUI();
  removeLayer('self'); removeLayer('accuracy');
  if (bookingPin) { bookingMap.removeLayer(bookingPin); bookingPin = null; }
  if (bookingAccuracy) { bookingMap.removeLayer(bookingAccuracy); bookingAccuracy = null; }
  if (!deliveryLocation || !window.L) return;
  const { lat, lng, accuracy } = deliveryLocation, pos = [lat, lng];
  setMarker('self', pos, 'self', 'Lokasi pilihan saya');
  if (map && accuracy) mapLayers.accuracy = L.circle(pos, { radius: accuracy, color: '#3178d4', weight: 1, fillOpacity: .09, interactive: false }).addTo(map);
  if (bookingMap) {
    bookingPin = L.marker(pos, { icon: mapIcon('self'), draggable: true, autoPan: true }).addTo(bookingMap).bindTooltip('Geser untuk menyesuaikan tujuan');
    bookingPin.on('dragend', () => { const p = bookingPin.getLatLng(); chooseDeliveryPoint(p.lat, p.lng); });
    if (accuracy) bookingAccuracy = L.circle(pos, { radius: accuracy, color: '#3178d4', weight: 1, fillOpacity: .09, interactive: false }).addTo(bookingMap);
  }
}

async function chooseDeliveryPoint(lat, lng, accuracy = null) {
  if (!validMapPoint(lat, lng)) return;
  const epoch = ++locationEpoch;
  locationBusy = false;
  deliveryLocation = { lat: Number(lat), lng: Number(lng), accuracy, address: '' };
  renderSelectedPoint();
  const accuracyLabel = accuracy ? ` Perkiraan akurasi ±${Math.round(accuracy)} m.` : '';
  locationStatus('Titik dipilih.' + accuracyLabel + (accuracy > 100 ? ' GPS masih kurang presisi; sesuaikan pin di peta booking.' : ' Pastikan pin sesuai tujuan pengantaran.'));
  try {
    const result = await api.get(`/maps/reverse?lat=${lat}&lng=${lng}`);
    if (epoch !== locationEpoch || !deliveryLocation) return;
    deliveryLocation.address = result.display_name || '';
    // Never replace an address that the user has already typed.
    if (!$('bAddr').value.trim() && result.display_name) $('bAddr').value = result.display_name;
    updateLocationUI();
  } catch { /* The coordinates remain usable without reverse geocoding. */ }
}

async function locateMe(target) {
  if (locationBusy) return;
  if (!window.isSecureContext) { locationStatus('Lokasi perangkat memerlukan HTTPS. Buka situs melalui koneksi HTTPS, atau pilih titik di peta booking.'); return; }
  if (!navigator.geolocation) { locationStatus('Perangkat ini belum mendukung GPS browser. Pilih titik di peta booking atau isi alamat lengkap.'); return; }
  locationBusy = true;
  const epoch = ++locationEpoch;
  updateLocationUI();
  locationStatus('Mencari lokasi perangkat. Izinkan akses lokasi pada browser jika diminta.');
  try {
    const result = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
    if (epoch !== locationEpoch) return;
    const { latitude: lat, longitude: lng, accuracy } = result.coords;
    if (!validMapPoint(lat, lng)) throw { code: 2 };
    // Select immediately; an unavailable address service must not block the GPS point.
    chooseDeliveryPoint(lat, lng, accuracy);
    if (target === 'booking') { initBookingMap(); bookingMap?.setView([lat, lng], 16, { animate: false }); }
    else { initMap(); map?.setView([lat, lng], 16, { animate: false }); }
  } catch (error) {
    if (epoch !== locationEpoch) return;
    const messages = { 1: 'Izin lokasi ditolak. Aktifkan izin lokasi di browser, atau pilih titik di peta booking.', 2: 'Lokasi belum ditemukan. Aktifkan GPS perangkat, lalu coba lagi atau pilih titik di peta booking.', 3: 'Pencarian lokasi terlalu lama. Coba lagi di area dengan sinyal GPS lebih baik, atau pilih titik di peta booking.' };
    locationStatus(messages[error.code] || 'Lokasi belum bisa diambil. Coba lagi atau isi alamat secara manual.');
  } finally {
    if (epoch === locationEpoch) { locationBusy = false; updateLocationUI(); }
  }
}

function clearDeliveryLocation() {
  ++locationEpoch; locationBusy = false; deliveryLocation = null;
  renderSelectedPoint();
  locationStatus('Belum ada titik dipilih. Gunakan lokasi saya atau pilih titik pada peta booking.');
}

async function saveOrderLocation() {
  const order = myOrders.find(o => o.id === trackedOrderId);
  if (!deliveryLocation || !order || !EDITABLE_LOCATION_STATUSES.includes(order.status)) return;
  const { lat, lng } = deliveryLocation;
  const btn = $('saveLocationBtn'); btn.disabled = true; btn.textContent = 'Menyimpan titik…';
  try {
    const result = await api.put(`/orders/${order.id}/location`, { delivery_lat: lat, delivery_lng: lng });
    Object.assign(order, result.order);
    locationStatus('Titik tujuan tersimpan di pesanan #' + order.order_code + ' dan bisa dilihat admin.');
    if (trackedOrderId === order.id) await refreshTracking(true);
    toast('Titik pengantaran berhasil disimpan.', 'success');
  } catch (error) { locationStatus(error.message); }
  finally { btn.disabled = false; btn.textContent = 'Simpan titik ke pesanan'; }
}

function resetTrackingMap() {
  ++trackingEpoch; clearInterval(trackTimer); trackedOrderId = null;
  for (const key of ['home', 'courier', 'route']) removeLayer(key);
  for (const id of ['mapDist', 'mapEta', 'mapStatus', 'mapCourier']) $(id).textContent = '—';
  $('mapUpdate').textContent = 'Peta area Banda Aceh';
  $('mapNotice').textContent = 'Pilih pesanan untuk melihat tujuan dan posisi kurir.';
}

function resetLocationSession() {
  clearDeliveryLocation(); resetTrackingMap();
  $('bAddr').value = ''; $('bName').value = ''; $('bPhone').value = '';
  closeBooking();
  map?.setView(STORE_POS, 13); bookingMap?.setView(STORE_POS, 13);
}

async function trackOrder(id) {
  if (!Number.isInteger(id) || id <= 0) return;
  trackedOrderId = id; clearInterval(trackTimer);
  updateLocationUI();
  for (const key of ['home', 'courier', 'route']) removeLayer(key);
  await refreshTracking(true);
  if (trackedOrderId === id) trackTimer = setInterval(() => refreshTracking(false), 10000);
}

async function refreshTracking(fit) {
  if (!trackedOrderId || !map) return;
  const orderId = trackedOrderId, epoch = ++trackingEpoch;
  const current = () => trackedOrderId === orderId && trackingEpoch === epoch;
  try {
    const d = await api.get('/maps/courier/' + orderId);
    if (!current()) return;
    const dest = d.destination || {}, cp = d.courier_pos || {};
    const hasDest = validMapPoint(dest.lat, dest.lng);
    const live = ['on_delivery', 'returning'].includes(d.order_status);
    const hasCourier = live && validMapPoint(cp.lat, cp.lng);
    const order = myOrders.find(o => o.id === orderId);
    if (order) order.status = d.order_status;
    updateLocationUI();
    if (hasDest) setMarker('home', [dest.lat, dest.lng], 'home', 'Tujuan pengantaran · tersimpan');
    else removeLayer('home');
    if (hasCourier) setMarker('courier', [cp.lat, cp.lng], 'courier', 'Kurir ' + (d.courier_name || ''));
    else removeLayer('courier');
    removeLayer('route');
    $('mapDist').textContent = '—'; $('mapEta').textContent = '—';
    $('mapStatus').textContent = (ORDER_STATUS[d.order_status] || {}).label || d.order_status;
    $('mapCourier').textContent = d.courier_name || 'Belum ditugaskan';
    $('mapUpdate').textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' });
    $('mapNotice').textContent = !hasDest ? 'Titik tujuan belum ditambahkan. Gunakan lokasi saya untuk melengkapinya, atau hubungi admin.'
      : !live ? 'Titik tujuan tersimpan. Posisi kurir muncul saat pengantaran atau penjemputan berlangsung.'
        : !hasCourier ? 'Menunggu pembaruan lokasi kurir. Titik tujuan tetap tersedia di peta.'
          : 'Posisi kurir diperiksa setiap 10 detik. Estimasi mengikuti rute jalan dan bukan jaminan waktu tiba.';
    if (fit) fitDeliveryMap();
    if (hasDest && hasCourier) {
      try {
        const r = await api.get(`/maps/route?from_lat=${cp.lat}&from_lng=${cp.lng}&to_lat=${dest.lat}&to_lng=${dest.lng}`);
        if (!current()) return;
        mapLayers.route = L.geoJSON(r.geometry, { style: { color: '#8050bd', weight: 5, opacity: .85 } }).addTo(map);
        $('mapDist').textContent = r.distance_km + ' km'; $('mapEta').textContent = '~' + r.duration_min + ' menit';
      } catch { if (current()) $('mapNotice').textContent = 'Rute belum bisa dihitung. Lokasi kurir dan tujuan tetap ditampilkan.'; }
    }
  } catch (error) {
    if (!current()) return;
    $('mapUpdate').textContent = 'Gagal memperbarui';
    $('mapNotice').textContent = 'Data belum diperbarui. ' + error.message;
  }
}

function clearAdminOrderMap() {
  if (adminOrderMap) { adminOrderMap.remove(); adminOrderMap = null; }
}

function showAdminOrderMap(order) {
  clearAdminOrderMap();
  if (!window.L || !$('adminOrderMap') || !validMapPoint(order.delivery_lat, order.delivery_lng)) return;
  const pos = [Number(order.delivery_lat), Number(order.delivery_lng)];
  adminOrderMap = L.map('adminOrderMap', { scrollWheelZoom: false }).setView(pos, 16);
  addMapTiles(adminOrderMap);
  L.marker(pos, { icon: mapIcon('home') }).addTo(adminOrderMap).bindTooltip('Tujuan pengantaran');
  requestAnimationFrame(() => adminOrderMap?.invalidateSize());
}

async function copyCoordinates(lat, lng) {
  if (!validMapPoint(lat, lng)) return;
  try {
    await navigator.clipboard.writeText(`${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`);
    toast('Koordinat tujuan disalin.', 'success');
  } catch { toast('Koordinat belum bisa disalin. Salin angka yang tertera pada detail pesanan.', 'error'); }
}
