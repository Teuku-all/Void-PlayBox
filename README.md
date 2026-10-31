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

Untuk mengaktifkan masuk/daftar dengan Google, buat OAuth Client ID bertipe **Web application** di Google Cloud Console, tambahkan domain frontend ke Authorized JavaScript origins (misalnya `http://localhost:3000`), lalu isi `GOOGLE_CLIENT_ID` di `.env`. Tanpa Client ID, formulir email/password tetap bisa digunakan dan tombol Google akan menampilkan bahwa fitur belum dikonfigurasi.

Buka http://localhost:3000. Jalankan melalui server ini agar frontend dapat mengakses `/api`.

Akun demo: `admin@playbox.id / admin123` dan `user@playbox.id / user123`.

Database SQLite dibuat otomatis di `backend/database/playbox.db` beserta tabel dan data demo saat server pertama kali berjalan.

## Catatan

- Void Play Box menyediakan konsol keluarga PS4 untuk bermain offline. Katalog dan penambahan unit dibatasi ke PS4; data historis konsol lain tetap dipertahankan. Panduan pelanggan mencakup pemasangan PS4, controller, dan mode permainan offline.
- Menu Pengiriman dan formulir booking memiliki tombol **Gunakan lokasi saya**. Browser mengambil satu titik GPS setelah pengguna memberi izin (memerlukan HTTPS atau localhost). Titik dapat disesuaikan dengan mengetuk peta atau menggeser pin pada formulir booking.
- Titik pilihan dikirim saat booking dikonfirmasi, atau melalui **Simpan titik ke pesanan** untuk pesanan milik pengguna yang masih `pending`, `confirmed`, atau `preparing`. Lokasi tidak dipantau terus-menerus. Detail admin menampilkan pin tujuan, koordinat, dan tautan rute Google Maps.
- Perubahan titik pesanan menggunakan endpoint terautentikasi `PUT /api/orders/:id/location` dan dicatat pada riwayat pesanan. Deploy frontend dan backend bersama agar endpoint tersedia; tidak perlu migrasi database karena kolom koordinat sudah ada.
- Dashboard admin memiliki ringkasan tindakan, statistik, grafik, dan pesanan terbaru. Di mobile, navigasi admin maupun pelanggan menggunakan sidebar dengan tombol menu, penutup, dan dukungan tombol Escape.
- Chat memiliki badge jumlah pesan belum dibaca, panel notifikasi, dan pemberitahuan di halaman. Pesan baru diperiksa sekitar setiap 7 detik selama situs terbuka. Notifikasi perangkat bersifat opsional melalui tombol **Aktifkan notifikasi perangkat**, memerlukan HTTPS/localhost dan dukungan browser. Ini bukan Web Push: notifikasi tidak dikirim setelah situs ditutup, dan browser dapat menunda pemeriksaan pada tab latar belakang.
- `GET /api/chat/notifications` hanya mengembalikan pesan masuk yang belum dibaca untuk penerima. `GET /api/chat/:room_id/messages` tidak lagi menandai pesan sebagai dibaca; `PUT /api/chat/:room_id/read` menerima `through_id` setelah percakapan terlihat. Deploy frontend dan backend bersamaan untuk kontrak API ini. Batas permintaan API umum disesuaikan untuk polling; pembatasan percobaan login tetap berlaku.
- Pemeriksaan backend: jalankan `node --test tests/location.test.js tests/ps4.test.js tests/chat.test.js` dari direktori `backend`.

- Pembayaran belum terhubung dengan payment gateway; status pembayarannya dikelola admin.
- Lokasi kurir di endpoint peta masih berupa simulasi. Aplikasi kurir dapat memperbarui lokasi melalui `PUT /api/maps/courier/:courierId/location`.
- `npm run db:init` menjalankan inisialisasi database secara langsung.
