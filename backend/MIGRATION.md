# Void Play Box: SQLite → Neon PostgreSQL + Vercel

Paket ini mengganti akses `better-sqlite3` sinkron menjadi query PostgreSQL asynchronous menggunakan `pg`. Gunakan pada branch terpisah terlebih dahulu; jangan menimpa satu-satunya salinan project yang berfungsi.

## Yang diubah

- `config/database.js`: pool PostgreSQL membaca `DATABASE_URL`.
- `config/initDb.js`: skema PostgreSQL dan seed awal idempotent. Urutan pembuatan tabel sudah menempatkan `couriers` sebelum `orders`.
- Controllers, auth middleware, dan route admin: query menggunakan placeholder PostgreSQL (`$1`, `$2`, ...) serta `RETURNING` untuk hasil insert/update.
- `server.js`: tidak lagi menyajikan frontend lokal atau memanggil `app.listen()` pada saat diimpor Vercel.
- `package.json`: menambahkan `pg` dan menghapus `better-sqlite3`.

## Penting tentang data lama

Kode ini membuat skema baru pada database Neon dan mengisi paket, inventaris, kurir, serta admin awal. **Kode ini tidak memindahkan isi `backend/database/playbox.db` yang ada di laptop.** Jika sudah ada akun atau pesanan yang harus dipertahankan, export dan migrasikan data terlebih dahulu sebelum memakai database baru.

## Siapkan Neon

1. Buat project PostgreSQL di Neon.
2. Salin connection string pooled dari dashboard Neon. Jangan commit connection string ke GitHub.
3. Di Vercel project backend, set Environment Variables:
   - `DATABASE_URL` = connection string Neon
   - `JWT_SECRET` = string acak panjang (minimal 32 karakter)
   - `JWT_EXPIRES_IN` = `7d`
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = URL production frontend, misalnya `https://nama-frontend.vercel.app` (tanpa slash di belakang)
   - `ADMIN_EMAIL` = email admin yang akan dipakai
   - `ADMIN_PASSWORD` = password awal admin minimal 12 karakter dan unik
4. Di folder `backend` pada project lokal, jalankan `npm install` agar `package-lock.json` (jika ada) diperbarui sesuai dependency baru, lalu commit `package.json` dan `package-lock.json`.
5. Import repository ke project Vercel backend dan set **Root Directory** ke `backend`.
6. Deploy. Tes `https://DOMAIN-BACKEND-KAMU/api/health`.

Pada database Neon baru, request pertama akan membuat tabel dan seed awal. Jika `users` kosong, `ADMIN_PASSWORD` wajib tersedia supaya admin awal bisa dibuat.

## Hubungkan frontend ke backend

Frontend saat ini menggunakan `const API_BASE = '/api'`. Karena frontend dan backend punya domain berbeda, setelah backend berhasil deploy, buka `frontend/js/api.js` dan ganti nilai itu menjadi:

```js
const API_BASE = 'https://DOMAIN-BACKEND-KAMU/api';
```

Ganti domain contoh dengan domain backend Vercel yang sebenarnya, commit, lalu push ke branch production frontend supaya Vercel redeploy otomatis. Pastikan `FRONTEND_URL` pada backend sama persis dengan origin frontend tersebut.

## Catatan

- Akun demo lama dengan password tetap `admin123` dan `user123` sengaja tidak dibuat otomatis. Pakai `ADMIN_EMAIL`/`ADMIN_PASSWORD` yang kamu tetapkan.
- Ini merupakan paket migrasi awal untuk database Neon baru. Jalankan smoke test login/register, daftar paket, create order, update status, chat, admin users, inventaris, kurir, dan statistik sebelum mengandalkan deployment untuk data nyata.
- Jika ingin mempertahankan isi SQLite lama, jangan menghapus file `.db`; proses ekspor/import merupakan langkah terpisah.
