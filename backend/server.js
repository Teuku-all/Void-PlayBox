require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes/index');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initDb } = require('./config/initDb');

const app = express();
let databaseReady;

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5500')
  .split(',').map(value => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Permit requests without an Origin header (for curl and health monitoring).
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin tidak diizinkan oleh CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak request. Coba lagi sebentar.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba 15 menit lagi.' }
});
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Initialize schema/seed once per warm serverless instance, and wait before routing.
app.use(async (req, res, next) => {
  try {
    if (!databaseReady) databaseReady = initDb();
    await databaseReady;
    return next();
  } catch (err) {
    databaseReady = null; // let a later request retry after environment/database fixes
    return next(err);
  }
});

app.get('/', (req, res) => res.json({ service: 'Void Play Box API', status: 'ok', health: '/api/health' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

// Vercel imports the Express app; listen only when running directly on a local machine.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🎮 Void Play Box API berjalan di http://localhost:${port}`));
}

module.exports = app;
