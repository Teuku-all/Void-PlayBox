const { query } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

async function getAll(req, res, next) {
  try {
    const { status, ps_type } = req.query;
    let sql = 'SELECT * FROM inventory WHERE 1=1';
    const params = [];
    if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
    if (ps_type) { params.push(ps_type); sql += ` AND ps_type = $${params.length}`; }
    sql += ' ORDER BY ps_type, serial_no ASC';
    return ok(res, { inventory: (await query(sql, params)).rows });
  } catch (err) { return next(err); }
}
async function create(req, res, next) {
  try {
    const { serial_no, ps_type, name, condition, notes } = req.body;
    if (!serial_no || !ps_type || !name) return fail(res, 'serial_no, ps_type, dan name wajib diisi.');
    const result = await query(
      `INSERT INTO inventory (serial_no, ps_type, name, condition, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [serial_no, ps_type, name, condition || 'good', notes || null]
    );
    return ok(res, { item: result.rows[0] }, 'Unit berhasil ditambahkan.', 201);
  } catch (err) { return next(err); }
}
async function update(req, res, next) {
  try {
    const { name, status, condition, notes } = req.body;
    const result = await query(
      `UPDATE inventory SET name=$1, status=$2, condition=$3, notes=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5 RETURNING *`,
      [name, status, condition, notes || null, req.params.id]
    );
    if (!result.rows[0]) return fail(res, 'Unit tidak ditemukan.', 404);
    return ok(res, { item: result.rows[0] }, 'Unit berhasil diperbarui.');
  } catch (err) { return next(err); }
}
async function remove(req, res, next) {
  try {
    const result = await query('DELETE FROM inventory WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return fail(res, 'Unit tidak ditemukan.', 404);
    return ok(res, {}, 'Unit berhasil dihapus.');
  } catch (err) { return next(err); }
}
module.exports = { getAll, create, update, remove };
