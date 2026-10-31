# Void Play Box untuk Android

Aplikasi Android berbasis WebView yang membuka **https://voidplaybox.vercel.app/**.
Frontend online sudah dibandingkan dengan `frontend/index.html` lokal saat dibuat dan isinya sama.
Backend tetap menggunakan layanan web yang sudah ada; tidak ada database atau password server di APK.

## Memasang APK percobaan

1. Salin `dist/VoidPlayBox-1.0.0-debug.apk` ke HP Android 8.0 atau lebih baru.
2. Buka file tersebut dan, jika diminta Android, izinkan pemasangan dari aplikasi pengelola file yang digunakan.
3. Buka **Void Play Box**, lalu masuk dengan email dan password akun web.
4. Izin lokasi hanya diminta ketika menggunakan fitur lokasi. Jika ditolak, alamat/pin masih bisa diisi manual.

APK debug ditandatangani dengan kunci pengembangan lokal dan ditujukan untuk uji pemasangan langsung.
Untuk distribusi resmi, buat release bertanda tangan memakai kunci milik pemilik aplikasi melalui Android Studio
(Build > Generate Signed App Bundle or APK). Simpan kunci dan password di luar Git.
Jangan gunakan kunci debug untuk rilis publik. Android hanya mengizinkan update langsung jika application ID
dan sertifikat penandatanganan cocok. Melepas aplikasi debug akan menghapus sesi login lokal.

## Perilaku dan batasan

- Membutuhkan internet. Logo, menu Android, serta layar gagal koneksi disertakan di APK; halaman web dimuat online.
- Perubahan di folder `frontend` perlu dideploy ke domain web sebelum terlihat di aplikasi.
- Login, booking, dashboard, chat, dan peta menggunakan halaman web yang sama.
- Menu ⋮ menyediakan muat ulang, buka browser, dan informasi aplikasi.
- Tombol kembali Android menelusuri riwayat halaman, lalu menutup aplikasi jika sudah di halaman awal.
- Tautan WhatsApp, Google Maps, telepon, dan email dibuka melalui aplikasi yang tersedia di HP.
- Lokasi hanya tersedia untuk origin HTTPS Playbox dan memerlukan izin Android. Tidak ada izin lokasi latar belakang.
- Login Google **belum terintegrasi secara native**. Google Identity Services tidak mendukung login dalam WebView;
  gunakan email/password di APK, atau menu buka browser untuk menggunakan login Google di browser.
  Sesi browser tidak dipindahkan ke aplikasi.
- Badge dan pesan chat di dalam halaman tetap mengikuti web. **Belum ada push notification saat aplikasi ditutup**,
  dan Web Notifications tidak dijamin tersedia dalam WebView.
- Aplikasi hanya memuat origin web Playbox di WebView. Tautan lokal, HTTP, JavaScript, dan arbitrary Android intent diblokir.
- APK belum diuji pada HP/emulator; lakukan pemeriksaan perangkat di bawah sebelum dibagikan.

## Build ulang

Gunakan Android Studio, atau JDK 17–24, Android SDK Platform 35, Build Tools 35.0.0, dan Gradle Wrapper yang disertakan.
Gradle 8.14.5 mendukung JDK 24 yang tersedia pada laptop saat build pertama.

```powershell
cd android
# Jika memakai SDK lain, isi sdk.dir di local.properties sesuai lokasi SDK sendiri.
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

Output standar: `app/build/outputs/apk/debug/app-debug.apk`.
Untuk membuat ulang salinan bernama jelas di `dist`, jalankan:

```powershell
.\build-apk.ps1
```

URL web dikonfigurasi melalui `WEB_URL` di `app/build.gradle`. Jika domain berubah,
perbarui konfigurasi tersebut dan build ulang APK. Pastikan origin frontend juga diizinkan oleh backend.

SDK lokal saat build awal: `C:/Users/talju/.cache/playbox-android/sdk`.
`local.properties`, hasil build, dan kunci penandatanganan diabaikan Git.

## Pemeriksaan perangkat

- Pasang dan buka APK; cek logo, tampilan login, keyboard, rotasi, dan tombol kembali.
- Masuk dengan email/password akun uji; tutup/buka aplikasi untuk memeriksa sesi, lalu logout.
- Periksa paket dan booking memakai akun uji; jangan membuat transaksi nyata untuk pengujian.
- Uji lokasi diizinkan, lokasi perkiraan, ditolak, dan ditolak permanen; cek pengisian alamat manual.
- Buka tautan WhatsApp dan Maps; pastikan aplikasi luar terbuka dan kembali ke APK masih berfungsi.
- Matikan internet, muat ulang, lalu hidupkan kembali dan tekan Coba lagi.
- Cek chat dan dashboard memakai akun uji dengan hak akses yang sesuai.

Referensi:
- [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview)
- [Batasan browser Google Identity Services](https://developers.google.com/identity/gsi/web/guides/supported-browsers)
