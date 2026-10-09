const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan. Silakan login.' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, uuid, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user || Number(user.is_active) !== 1) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan atau tidak aktif.' });
    }
    req.user = user;
    return next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
    }
    return next(err);
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin yang bisa mengakses ini.' });
  }
  return next();
}
function requireAdminOrSelf(req, res, next) {
  const targetId = parseInt(req.params.userId || req.params.id, 10);
  if (req.user.role === 'admin' || Number(req.user.id) === targetId) return next();
  return res.status(403).json({ success: false, message: 'Akses ditolak.' });
}
module.exports = { authenticate, requireAdmin, requireAdminOrSelf };
