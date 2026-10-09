const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { query } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

async function register(req, res, next) {
  try {
    const { name, email, phone, password, address } = req.body;
    if (!name || !email || !password) return fail(res, 'Nama, email, dan password wajib diisi.');
    if (password.length < 6) return fail(res, 'Password minimal 6 karakter.');
    const cleanEmail = email.toLowerCase().trim();
    const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows[0]) return fail(res, 'Email sudah terdaftar.', 409);
    const hash = bcrypt.hashSync(password, 10);
    const result = await query(
      `INSERT INTO users (uuid, name, email, phone, password, role, address)
       VALUES ($1,$2,$3,$4,$5,'user',$6)
       RETURNING id, uuid, name, email, role`,
      [randomUUID(), name.trim(), cleanEmail, phone || null, hash, address || null]
    );
    const user = result.rows[0];
    return ok(res, { user, token: generateToken(user) }, 'Registrasi berhasil!', 201);
  } catch (err) { return next(err); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Email dan password wajib diisi.');
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = 1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) return fail(res, 'Email atau password salah.', 401);
    const { password: omitted, ...safeUser } = user;
    return ok(res, { user: safeUser, token: generateToken(user) }, 'Login berhasil!');
  } catch (err) { return next(err); }
}

async function getProfile(req, res, next) {
  try {
    const result = await query(
      'SELECT id, uuid, name, email, phone, role, address, avatar, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    return ok(res, { user: result.rows[0] || null });
  } catch (err) { return next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const { name, phone, address } = req.body;
    const result = await query(
      `UPDATE users SET name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING id, uuid, name, email, phone, role, address`,
      [name || req.user.name, phone || null, address || null, req.user.id]
    );
    return ok(res, { user: result.rows[0] }, 'Profil berhasil diperbarui.');
  } catch (err) { return next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return fail(res, 'Password lama dan baru wajib diisi.');
    if (newPassword.length < 6) return fail(res, 'Password baru minimal 6 karakter.');
    const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(oldPassword, user.password)) return fail(res, 'Password lama salah.', 401);
    await query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [bcrypt.hashSync(newPassword, 10), req.user.id]);
    return ok(res, {}, 'Password berhasil diubah.');
  } catch (err) { return next(err); }
}

function generateToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET belum diatur atau terlalu pendek (gunakan string acak minimal 32 karakter).');
  }
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}
module.exports = { register, login, getProfile, updateProfile, changePassword };
