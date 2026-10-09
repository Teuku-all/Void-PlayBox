
const express = require('express');
const router  = express.Router();

const auth      = require('../middleware/auth');
const authCtrl  = require('../controllers/authController');
const pkgCtrl   = require('../controllers/packageController');
const orderCtrl = require('../controllers/orderController');
const mapsCtrl  = require('../controllers/mapsController');
const chatCtrl  = require('../controllers/chatController');
const invCtrl   = require('../controllers/inventoryController');
const courCtrl  = require('../controllers/courierController');

// ── Health check ──────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status: 'ok', service: 'Void Play Box API', ts: new Date().toISOString() }));

// ── Auth ──────────────────────────────────────────────────
router.post('/auth/register',         authCtrl.register);
router.post('/auth/login',            authCtrl.login);
router.get ('/auth/profile',          auth.authenticate, authCtrl.getProfile);
router.put ('/auth/profile',          auth.authenticate, authCtrl.updateProfile);
router.put ('/auth/change-password',  auth.authenticate, authCtrl.changePassword);

// ── Packages ──────────────────────────────────────────────
router.get ('/packages',     pkgCtrl.getAll);
router.get ('/packages/:id', pkgCtrl.getOne);
router.post('/packages',     auth.authenticate, auth.requireAdmin, pkgCtrl.create);
router.put ('/packages/:id', auth.authenticate, auth.requireAdmin, pkgCtrl.update);
router.delete('/packages/:id',auth.authenticate, auth.requireAdmin, pkgCtrl.remove);

// ── Orders ────────────────────────────────────────────────
router.post('/orders',                  auth.authenticate, orderCtrl.create);
router.get ('/orders/my',               auth.authenticate, orderCtrl.getMyOrders);
router.get ('/orders',                  auth.authenticate, auth.requireAdmin, orderCtrl.getAll);
router.get ('/orders/stats',            auth.authenticate, auth.requireAdmin, orderCtrl.getStats);
router.get ('/orders/:id',              auth.authenticate, orderCtrl.getOne);
router.put ('/orders/:id/status',       auth.authenticate, auth.requireAdmin, orderCtrl.updateStatus);
router.put ('/orders/:id/cancel',       auth.authenticate, orderCtrl.cancelOrder);

// ── Maps (OSM — gratis, no API key) ──────────────────────
router.get('/maps/geocode',            auth.authenticate, mapsCtrl.geocode);
router.get('/maps/reverse',            auth.authenticate, mapsCtrl.reverseGeocode);
router.get('/maps/route',              auth.authenticate, mapsCtrl.getRoute);
router.get('/maps/courier/:orderId',   auth.authenticate, mapsCtrl.getCourierLocation);
router.put('/maps/courier/:courierId/location', auth.authenticate, auth.requireAdmin, mapsCtrl.updateCourierLocation);

// ── Chat ──────────────────────────────────────────────────
router.get ('/chat/rooms',                  auth.authenticate, chatCtrl.getRooms);
router.get ('/chat/:room_id/messages',      auth.authenticate, chatCtrl.getMessages);
router.post('/chat/:room_id/messages',      auth.authenticate, chatCtrl.sendMessage);

// ── Inventory (admin) ─────────────────────────────────────
router.get   ('/inventory',     auth.authenticate, auth.requireAdmin, invCtrl.getAll);
router.post  ('/inventory',     auth.authenticate, auth.requireAdmin, invCtrl.create);
router.put   ('/inventory/:id', auth.authenticate, auth.requireAdmin, invCtrl.update);
router.delete('/inventory/:id', auth.authenticate, auth.requireAdmin, invCtrl.remove);

// ── Couriers (admin) ──────────────────────────────────────
router.get   ('/couriers',     auth.authenticate, auth.requireAdmin, courCtrl.getAll);
router.post  ('/couriers',     auth.authenticate, auth.requireAdmin, courCtrl.create);
router.put   ('/couriers/:id', auth.authenticate, auth.requireAdmin, courCtrl.update);
router.delete('/couriers/:id', auth.authenticate, auth.requireAdmin, courCtrl.remove);

// ── Admin: semua users ────────────────────────────────────
router.get('/admin/users', auth.authenticate, auth.requireAdmin, (req, res) => {
  const { getDb } = require('../config/database');
  const db = getDb();
  const users = db.prepare('SELECT id, uuid, name, email, phone, role, address, is_active, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ success: true, data: { users } });
});

module.exports = router;
