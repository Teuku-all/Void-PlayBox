const { query, withTransaction } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

function genCode() {
  const d = new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PBX-${datePart}-${rand}`;
}
function parseFeatures(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

async function create(req, res, next) {
  try {
    const { package_id, payment_method, delivery_address, delivery_lat, delivery_lng, notes } = req.body;
    if (!package_id || !payment_method || !delivery_address) return fail(res, 'Paket, metode bayar, dan alamat wajib diisi.');
    const packageResult = await query('SELECT * FROM packages WHERE id = $1 AND is_active = 1', [package_id]);
    const pkg = packageResult.rows[0];
    if (!pkg) return fail(res, 'Paket tidak ditemukan.', 404);
    if (!['qris', 'gopay', 'ovo', 'dana', 'cod'].includes(payment_method)) return fail(res, 'Metode pembayaran tidak valid.');
    const stock = await query("SELECT COUNT(*)::int AS count FROM inventory WHERE ps_type = $1 AND status = 'available'", [pkg.ps_type]);
    if (Number(stock.rows[0].count) < 1) return fail(res, 'Unit untuk paket ini sedang habis.', 409);
    const deliveryFee = 15000;
    const subtotal = Number(pkg.price);
    const orderCode = genCode();
    const order = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO orders (order_code, user_id, package_id, status, payment_method, payment_status,
          subtotal, delivery_fee, total, delivery_address, delivery_lat, delivery_lng, notes)
         VALUES ($1,$2,$3,'pending',$4,'unpaid',$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [orderCode, req.user.id, package_id, payment_method, subtotal, deliveryFee, subtotal + deliveryFee,
          delivery_address, delivery_lat ?? null, delivery_lng ?? null, notes || null]
      );
      const newOrder = inserted.rows[0];
      await client.query(
        `INSERT INTO order_tracking (order_id, status, message) VALUES ($1, 'pending', $2)`,
        [newOrder.id, 'Pesanan berhasil dibuat, menunggu konfirmasi admin.']
      );
      const joined = await client.query(
        `SELECT o.*, p.name AS package_name, p.ps_type, p.duration
         FROM orders o JOIN packages p ON o.package_id = p.id WHERE o.id = $1`, [newOrder.id]
      );
      return joined.rows[0];
    });
    return ok(res, { order }, 'Pesanan berhasil dibuat!', 201);
  } catch (err) { return next(err); }
}

async function getMyOrders(req, res, next) {
  try {
    const result = await query(
      `SELECT o.*, p.name AS package_name, p.ps_type, p.duration,
              c.name AS courier_name, c.phone AS courier_phone
       FROM orders o JOIN packages p ON o.package_id = p.id
       LEFT JOIN couriers c ON o.courier_id = c.id
       WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [req.user.id]
    );
    return ok(res, { orders: result.rows });
  } catch (err) { return next(err); }
}

async function getOne(req, res, next) {
  try {
    const result = await query(
      `SELECT o.*, p.name AS package_name, p.ps_type, p.duration, p.features,
              c.name AS courier_name, c.phone AS courier_phone, c.current_lat, c.current_lng,
              u.name AS user_name, u.phone AS user_phone
       FROM orders o JOIN packages p ON o.package_id = p.id
       LEFT JOIN couriers c ON o.courier_id = c.id
       JOIN users u ON o.user_id = u.id WHERE o.id = $1`, [req.params.id]
    );
    const order = result.rows[0];
    if (!order) return fail(res, 'Pesanan tidak ditemukan.', 404);
    if (req.user.role !== 'admin' && Number(order.user_id) !== Number(req.user.id)) return fail(res, 'Akses ditolak.', 403);
    const tracking = (await query('SELECT * FROM order_tracking WHERE order_id = $1 ORDER BY created_at ASC', [order.id])).rows;
    return ok(res, { order: { ...order, features: parseFeatures(order.features) }, tracking });
  } catch (err) { return next(err); }
}

