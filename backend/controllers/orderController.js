
const { getDb } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

function genCode() {
  const d = new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PBX-${datePart}-${rand}`;
}

// ── Create Order ──────────────────────────────────────────
function create(req, res, next) {
  try {
    const { package_id, payment_method, delivery_address, delivery_lat, delivery_lng, notes } = req.body;
    if (!package_id || !payment_method || !delivery_address) {
      return fail(res, 'Paket, metode bayar, dan alamat wajib diisi.');
    }

    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND is_active = 1').get(package_id);
    if (!pkg) return fail(res, 'Paket tidak ditemukan.', 404);
    if (!['bca', 'gopay', 'ovo', 'dana', 'cod'].includes(payment_method)) {
      return fail(res, 'Metode pembayaran tidak valid.');
    }
    const available = db.prepare("SELECT COUNT(*) AS count FROM inventory WHERE ps_type = ? AND status = 'available'").get(pkg.ps_type).count;
    if (available < 1) return fail(res, 'Unit untuk paket ini sedang habis.', 409);

    const delivery_fee = 15000;
    const subtotal     = pkg.price;
    const total        = subtotal + delivery_fee;
    const order_code   = genCode();

    const result = db.prepare(`
      INSERT INTO orders
        (order_code, user_id, package_id, status, payment_method, payment_status,
         subtotal, delivery_fee, total, delivery_address, delivery_lat, delivery_lng, notes)
      VALUES (?, ?, ?, 'pending', ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?)
    `).run(order_code, req.user.id, package_id, payment_method, subtotal, delivery_fee, total,
           delivery_address, delivery_lat || null, delivery_lng || null, notes || null);

    // Tambah tracking awal
    db.prepare(`INSERT INTO order_tracking (order_id, status, message) VALUES (?, 'pending', 'Pesanan berhasil dibuat, menunggu konfirmasi admin.')`).run(result.lastInsertRowid);

    const order = db.prepare(`
      SELECT o.*, p.name AS package_name, p.ps_type, p.duration
      FROM orders o JOIN packages p ON o.package_id = p.id
      WHERE o.id = ?
    `).get(result.lastInsertRowid);

    return ok(res, { order }, 'Pesanan berhasil dibuat!', 201);
  } catch (err) { next(err); }
}

// ── Get My Orders (user) ──────────────────────────────────
function getMyOrders(req, res, next) {
  try {
    const db = getDb();
    const orders = db.prepare(`
      SELECT o.*, p.name AS package_name, p.ps_type, p.duration,
             c.name AS courier_name, c.phone AS courier_phone
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      LEFT JOIN couriers c ON o.courier_id = c.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);
    return ok(res, { orders });
  } catch (err) { next(err); }
}

// ── Get Order Detail ──────────────────────────────────────
function getOne(req, res, next) {
  try {
    const db = getDb();
    const order = db.prepare(`
      SELECT o.*, p.name AS package_name, p.ps_type, p.duration, p.features,
             c.name AS courier_name, c.phone AS courier_phone, c.current_lat, c.current_lng,
             u.name AS user_name, u.phone AS user_phone
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      LEFT JOIN couriers c ON o.courier_id = c.id
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(req.params.id);

    if (!order) return fail(res, 'Pesanan tidak ditemukan.', 404);

    // User hanya bisa lihat pesanan sendiri, admin bisa semua
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return fail(res, 'Akses ditolak.', 403);
    }

    const tracking = db.prepare('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
    return ok(res, { order: { ...order, features: JSON.parse(order.features || '[]') }, tracking });
  } catch (err) { next(err); }
}

// ── Get All Orders (admin) ────────────────────────────────
function getAll(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const offset = (page - 1) * limit;
    let sql = `
      SELECT o.*, p.name AS package_name, p.ps_type,
             u.name AS user_name, u.phone AS user_phone,
             c.name AS courier_name
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN couriers c ON o.courier_id = c.id
    `;
    const params = [];
    if (status) { sql += ' WHERE o.status = ?'; params.push(status); }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const orders = db.prepare(sql).all(...params);
    const total  = db.prepare(`SELECT COUNT(*) AS c FROM orders${status ? ' WHERE status = ?' : ''}`).get(...(status ? [status] : [])).c;

    return ok(res, { orders, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
}

// ── Update Order Status (admin) ───────────────────────────
function updateStatus(req, res, next) {
  try {
    const { status, courier_id, inventory_id, message } = req.body;
    const validStatuses = ['pending','confirmed','preparing','on_delivery','delivered','active','returning','completed','cancelled'];
    if (!validStatuses.includes(status)) return fail(res, 'Status tidak valid.');

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return fail(res, 'Pesanan tidak ditemukan.', 404);

    // Assign inventory jika status = preparing
    if (status === 'preparing' && inventory_id) {
      db.prepare("UPDATE inventory SET status = 'rented', updated_at = datetime('now') WHERE id = ?").run(inventory_id);
    }
    // Bebaskan inventory jika selesai
    if (status === 'completed' && order.inventory_id) {
      db.prepare("UPDATE inventory SET status = 'available', updated_at = datetime('now') WHERE id = ?").run(order.inventory_id);
    }
    if (status === 'cancelled' && order.inventory_id) {
      db.prepare("UPDATE inventory SET status = 'available', updated_at = datetime('now') WHERE id = ?").run(order.inventory_id);
    }

    // Payment auto-paid saat confirmed (kecuali COD)
    let payStatus = order.payment_status;
    if (status === 'confirmed' && order.payment_method !== 'cod') payStatus = 'paid';
    if (status === 'delivered' && order.payment_method === 'cod') payStatus = 'paid';

    db.prepare(`
      UPDATE orders SET status = ?, payment_status = ?,
        courier_id = COALESCE(?, courier_id),
        inventory_id = COALESCE(?, inventory_id),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, payStatus, courier_id || null, inventory_id || null, req.params.id);

    // Tambah tracking
    const trackMsg = message || statusMessages[status] || `Status diubah ke: ${status}`;
    db.prepare('INSERT INTO order_tracking (order_id, status, message) VALUES (?, ?, ?)').run(order.id, status, trackMsg);

    // Update total_deliver kurir jika completed
    if (status === 'completed' && (courier_id || order.courier_id)) {
      db.prepare('UPDATE couriers SET total_deliver = total_deliver + 1 WHERE id = ?').run(courier_id || order.courier_id);
    }

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    return ok(res, { order: updated }, 'Status pesanan diperbarui.');
  } catch (err) { next(err); }
}

