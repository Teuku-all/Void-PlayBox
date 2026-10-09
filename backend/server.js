
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const routes                      = require('./routes/index');
const { errorHandler, notFound }  = require('./middleware/errorHandler');
const { initDb }                  = require('./config/initDb');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Inisialisasi Database ─────────────────────────────────
try {
  initDb();
  console.log('✅ Database siap');
} catch (err) {
  console.error('❌ Gagal init database:', err.message);
  process.exit(1);
}

// ── Security & Logging ────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));   // CSP diatur manual di frontend
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate Limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 menit
  max: 200,
  message: { success: false, message: 'Terlalu banyak request. Coba lagi sebentar.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba 15 menit lagi.' }
});

app.use('/api/', limiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'],
  methods:     ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

// ── Body Parser ───────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Static Files (Frontend) ───────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── API Routes ────────────────────────────────────────────
app.use('/api', routes);

// ── SPA Fallback: kirim index.html untuk semua non-API route ──
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Error Handlers ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🎮 ============================');
  console.log(`   Void Play Box API berjalan!`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log('🎮 ============================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Server mati...');
  process.exit(0);
});

module.exports = app;