async function getAll(req, res, next) {
  try {
    const status = req.query.status;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE o.status = $${params.length}`; }
    const rows = await query(
      `SELECT o.*, p.name AS package_name, p.ps_type,
              u.name AS user_name, u.phone AS user_phone, c.name AS courier_name
       FROM orders o JOIN packages p ON o.package_id = p.id
       JOIN users u ON o.user_id = u.id LEFT JOIN couriers c ON o.courier_id = c.id
       ${where} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const totals = await query(`SELECT COUNT(*)::int AS count FROM orders ${status ? 'WHERE status = $1' : ''}`, status ? [status] : []);
    return ok(res, { orders: rows.rows, pagination: { page, limit, total: Number(totals.rows[0].count) } });
  } catch (err) { return next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status, courier_id, inventory_id, message } = req.body;
    const validStatuses = ['pending','confirmed','preparing','on_delivery','delivered','active','returning','completed','cancelled'];
    if (!validStatuses.includes(status)) return fail(res, 'Status tidak valid.');

    const updated = await withTransaction(async (client) => {
      const got = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
      const order = got.rows[0];
      if (!order) return null;

      if (status === 'preparing' && inventory_id) {
        await client.query("UPDATE inventory SET status = 'rented', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [inventory_id]);
      }
      if ((status === 'completed' || status === 'cancelled') && order.inventory_id) {
        await client.query("UPDATE inventory SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [order.inventory_id]);
      }
      let payStatus = order.payment_status;
      if (status === 'confirmed' && order.payment_method !== 'cod') payStatus = 'paid';
      if (status === 'delivered' && order.payment_method === 'cod') payStatus = 'paid';
      const orderResult = await client.query(
        `UPDATE orders SET status = $1, payment_status = $2,
         courier_id = COALESCE($3, courier_id), inventory_id = COALESCE($4, inventory_id),
         updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`,
        [status, payStatus, courier_id || null, inventory_id || null, req.params.id]
      );
      const trackMsg = message || statusMessages[status] || `Status diubah ke: ${status}`;
      await client.query('INSERT INTO order_tracking (order_id, status, message) VALUES ($1,$2,$3)', [order.id, status, trackMsg]);
      if (status === 'completed' && (courier_id || order.courier_id)) {
        await client.query('UPDATE couriers SET total_deliver = total_deliver + 1 WHERE id = $1', [courier_id || order.courier_id]);
      }
      return orderResult.rows[0];
    });
    if (!updated) return fail(res, 'Pesanan tidak ditemukan.', 404);
    return ok(res, { order: updated }, 'Status pesanan diperbarui.');
  } catch (err) { return next(err); }
}

async function cancelOrder(req, res, next) {
  try {
    const order = await withTransaction(async (client) => {
      const got = await client.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, req.user.id]);
      const item = got.rows[0];
      if (!item || !['pending', 'confirmed'].includes(item.status)) return null;
      await client.query("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [item.id]);
      await client.query("INSERT INTO order_tracking (order_id, status, message) VALUES ($1, 'cancelled', 'Pesanan dibatalkan oleh pelanggan.')", [item.id]);
      return item;
    });
    if (!order) return fail(res, 'Pesanan tidak ditemukan atau tidak bisa dibatalkan.');
    return ok(res, {}, 'Pesanan berhasil dibatalkan.');
  } catch (err) { return next(err); }
}

async function getStats(req, res, next) {
  try {
    const values = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM orders WHERE status NOT IN ('completed','cancelled')) AS orders_active,
        (SELECT COUNT(*)::int FROM orders WHERE created_at::date = CURRENT_DATE) AS orders_today,
        (SELECT COALESCE(SUM(total),0)::numeric FROM orders WHERE payment_status='paid' AND date_trunc('month',created_at)=date_trunc('month',CURRENT_TIMESTAMP)) AS revenue_month,
        (SELECT COALESCE(SUM(total),0)::numeric FROM orders WHERE payment_status='paid') AS revenue_total,
        (SELECT COUNT(*)::int FROM inventory WHERE status='available') AS inventory_avail,
        (SELECT COUNT(*)::int FROM inventory WHERE status='rented') AS inventory_rented,
        (SELECT COUNT(*)::int FROM couriers WHERE status='active') AS couriers_active,
        (SELECT COALESCE(ROUND(AVG(rating)::numeric,1),5.0) FROM reviews) AS avg_rating
    `);
    const row = values.rows[0];
    const stats = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
    const revenue7 = (await query(
      `SELECT created_at::date AS day, SUM(total)::numeric AS total FROM orders
       WHERE payment_status='paid' AND created_at::date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY created_at::date ORDER BY day ASC`
    )).rows.map(r => ({ ...r, total: Number(r.total) }));
    const monthlyOrders = (await query(
      `SELECT TO_CHAR(created_at, 'MM') AS month, COUNT(*)::int AS count FROM orders
       WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
       GROUP BY TO_CHAR(created_at, 'MM') ORDER BY month ASC`
    )).rows;
    return ok(res, { stats, revenue7, monthlyOrders });
  } catch (err) { return next(err); }
}

const statusMessages = {
  confirmed: 'Pesanan dikonfirmasi oleh admin.',
  preparing: 'Unit PS sedang disiapkan dan dicek kelengkapannya.',
  on_delivery: 'Kurir sedang menuju lokasi pengiriman.',
  delivered: 'PS berhasil diantar. Selamat bermain!',
  active: 'Masa sewa sedang berjalan.',
  returning: 'Kurir sedang menjemput unit PS.',
  completed: 'Pesanan selesai. Terima kasih telah menggunakan Void Play Box!',
  cancelled: 'Pesanan dibatalkan.'
};
module.exports = { create, getMyOrders, getOne, getAll, updateStatus, cancelOrder, getStats };
