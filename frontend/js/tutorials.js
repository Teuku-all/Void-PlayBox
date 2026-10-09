/* tutorials.js - pemilih video tutorial */
const TUTORIAL_VIDEO_LABELS = {
  ps4: 'PS4 Slim',
  ps5: 'PS5',
  ctrl: 'Pairing Controller',
  net: 'Koneksi WiFi',
};

function showTut(key, el) {
  if (el) {
    document.querySelectorAll('.tut-tab').forEach(tab => tab.classList.remove('active'));
    el.classList.add('active');
  }

  const label = TUTORIAL_VIDEO_LABELS[key] || TUTORIAL_VIDEO_LABELS.ps4;
  document.getElementById('tutContent').innerHTML = `
    <div class="video-card" role="link" tabindex="0" onclick="window.open('https://www.youtube.com/results?search_query='+encodeURIComponent('${label} PlayStation tutorial'),'_blank','noopener,noreferrer')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div class="play-circle">&#9654;</div>
      <div class="video-card-lbl">Tonton Video Tutorial &mdash; ${label}</div>
    </div>`;
}
