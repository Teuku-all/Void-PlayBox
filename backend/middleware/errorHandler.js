
// Global error handler
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
  console.error(err.stack);

  // SQLite constraint errors
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ success: false, message: 'Data sudah ada (duplikasi).' });
  }
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan database.' });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan server.';
  res.status(status).json({ success: false, message });
}

// 404 handler
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan.` });
}

// Response helpers
function ok(res, data = {}, message = 'Berhasil', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function fail(res, message = 'Gagal', statusCode = 400) {
  return res.status(statusCode).json({ success: false, message });
}

module.exports = { errorHandler, notFound, ok, fail };
