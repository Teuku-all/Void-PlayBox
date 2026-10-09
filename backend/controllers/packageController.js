const { query } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

const validCategories = ['harian', 'mingguan', 'bulanan'];
function parseFeatures(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}
function presentPackage(pkg) {
  return { ...pkg, category: pkg.catalog_group || pkg.category, features: parseFeatures(pkg.features) };
}

async function getAll(req, res, next) {
  try {
    const { category, ps_type } = req.query;
    let sql = 'SELECT * FROM packages WHERE is_active = 1';
    const params = [];
    if (category) { params.push(category); sql += ` AND catalog_group = $${params.length}`; }
    if (ps_type) { params.push(ps_type); sql += ` AND ps_type = $${params.length}`; }
    sql += ` ORDER BY CASE catalog_group WHEN 'personal' THEN 0 WHEN 'harian' THEN 1 ELSE 2 END, duration ASC`;
    const result = await query(sql, params);
    return ok(res, { packages: result.rows.map(presentPackage) });
  } catch (err) { return next(err); }
}
async function getOne(req, res, next) {
  try {
    const result = await query('SELECT * FROM packages WHERE id = $1 AND is_active = 1', [req.params.id]);
    const pkg = result.rows[0];
    if (!pkg) return fail(res, 'Paket tidak ditemukan.', 404);
    return ok(res, { package: presentPackage(pkg) });
  } catch (err) { return next(err); }
}
async function create(req, res, next) {
  try {
    const { name, category, ps_type, duration, price, description, features, is_popular } = req.body;
    if (!name || !category || !ps_type || !duration || !price || !features) return fail(res, 'Semua field wajib diisi.');
    const group = category;
    const storedCategory = validCategories.includes(category) ? category : 'harian';
    const result = await query(
      `INSERT INTO packages (name, category, catalog_group, ps_type, duration, price, description, features, is_popular)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, storedCategory, group, ps_type, duration, price, description || null, JSON.stringify(features), is_popular ? 1 : 0]
    );
    return ok(res, { package: presentPackage(result.rows[0]) }, 'Paket berhasil ditambahkan.', 201);
  } catch (err) { return next(err); }
}
async function update(req, res, next) {
  try {
    const { name, category, ps_type, duration, price, description, features, is_popular, is_active } = req.body;
    const existing = await query('SELECT id FROM packages WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return fail(res, 'Paket tidak ditemukan.', 404);
    const group = category;
    const storedCategory = validCategories.includes(category) ? category : 'harian';
    const result = await query(
      `UPDATE packages SET name=$1, category=$2, catalog_group=$3, ps_type=$4, duration=$5,
       price=$6, description=$7, features=$8, is_popular=$9, is_active=$10 WHERE id=$11 RETURNING *`,
      [name, storedCategory, group, ps_type, duration, price, description || null, JSON.stringify(features || []), is_popular ? 1 : 0, is_active !== undefined ? (is_active ? 1 : 0) : 1, req.params.id]
    );
    return ok(res, { package: presentPackage(result.rows[0]) }, 'Paket berhasil diperbarui.');
  } catch (err) { return next(err); }
}
async function remove(req, res, next) {
  try {
    const result = await query('UPDATE packages SET is_active = 0 WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return fail(res, 'Paket tidak ditemukan.', 404);
    return ok(res, {}, 'Paket berhasil dihapus.');
  } catch (err) { return next(err); }
}
module.exports = { getAll, getOne, create, update, remove };
