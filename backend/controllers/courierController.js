const { query } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

async function getAll(req, res, next) {
  try { return ok(res, { couriers: (await query('SELECT * FROM couriers ORDER BY name ASC')).rows }); }
  catch (err) { return next(err); }
}
async function create(req, res, next) {
  try {
    const { name, phone, email } = req.body;
    if (!name || !phone) return fail(res, 'Nama dan nomor HP wajib diisi.');
    const result = await query('INSERT INTO couriers (name, phone, email) VALUES ($1,$2,$3) RETURNING *', [name, phone, email || null]);
    return ok(res, { courier: result.rows[0] }, 'Kurir berhasil ditambahkan.', 201);
  } catch (err) { return next(err); }
}
async function update(req, res, next) {
  try {
    const { name, phone, email, status } = req.body;
    const result = await query(
      'UPDATE couriers SET name=$1, phone=$2, email=$3, status=$4 WHERE id=$5 RETURNING *',
      [name, phone, email || null, status || 'active', req.params.id]
    );
    if (!result.rows[0]) return fail(res, 'Kurir tidak ditemukan.', 404);
    return ok(res, { courier: result.rows[0] }, 'Kurir berhasil diperbarui.');
  } catch (err) { return next(err); }
}
async function remove(req, res, next) {
  try {
    const result = await query("UPDATE couriers SET status='inactive' WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rows[0]) return fail(res, 'Kurir tidak ditemukan.', 404);
    return ok(res, {}, 'Kurir berhasil dinonaktifkan.');
  } catch (err) { return next(err); }
}
module.exports = { getAll, create, update, remove };
