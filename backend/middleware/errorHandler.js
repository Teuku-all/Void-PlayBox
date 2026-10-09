function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
  if (process.env.NODE_ENV !== 'production' && err.stack) console.error(err.stack);

  // PostgreSQL constraint errors: unique, foreign key, check, not-null.
  if (['23505', '23503', '23514', '23502'].includes(err.code)) {
    const status = err.code === '23505' ? 409 : 400;
    return res.status(status).json({ success: false, message: err.code === '23505' ? 'Data sudah ada (duplikasi).' : 'Data tidak memenuhi aturan database.' });
  }
  if (err.status || err.statusCode) {
    return res.status(err.status || err.statusCode).json({ success: false, message: err.message || 'Permintaan gagal.' });
  }
  const message = process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan server.' : (err.message || 'Terjadi kesalahan server.');
  return res.status(500).json({ success: false, message });
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan.` });
}
function ok(res, data = {}, message = 'Berhasil', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}
function fail(res, message = 'Gagal', statusCode = 400) {
  return res.status(statusCode).json({ success: false, message });
}
module.exports = { errorHandler, notFound, ok, fail };