// ── Cancel Order (user) ───────────────────────────────────
function cancelOrder(req, res, next) {
  try {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!order) return fail(res, 'Pesanan tidak ditemukan.', 404);
    if (!['pending','confirmed'].includes(order.status)) {
      return fail(res, 'Pesanan tidak bisa dibatalkan pada status ini.');
    }
    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(order.id);
    db.prepare("INSERT INTO order_tracking (order_id, status, message) VALUES (?, 'cancelled', 'Pesanan dibatalkan oleh pelanggan.')").run(order.id);
    return ok(res, {}, 'Pesanan berhasil dibatalkan.');
  } catch (err) { next(err); }
}

// ── Dashboard Stats (admin) ───────────────────────────────
function getStats(req, res, next) {
  try {
    const db = getDb();
    const stats = {
      orders_active:    db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status NOT IN ('completed','cancelled')").get().c,
      orders_today:     db.prepare("SELECT COUNT(*) AS c FROM orders WHERE date(created_at) = date('now')").get().c,
      revenue_month:    db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE payment_status='paid' AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')").get().s,
      revenue_total:    db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE payment_status='paid'").get().s,
      inventory_avail:  db.prepare("SELECT COUNT(*) AS c FROM inventory WHERE status='available'").get().c,
      inventory_rented: db.prepare("SELECT COUNT(*) AS c FROM inventory WHERE status='rented'").get().c,
      couriers_active:  db.prepare("SELECT COUNT(*) AS c FROM couriers WHERE status='active'").get().c,
      avg_rating:       db.prepare("SELECT ROUND(AVG(rating),1) AS r FROM reviews").get().r || 5.0,
    };

    // Revenue 7 hari terakhir
    const revenue7 = db.prepare(`
      SELECT date(created_at) AS day, SUM(total) AS total
      FROM orders WHERE payment_status='paid' AND created_at >= date('now','-6 days')
      GROUP BY day ORDER BY day ASC
    `).all();

    // Pesanan per bulan tahun ini
    const monthlyOrders = db.prepare(`
      SELECT strftime('%m',created_at) AS month, COUNT(*) AS count
      FROM orders WHERE strftime('%Y',created_at) = strftime('%Y','now')
      GROUP BY month ORDER BY month ASC
    `).all();

    return ok(res, { stats, revenue7, monthlyOrders });
  } catch (err) { next(err); }
}

const statusMessages = {
  confirmed:   'Pesanan dikonfirmasi oleh admin.',
  preparing:   'Unit PS sedang disiapkan dan dicek kelengkapannya.',
  on_delivery: 'Kurir sedang menuju lokasi pengiriman.',
  delivered:   'PS berhasil diantar. Selamat bermain!',
  active:      'Masa sewa sedang berjalan.',
  returning:   'Kurir sedang menjemput unit PS.',
  completed:   'Pesanan selesai. Terima kasih telah menggunakan Void Play Box!',
  cancelled:   'Pesanan dibatalkan.',
};

module.exports = { create, getMyOrders, getOne, getAll, updateStatus, cancelOrder, getStats };

