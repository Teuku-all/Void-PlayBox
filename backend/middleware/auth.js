
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

// Verifikasi token JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan. Silakan login.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, uuid, name, email, role, is_active FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan atau tidak aktif.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
  }
}

// Hanya admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin yang bisa mengakses ini.' });
  }
  next();
}

// Admin atau pemilik data sendiri
function requireAdminOrSelf(req, res, next) {
  const targetId = parseInt(req.params.userId || req.params.id);
  if (req.user.role === 'admin' || req.user.id === targetId) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Akses ditolak.' });
}

module.exports = { authenticate, requireAdmin, requireAdminOrSelf };
