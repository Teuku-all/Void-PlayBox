# Void Play Box — Platform Sewa PlayStation

Frontend vanilla HTML/CSS/JavaScript dengan API Node.js, Express, SQLite, dan autentikasi JWT. Peta menggunakan Leaflet, OpenStreetMap, dan OSRM tanpa API key.

## Struktur proyek

```text
backend/
  config/       database.js, initDb.js
  controllers/  auth, package, order, map, chat, inventory, courier
  middleware/  auth.js, errorHandler.js
  routes/       index.js
  server.js
  .env.example
frontend/
  index.html
  css/style.css
  js/           api, auth, user, admin, nav, ui, tutorials
```

## Menjalankan

Gunakan Node.js 18 atau lebih baru.

```bash
cd backend
cp .env.example .env
```

Isi `JWT_SECRET` di `.env` dengan string acak yang panjang, lalu jalankan:

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Jalankan melalui server ini agar frontend dapat mengakses `/api`.

Akun demo: `admin@playbox.id / admin123` dan `user@playbox.id / user123`.

Database SQLite dibuat otomatis di `backend/database/playbox.db` beserta tabel dan data demo saat server pertama kali berjalan.

## Catatan

- Pembayaran belum terhubung dengan payment gateway; status pembayarannya dikelola admin.
- Lokasi kurir di endpoint peta masih berupa simulasi. Aplikasi kurir dapat memperbarui lokasi melalui `PUT /api/maps/courier/:courierId/location`.
- `npm run db:init` menjalankan inisialisasi database secara langsung.
