
const { getDb } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

function getAll(req, res, next) {
  try {
    const db = getDb();
    const couriers = db.prepare('SELECT * FROM couriers ORDER BY name ASC').all();
    return ok(res, { couriers });
  } catch (err) { next(err); }
}

function create(req, res, next) {
  try {
    const { name, phone, email } = req.body;
    if (!name || !phone) return fail(res, 'Nama dan nomor HP wajib diisi.');
    const db = getDb();
    const result = db.prepare('INSERT INTO couriers (name, phone, email) VALUES (?, ?, ?)').run(name, phone, email || null);
    const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(result.lastInsertRowid);
    return ok(res, { courier }, 'Kurir berhasil ditambahkan.', 201);
  } catch (err) { next(err); }
}

function update(req, res, next) {
  try {
    const { name, phone, email, status } = req.body;
    const db = getDb();
    const c = db.prepare('SELECT id FROM couriers WHERE id = ?').get(req.params.id);
    if (!c) return fail(res, 'Kurir tidak ditemukan.', 404);
    db.prepare('UPDATE couriers SET name=?, phone=?, email=?, status=? WHERE id=?').run(name, phone, email || null, status || 'active', req.params.id);
    const updated = db.prepare('SELECT * FROM couriers WHERE id = ?').get(req.params.id);
    return ok(res, { courier: updated }, 'Kurir berhasil diperbarui.');
  } catch (err) { next(err); }
}

function remove(req, res, next) {
  try {
    const db = getDb();
    const c = db.prepare('SELECT id FROM couriers WHERE id = ?').get(req.params.id);
    if (!c) return fail(res, 'Kurir tidak ditemukan.', 404);
    db.prepare("UPDATE couriers SET status = 'inactive' WHERE id = ?").run(req.params.id);
    return ok(res, {}, 'Kurir berhasil dinonaktifkan.');
  } catch (err) { next(err); }
}

module.exports = { getAll, create, update, remove };
