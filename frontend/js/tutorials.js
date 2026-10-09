/* tutorials.js — konten tutorial + renderer */
const TUTORIALS = {
  ps4:[
    {num:1,title:'Unboxing & Cek Kelengkapan',desc:'Pastikan semua komponen tersedia: unit PS4, kabel power, kabel HDMI, 2 controller, dan kabel USB charger. Jika ada yang kurang, segera hubungi tim Void Play Box.',img:'📦',tip:'📸 Foto kondisi barang saat diterima sebagai dokumentasi.'},
    {num:2,title:'Hubungkan Kabel HDMI ke TV',desc:'Colokkan ujung kabel HDMI ke port di belakang PS4. Ujung satunya ke port HDMI IN di TV. Pilih input yang sesuai di remote TV (biasanya HDMI 1 atau HDMI 2).',img:'📺',tip:'📺 Tidak muncul gambar? Coba port HDMI lainnya di TV.'},
    {num:3,title:'Sambungkan Kabel Power & Hidupkan',desc:'Colokkan kabel power ke PS4 dan ke stopkontak. Tekan tombol power di depan unit — akan terdengar bunyi "beep" sekali tanda PS menyala.',img:'🔌',tip:'⚡ Gunakan stabilizer jika tegangan listrik tidak stabil.'},
    {num:4,title:'Pairing Controller via USB',desc:'Colokkan controller ke PS4 menggunakan kabel USB Micro-B. Tekan tombol PS (logo PlayStation). Lampu LED controller berubah biru — controller siap dipakai!',img:'🎮',tip:'💡 Setelah pairing pertama, controller bisa konek wireless otomatis.'},
    {num:5,title:'Setup Awal & Login Akun',desc:'Ikuti panduan di layar: pilih bahasa, atur tanggal & waktu, lalu masuk ke akun PlayStation Network (PSN) — detail login ada di dalam kotak paket Void Play Box.',img:'⚙️',tip:'🔒 Jangan ubah password akun PSN yang kami sediakan ya!'},
    {num:6,title:'Selesai — Siap Main!',desc:'PS4 sudah siap. Pilih game dari menu Home atau masukkan disc. Tekan tombol PS kapan saja untuk kembali ke menu utama. Selamat bermain!',img:'🏆',tip:'💬 Butuh bantuan? Hubungi kami via Live Chat kapan saja.'},
  ],
  ps5:[
    {num:1,title:'Unboxing PS5',desc:'Cek kelengkapan: unit PS5, 2 DualSense controller (dari Void Play Box), kabel HDMI 2.1, kabel power, dan USB-C cable. PS5 butuh TV dengan port HDMI 2.1 untuk resolusi terbaik.',img:'📦',tip:'🌬️ PS5 butuh ruang ventilasi — jangan ditaruh di ruang tertutup.'},
    {num:2,title:'Pasang Stand (Vertikal/Horizontal)',desc:'PS5 bisa dipasang vertikal maupun horizontal. Untuk vertikal, kencangkan stand di bagian bawah. Untuk horizontal, gunakan kaki pendeknya. Pilih sesuai ruangan.',img:'📐',tip:'↕️ Posisi vertikal lebih baik untuk sirkulasi udara.'},
    {num:3,title:'Sambungkan HDMI & Power',desc:'Pasang kabel HDMI 2.1 ke PS5 dan TV. Colokkan kabel power. Tekan tombol power — PS5 akan menyala dengan suara khas yang keren.',img:'🔌',tip:'🎬 Gunakan port HDMI 4K di TV untuk kualitas gambar terbaik.'},
    {num:4,title:'Pairing DualSense & Setup',desc:'Sambungkan DualSense via USB-C, tekan tombol PS. Ikuti setup awal di layar — mudah dan cepat. Setelah pairing, controller bisa digunakan wireless.',img:'🎮',tip:'🎯 DualSense punya haptic feedback dan adaptive trigger — rasakan bedanya!'},
  ],
  ctrl:[
    {num:1,title:'Reset Controller (jika bermasalah)',desc:'Gunakan pin kecil atau klip kertas untuk menekan tombol RESET di belakang controller (lubang kecil dekat L2). Tahan 3–5 detik. Lakukan ini hanya jika controller tidak bisa dipair.',img:'🔄',tip:'📌 Tombol reset sangat kecil, gunakan ujung klip kertas.'},
    {num:2,title:'Pairing via Kabel USB',desc:'Sambungkan controller ke PS via kabel USB (Micro-B untuk PS4, USB-C untuk PS5). Tekan tombol PS. Lampu LED menyala — controller langsung terhubung.',img:'🔌',tip:'🔋 Kabel USB ada di dalam paket Void Play Box.'},
    {num:3,title:'Konek Wireless Otomatis',desc:'Setelah pernah dipair via kabel, controller bisa konek wireless otomatis. Tekan tombol PS dan tunggu lampu berkedip lalu menyala solid — siap dipakai!',img:'📡',tip:'📶 Jangkauan wireless sekitar 10 meter dari unit PS.'},
    {num:4,title:'Charge Controller',desc:'Charge via kabel USB saat PS menyala atau mode standby. Lampu LED oranye berkedip saat charging, dan padam saat penuh. Waktu charge sekitar 2 jam.',img:'🔋',tip:'🕹️ Bisa main sambil charge menggunakan kabel yang tersedia!'},
  ],
  net:[
    {num:1,title:'Buka Pengaturan Jaringan',desc:'Dari menu Home, pilih Settings → Network → Set Up Internet Connection. Pilih WiFi atau LAN (kabel lebih stabil untuk gaming online).',img:'⚙️',tip:'🔌 Koneksi LAN menggunakan kabel ethernet untuk stabilitas terbaik.'},
    {num:2,title:'Pilih WiFi & Masukkan Password',desc:'Pilih nama WiFi rumahmu dari daftar yang muncul. Masukkan password WiFi. PS akan mencoba terhubung — jika berhasil, muncul tanda centang hijau.',img:'📶',tip:'📡 Pastikan kamu dekat router saat setup untuk sinyal kuat.'},
    {num:3,title:'Test Koneksi Internet',desc:'Pilih Test Internet Connection untuk verifikasi. Kamu akan melihat kecepatan download & upload, serta status PlayStation Network.',img:'🌐',tip:'⚡ Butuh minimal 5 Mbps untuk gaming online yang lancar.'},
    {num:4,title:'Login PlayStation Network',desc:'Masuk ke akun PSN yang sudah disiapkan Void Play Box (detail di dalam kotak). Dengan PSN aktif, kamu bisa main game online dan update game.',img:'🔑',tip:'🔒 Jangan ganti password atau data akun PSN Void Play Box ya!'},
  ]
};

function showTut(key,el){
  if(el){document.querySelectorAll('.tut-tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');}
  const steps=TUTORIALS[key]||TUTORIALS.ps4;
  document.getElementById('tutContent').innerHTML=`
    <div>${steps.map(s=>`
      <div class="tut-step">
        <div class="tut-num">${s.num}</div>
        <div class="tut-body">
          <div class="tut-step-title">${s.title}</div>
          <div class="tut-step-desc">${s.desc}</div>
          <div class="tut-tip">${s.tip}</div>
        </div>
        <div class="tut-img">${s.img}</div>
      </div>`).join('')}
    </div>
    <div class="video-card" onclick="toast('▶️ Video tutorial dimuat...','success')">
      <div class="play-circle">▶</div>
      <div class="video-card-lbl">Tonton Video Tutorial — ${steps[0].title}</div>
    </div>`;
}
