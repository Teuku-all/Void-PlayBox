
const { getDb } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

function getAll(req, res, next) {
  try {
    const { status, ps_type } = req.query;
    const db = getDb();
    let sql = 'SELECT * FROM inventory WHERE 1=1';
    const params = [];
    if (status)  { sql += ' AND status = ?';  params.push(status); }
    if (ps_type) { sql += ' AND ps_type = ?'; params.push(ps_type); }
    sql += ' ORDER BY ps_type, serial_no ASC';
    const items = db.prepare(sql).all(...params);
    return ok(res, { inventory: items });
  } catch (err) { next(err); }
}

function create(req, res, next) {
  try {
    const { serial_no, ps_type, name, condition, notes } = req.body;
    if (!serial_no || !ps_type || !name) return fail(res, 'serial_no, ps_type, dan name wajib diisi.');
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO inventory (serial_no, ps_type, name, condition, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(serial_no, ps_type, name, condition || 'good', notes || null);
    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(result.lastInsertRowid);
    return ok(res, { item }, 'Unit berhasil ditambahkan.', 201);
  } catch (err) { next(err); }
}

function update(req, res, next) {
  try {
    const { name, status, condition, notes } = req.body;
    const db = getDb();
    const item = db.prepare('SELECT id FROM inventory WHERE id = ?').get(req.params.id);
    if (!item) return fail(res, 'Unit tidak ditemukan.', 404);
    db.prepare(`
      UPDATE inventory SET name=?, status=?, condition=?, notes=?, updated_at=datetime('now') WHERE id=?
    `).run(name, status, condition, notes || null, req.params.id);
    const updated = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
    return ok(res, { item: updated }, 'Unit berhasil diperbarui.');
  } catch (err) { next(err); }
}

function remove(req, res, next) {
  try {
    const db = getDb();
    const item = db.prepare('SELECT id FROM inventory WHERE id = ?').get(req.params.id);
    if (!item) return fail(res, 'Unit tidak ditemukan.', 404);
    db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
    return ok(res, {}, 'Unit berhasil dihapus.');
  } catch (err) { next(err); }
}

module.exports = { getAll, create, update, remove };
