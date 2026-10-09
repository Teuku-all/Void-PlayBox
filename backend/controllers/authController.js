
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

// ── Register ──────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { name, email, phone, password, address } = req.body;
    if (!name || !email || !password) {
      return fail(res, 'Nama, email, dan password wajib diisi.');
    }
    if (password.length < 6) {
      return fail(res, 'Password minimal 6 karakter.');
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return fail(res, 'Email sudah terdaftar.', 409);

    const hash = bcrypt.hashSync(password, 10);
    const uuid = uuidv4();
    const result = db.prepare(`
      INSERT INTO users (uuid, name, email, phone, password, role, address)
      VALUES (?, ?, ?, ?, ?, 'user', ?)
    `).run(uuid, name.trim(), email.toLowerCase().trim(), phone || null, hash, address || null);

    const user = db.prepare('SELECT id, uuid, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    return ok(res, { user, token }, 'Registrasi berhasil!', 201);
  } catch (err) { next(err); }
}

// ── Login ─────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Email dan password wajib diisi.');

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());
    if (!user) return fail(res, 'Email atau password salah.', 401);

    const match = bcrypt.compareSync(password, user.password);
    if (!match) return fail(res, 'Email atau password salah.', 401);

    const token = generateToken(user);
    const { password: _, ...safeUser } = user;

    return ok(res, { user: safeUser, token }, 'Login berhasil!');
  } catch (err) { next(err); }
}

// ── Get Profile ───────────────────────────────────────────
function getProfile(req, res, next) {
  try {
    const db = getDb();
    const user = db.prepare(`
      SELECT id, uuid, name, email, phone, role, address, avatar, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);
    return ok(res, { user });
  } catch (err) { next(err); }
}

// ── Update Profile ────────────────────────────────────────
async function updateProfile(req, res, next) {
  try {
    const { name, phone, address } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE users SET name = ?, phone = ?, address = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name || req.user.name, phone || null, address || null, req.user.id);
    const updated = db.prepare('SELECT id, uuid, name, email, phone, role, address FROM users WHERE id = ?').get(req.user.id);
    return ok(res, { user: updated }, 'Profil berhasil diperbarui.');
  } catch (err) { next(err); }
}

// ── Change Password ───────────────────────────────────────
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return fail(res, 'Password lama dan baru wajib diisi.');
    if (newPassword.length < 6) return fail(res, 'Password baru minimal 6 karakter.');

    const db = getDb();
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(oldPassword, user.password)) return fail(res, 'Password lama salah.', 401);

    db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(bcrypt.hashSync(newPassword, 10), req.user.id);
    return ok(res, {}, 'Password berhasil diubah.');
  } catch (err) { next(err); }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { register, login, getProfile, updateProfile, changePassword };

