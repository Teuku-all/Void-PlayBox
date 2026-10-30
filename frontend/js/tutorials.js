/* On-page PS4 guides for the offline rental setup. */
const PS4_GUIDES = {
  ps4: {
    title: 'Pasang PS4 ke TV', intro: 'Siapkan TV dengan port HDMI dan stopkontak di dekat konsol.',
    steps: [
      ['Sambungkan kabel HDMI', 'Hubungkan port HDMI OUT pada PS4 ke port HDMI di TV.'],
      ['Pasang kabel daya', 'Pastikan kabel daya terpasang dengan benar, lalu sambungkan ke stopkontak. Letakkan PS4 di tempat dengan sirkulasi udara yang cukup.'],
      ['Pilih sumber gambar di TV', 'Nyalakan TV dan pilih input HDMI yang sesuai dengan port yang digunakan.'],
      ['Nyalakan konsol', 'Tekan tombol daya PS4. Tunggu sampai menu utama tampil, lalu sambungkan controller.'],
    ],
    note: 'Konsol khusus untuk bermain offline. Gunakan pengaturan yang sudah disiapkan oleh admin.',
  },
  ctrl: {
    title: 'Sambungkan controller', intro: 'Gunakan kabel USB yang disertakan untuk menghubungkan controller ke konsol.',
    steps: [
      ['Hubungkan dengan kabel USB', 'Sambungkan controller ke salah satu port USB pada PS4 menggunakan kabel yang disertakan.'],
      ['Tekan tombol PS', 'Tekan tombol berlogo PlayStation di tengah controller, lalu pilih pengguna yang tersedia di konsol.'],
      ['Sambungkan controller kedua', 'Ulangi langkah yang sama untuk controller kedua jika ingin bermain bersama pada game yang mendukung dua pemain.'],
      ['Periksa sebelum bermain', 'Pastikan tombol merespons di menu. Jika controller belum tersambung, periksa kabel atau hubungi admin.'],
    ],
    note: 'Dua controller disertakan dalam paket. Jumlah pemain mengikuti mode lokal yang tersedia pada masing-masing game.',
  },
  games: {
    title: 'Mulai sesi bermainmu', intro: 'Pilih dari game yang sudah terpasang pada konsol PS4.',
    steps: [
      ['Pilih game di menu utama', 'Gunakan tombol arah untuk memilih game yang ingin dimainkan, lalu tekan X untuk membukanya.'],
      ['Gunakan mode offline', 'Pilih mode cerita, pertandingan lokal, atau mode offline lain yang tersedia pada game.'],
      ['Main sendiri atau bersama', 'Untuk bermain berdua di TV yang sama, pilih mode lokal dua pemain jika game mendukungnya.'],
      ['Matikan PS4 dengan benar', 'Setelah selesai, simpan permainan lalu buka menu daya dan pilih Matikan PS4. Tunggu lampu konsol padam sebelum mencabut kabel.'],
    ],
    note: 'Jangan mengubah akun, menghapus game, atau memperbarui sistem konsol. Hubungi admin jika ada kendala saat membuka game.',
  },
};

function showTut(key, el) {
  const activeKey = PS4_GUIDES[key] ? key : 'ps4';
  document.querySelectorAll('.tut-tab').forEach(tab => {
    const active = tab === el || (!el && tab.getAttribute('onclick').includes(`'${activeKey}'`));
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  const guide = PS4_GUIDES[activeKey];
  document.getElementById('tutContent').innerHTML = `
    <div class="ps4-guide">
      <div class="ps4-guide-heading"><span class="section-kicker">Panduan singkat</span><h3>${guide.title}</h3><p>${guide.intro}</p></div>
      <ol class="ps4-guide-steps">${guide.steps.map(([title, text], i) => `<li><span class="ps4-step-number" aria-hidden="true">0${i + 1}</span><div><h4>${title}</h4><p>${text}</p></div></li>`).join('')}</ol>
      <div class="ps4-guide-note"><p>${guide.note}</p><button type="button" class="btn-sm" onclick="userScroll('chat-sec')">Tanya admin ↗</button></div>
    </div>`;
}
