
const { getDb } = require('./database');
const bcrypt = require('bcryptjs');

function initDb() {
  const db = getDb();

  // ── USERS ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid        TEXT    UNIQUE NOT NULL,
      name        TEXT    NOT NULL,
      email       TEXT    UNIQUE NOT NULL,
      phone       TEXT,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
      avatar      TEXT,
      address     TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // ── PACKAGES ───────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      category    TEXT    NOT NULL CHECK(category IN ('harian','mingguan','bulanan')),
      ps_type     TEXT    NOT NULL CHECK(ps_type IN ('ps4_slim','ps4_pro','ps5')),
      duration    INTEGER NOT NULL,
      price       INTEGER NOT NULL,
      description TEXT,
      features    TEXT    NOT NULL,
      is_popular  INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  ensureColumn(db, 'packages', 'catalog_group', "TEXT NOT NULL DEFAULT 'harian'");
  ensureColumn(db, 'packages', 'duration_label', 'TEXT');

  // ── INVENTORY ──────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      serial_no   TEXT    UNIQUE NOT NULL,
      ps_type     TEXT    NOT NULL CHECK(ps_type IN ('ps4_slim','ps4_pro','ps5')),
      name        TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'available' CHECK(status IN ('available','rented','maintenance')),
      condition   TEXT    NOT NULL DEFAULT 'good' CHECK(condition IN ('excellent','good','fair','poor')),
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── ORDERS ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code     TEXT    UNIQUE NOT NULL,
      user_id        INTEGER NOT NULL REFERENCES users(id),
      package_id     INTEGER NOT NULL REFERENCES packages(id),
      inventory_id   INTEGER REFERENCES inventory(id),
      courier_id     INTEGER REFERENCES couriers(id),
      status         TEXT    NOT NULL DEFAULT 'pending'
                             CHECK(status IN ('pending','confirmed','preparing','on_delivery','delivered','active','returning','completed','cancelled')),
      payment_method TEXT    NOT NULL CHECK(payment_method IN ('bca','gopay','ovo','dana','cod')),
      payment_status TEXT    NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','refunded')),
      subtotal       INTEGER NOT NULL,
      delivery_fee   INTEGER NOT NULL DEFAULT 15000,
      total          INTEGER NOT NULL,
      delivery_address TEXT  NOT NULL,
      delivery_lat   REAL,
      delivery_lng   REAL,
      start_date     TEXT,
      end_date       TEXT,
      notes          TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── COURIERS ───────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS couriers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      phone        TEXT    NOT NULL,
      email        TEXT,
      photo        TEXT,
      status       TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','off','inactive')),
      total_deliver INTEGER NOT NULL DEFAULT 0,
      rating       REAL    NOT NULL DEFAULT 5.0,
      current_lat  REAL,
      current_lng  REAL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── ORDER TRACKING ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_tracking (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id),
      status     TEXT    NOT NULL,
      message    TEXT    NOT NULL,
      lat        REAL,
      lng        REAL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── CHAT MESSAGES ─────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id    TEXT    NOT NULL,
      sender_id  INTEGER NOT NULL REFERENCES users(id),
      sender_role TEXT   NOT NULL CHECK(sender_role IN ('user','admin','courier')),
      message    TEXT    NOT NULL,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── REVIEWS ───────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER UNIQUE NOT NULL REFERENCES orders(id),
      user_id    INTEGER NOT NULL REFERENCES users(id),
      rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment    TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── INDEXES ───────────────────────────────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_id     ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_room_id       ON chat_messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_tracking_order_id  ON order_tracking(order_id);
    CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
  `);

  console.log('✅ Semua tabel berhasil dibuat');
  seedData(db);
  syncReferencePackages(db);
}

function ensureColumn(db, table, column, definition) {
  const columns = db.pragma(`table_info(${table})`);
  if (!columns.some(item => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seedData(db) {
  // Cek apakah sudah ada data
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) {
    console.log('ℹ️  Data seed sudah ada, skip...');
    return;
  }

  const { v4: uuidv4 } = require('uuid');
  const hashAdmin  = bcrypt.hashSync('admin123', 10);
  const hashUser   = bcrypt.hashSync('user123', 10);

  // Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (uuid, name, email, phone, password, role, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run(uuidv4(), 'Admin Void Play Box', 'admin@playbox.id', '085126539339', hashAdmin, 'admin', 'Banda Aceh, Aceh');
  insertUser.run(uuidv4(), 'Ahmad Yani',    'user@playbox.id',  '08123456789',  hashUser,  'user',  'Jl. Sudirman No.12, Banda Aceh');
  insertUser.run(uuidv4(), 'Siti Fatimah',  'siti@gmail.com',   '08567890123',  hashUser,  'user',  'Jl. Cut Nyak No.5, Banda Aceh');

  // Seed Packages
  const insertPkg = db.prepare(`
    INSERT INTO packages (name, category, ps_type, duration, price, description, features, is_popular)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Harian
  insertPkg.run('Harian Basic',   'harian', 'ps4_slim', 1, 80000,  'Cocok untuk main santai sehari', JSON.stringify(['PS4 Slim 500GB','2 Controller','20+ Game','Kabel & Aksesori']), 0);
  insertPkg.run('Harian Premium', 'harian', 'ps4_pro',  1, 120000, 'PS4 Pro untuk pengalaman terbaik', JSON.stringify(['PS4 Pro 1TB','2 Controller','50+ Game','Headset Gaming','Priority Support']), 1);
  insertPkg.run('Harian PS5',     'harian', 'ps5',      1, 180000, 'Next-gen gaming experience',     JSON.stringify(['PlayStation 5','2 DualSense','30+ Game PS5','Akses PS Plus']), 0);
  // Mingguan
  insertPkg.run('Mingguan Basic',   'mingguan', 'ps4_slim', 7, 400000,  'Hemat 28% dibanding harian', JSON.stringify(['PS4 Slim 500GB','2 Controller','20+ Game','Gratis ongkir balik','Hemat 28%']), 0);
  insertPkg.run('Mingguan Premium', 'mingguan', 'ps4_pro',  7, 600000,  'Pilihan terbaik',            JSON.stringify(['PS4 Pro 1TB','2 Controller','50+ Game','Headset Gaming','Gratis ongkir balik']), 1);
  insertPkg.run('Mingguan PS5',     'mingguan', 'ps5',      7, 900000,  'PS5 satu minggu penuh',      JSON.stringify(['PlayStation 5','2 DualSense','30+ Game PS5','PS Plus 1 Minggu','Gratis ongkir balik']), 0);
  // Bulanan
  insertPkg.run('Bulanan Basic',        'bulanan', 'ps4_slim', 30, 1200000, 'Hemat 50%',              JSON.stringify(['PS4 Slim 500GB','2 Controller','20+ Game','Gratis ongkir bolak-balik','Hemat 50%']), 0);
  insertPkg.run('Bulanan Premium',      'bulanan', 'ps4_pro',  30, 1800000, 'Pilihan para gamers',    JSON.stringify(['PS4 Pro 1TB','2 Controller','50+ Game','Headset + VR Trial','Priority Support']), 1);
  insertPkg.run('Bulanan PS5 Ultimate', 'bulanan', 'ps5',      30, 2500000, 'All-in-one gaming hub',  JSON.stringify(['PlayStation 5','2 DualSense','Semua Game PS5','PS Plus 1 Bulan','Teknisi on-call']), 0);

  // Seed Inventory
  const insertInv = db.prepare(`INSERT INTO inventory (serial_no, ps_type, name, status, condition) VALUES (?, ?, ?, ?, ?)`);
  insertInv.run('PBX-PS4S-001', 'ps4_slim', 'PS4 Slim - Unit 01', 'available', 'excellent');
  insertInv.run('PBX-PS4S-002', 'ps4_slim', 'PS4 Slim - Unit 02', 'available', 'good');
  insertInv.run('PBX-PS4S-003', 'ps4_slim', 'PS4 Slim - Unit 03', 'rented',    'good');
  insertInv.run('PBX-PS4P-001', 'ps4_pro',  'PS4 Pro - Unit 01',  'available', 'excellent');
  insertInv.run('PBX-PS4P-002', 'ps4_pro',  'PS4 Pro - Unit 02',  'rented',    'excellent');
  insertInv.run('PBX-PS5-001',  'ps5',      'PS5 - Unit 01',      'available', 'excellent');
  insertInv.run('PBX-PS5-002',  'ps5',      'PS5 - Unit 02',      'maintenance','fair');

  // Seed Couriers
  const insertCourier = db.prepare(`
    INSERT INTO couriers (name, phone, email, status, total_deliver, rating, current_lat, current_lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCourier.run('Budi Santoso',   '0812-3456-7890', 'budi@playbox.id',  'active', 142, 4.9, 5.5477, 95.3238);
  insertCourier.run('Siti Rahayu',    '0856-7890-1234', 'siti@playbox.id',  'active', 98,  4.8, 5.5490, 95.3180);
  insertCourier.run('Andi Kurniawan', '0823-4567-8901', 'andi@playbox.id',  'active', 76,  4.7, 5.5460, 95.3250);
  insertCourier.run('Maya Sari',      '0897-6543-2109', 'maya@playbox.id',  'off',    55,  5.0, 5.5500, 95.3200);

  // Seed Sample Order
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_code, user_id, package_id, inventory_id, courier_id, status, payment_method, payment_status, subtotal, total, delivery_address, delivery_lat, delivery_lng, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertOrder.run('PBX-241009-001', 2, 5, 5, 1, 'on_delivery', 'gopay', 'paid', 600000, 615000, 'Jl. Sudirman No.12, Lueng Bata, Banda Aceh', 5.5477, 95.3238, datetime(), addDays(7));
  insertOrder.run('PBX-241009-002', 3, 1, null, null, 'pending', 'cod', 'unpaid', 80000, 95000, 'Jl. Cut Nyak No.5, Kuta Alam, Banda Aceh', 5.5490, 95.3310, null, null);

  // Seed order tracking
  const insertTrack = db.prepare(`INSERT INTO order_tracking (order_id, status, message, lat, lng) VALUES (?, ?, ?, ?, ?)`);
  insertTrack.run(1, 'confirmed',    'Pesanan dikonfirmasi oleh admin',        null,   null);
  insertTrack.run(1, 'preparing',    'Unit PS sedang disiapkan dan dicek',     null,   null);
  insertTrack.run(1, 'on_delivery',  'Kurir Budi Santoso sedang menuju lokasi', 5.5440, 95.3150);

  console.log('✅ Data seed berhasil diisi');
}

function syncReferencePackages(db) {
  const offers = [
    ['Personal 1 Jam', 'personal', 1, '1 Jam', 15000],
    ['Personal 2 Jam', 'personal', 2, '2 Jam', 25000],
    ['Personal 3 Jam', 'personal', 3, '3 Jam', 35000],
    ['Personal 4 Jam', 'personal', 4, '4 Jam', 40000],
    ['Personal 5 Jam', 'personal', 5, '5 Jam', 50000],
    ['Harian Weekday', 'harian', 24, '24 Jam · Weekday', 110000],
    ['Harian Weekend', 'harian', 24, '24 Jam · Weekend', 120000],
    ['Paket Hemat Siang', 'hemat', 4, '13.00–17.00 · 4 Jam', 35000],
    ['Paket Hemat Sore', 'hemat', 6, '17.30–23.30 · 6 Jam', 50000],
    ['Paket Hemat Malam', 'hemat', 9, '00.00–09.00 · 9 Jam', 50000],
  ];
  const legacyNames = [
    'Harian Basic', 'Harian Premium', 'Harian PS5',
    'Mingguan Basic', 'Mingguan Premium', 'Mingguan PS5',
    'Bulanan Basic', 'Bulanan Premium', 'Bulanan PS5 Ultimate',
  ];
  const deactivateLegacy = db.prepare('UPDATE packages SET is_active = 0 WHERE name = ?');
  const find = db.prepare('SELECT id FROM packages WHERE name = ?');
  const update = db.prepare(`
    UPDATE packages SET category='harian', catalog_group=?, ps_type='ps4_slim', duration=?,
      duration_label=?, price=?, description=?, features=?, is_popular=?, is_active=1
    WHERE id=?
  `);
  const insert = db.prepare(`
    INSERT INTO packages (name, category, catalog_group, ps_type, duration, duration_label,
      price, description, features, is_popular)
    VALUES (?, 'harian', ?, 'ps4_slim', ?, ?, ?, ?, ?, ?)
  `);
  const sync = db.transaction(() => {
    legacyNames.forEach(name => deactivateLegacy.run(name));
    for (const [name, group, duration, label, price] of offers) {
      const details = `Sewa PS4 Slim · ${label}`;
      const features = JSON.stringify(['PS4 Slim', '2 Controller', 'Pilih jadwal sesuai paket']);
      const existing = find.get(name);
      if (existing) update.run(group, duration, label, price, details, features, name === 'Harian Weekend' ? 1 : 0, existing.id);
      else insert.run(name, group, duration, label, price, details, features, name === 'Harian Weekend' ? 1 : 0);
    }
  });
  sync();
}

function datetime() { return new Date().toISOString().replace('T',' ').slice(0,19); }
function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().replace('T',' ').slice(0,19);
}

module.exports = { initDb };
