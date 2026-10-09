
const { getDb } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

// ── Get All Packages ──────────────────────────────────────
function getAll(req, res, next) {
  try {
    const { category, ps_type } = req.query;
    const db = getDb();
    let sql = 'SELECT * FROM packages WHERE is_active = 1';
    const params = [];
    if (category) { sql += ' AND catalog_group = ?'; params.push(category); }
    if (ps_type)  { sql += ' AND ps_type = ?';  params.push(ps_type); }
    sql += " ORDER BY CASE catalog_group WHEN 'personal' THEN 0 WHEN 'harian' THEN 1 ELSE 2 END, duration ASC";
    const packages = db.prepare(sql).all(...params).map(p => ({
      ...p, category: p.catalog_group || p.category, features: JSON.parse(p.features)
    }));
    return ok(res, { packages });
  } catch (err) { next(err); }
}

// ── Get Single Package ────────────────────────────────────
function getOne(req, res, next) {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND is_active = 1').get(req.params.id);
    if (!pkg) return fail(res, 'Paket tidak ditemukan.', 404);
    return ok(res, { package: { ...pkg, category: pkg.catalog_group || pkg.category, features: JSON.parse(pkg.features) } });
  } catch (err) { next(err); }
}

// ── Create Package (admin) ────────────────────────────────
function create(req, res, next) {
  try {
    const { name, category, ps_type, duration, price, description, features, is_popular } = req.body;
    if (!name || !category || !ps_type || !duration || !price || !features) {
      return fail(res, 'Semua field wajib diisi.');
    }
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO packages (name, category, ps_type, duration, price, description, features, is_popular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, category, ps_type, duration, price, description || null, JSON.stringify(features), is_popular ? 1 : 0);

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(result.lastInsertRowid);
    return ok(res, { package: { ...pkg, features: JSON.parse(pkg.features) } }, 'Paket berhasil ditambahkan.', 201);
  } catch (err) { next(err); }
}

// ── Update Package (admin) ────────────────────────────────
function update(req, res, next) {
  try {
    const { name, category, ps_type, duration, price, description, features, is_popular, is_active } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT id FROM packages WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 'Paket tidak ditemukan.', 404);

    db.prepare(`
      UPDATE packages SET name=?, category=?, ps_type=?, duration=?, price=?,
        description=?, features=?, is_popular=?, is_active=?
      WHERE id = ?
    `).run(name, category, ps_type, duration, price, description, JSON.stringify(features), is_popular ? 1 : 0, is_active !== undefined ? is_active : 1, req.params.id);

    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    return ok(res, { package: { ...updated, features: JSON.parse(updated.features) } }, 'Paket berhasil diperbarui.');
  } catch (err) { next(err); }
}

// ── Delete Package (admin, soft delete) ──────────────────
function remove(req, res, next) {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM packages WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 'Paket tidak ditemukan.', 404);
    db.prepare('UPDATE packages SET is_active = 0 WHERE id = ?').run(req.params.id);
    return ok(res, {}, 'Paket berhasil dihapus.');
  } catch (err) { next(err); }
}

module.exports = { getAll, getOne, create, update, remove };
