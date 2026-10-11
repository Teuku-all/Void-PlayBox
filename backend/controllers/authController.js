const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');
const googleClient = new OAuth2Client();

function googleConfig(req, res) {
  return ok(res, { clientId: process.env.GOOGLE_CLIENT_ID || '' });
}

async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return fail(res, 'Login Google belum dikonfigurasi.', 503);
    if (!credential) return fail(res, 'Token Google tidak ditemukan.');

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    const profile = ticket.getPayload();
    if (!profile || !profile.email || profile.email_verified !== true) {
      return fail(res, 'Gunakan akun Google dengan email terverifikasi.', 401);
    }

    const email = profile.email.toLowerCase().trim();
    let result = await query('SELECT id, uuid, name, email, phone, role, address, avatar, is_active, created_at FROM users WHERE email = $1', [email]);
    let user = result.rows[0];
    if (user && !user.is_active) return fail(res, 'Akun ini dinonaktifkan. Hubungi admin.', 403);

    if (!user) {
      result = await query(
        `INSERT INTO users (uuid, name, email, password, role, avatar)
         VALUES ($1, $2, $3, $4, 'user', $5)
         RETURNING id, uuid, name, email, phone, role, address, avatar, is_active, created_at`,
        [randomUUID(), (profile.name || '').trim() || email.split('@')[0], email, bcrypt.hashSync(randomUUID(), 10), profile.picture || null]
      );
      user = result.rows[0];
    } else if (!user.avatar && profile.picture) {
      user.avatar = profile.picture;
      await query('UPDATE users SET avatar = $1 WHERE id = $2', [profile.picture, user.id]);
    }

    return ok(res, { user, token: generateToken(user) }, 'Login Google berhasil!');
  } catch (err) {
    if (err.message && /Token used too (early|late)|Invalid token|Wrong number of segments|audience/i.test(err.message)) {
      return fail(res, 'Token Google tidak valid atau sudah kedaluwarsa.', 401);
    }
    return next(err);
  }
}

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
module.exports = { register, login, googleConfig, googleLogin, getProfile, updateProfile, changePassword };
