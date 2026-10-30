/* nav.js — navigasi pelanggan & admin */
function userScroll(id, el){
  const el2 = document.getElementById(id);
  if(el2) el2.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  const activeLink = el || document.querySelector(`.bottom-nav a[href="#${id}"]`);
  if(activeLink){document.querySelectorAll('.bottom-nav .nav-link').forEach(n=>{n.classList.remove('active');n.removeAttribute('aria-current');});activeLink.classList.add('active');activeLink.setAttribute('aria-current','location');}
}

// Keep the mobile navigation in step with the section being read.
document.addEventListener('DOMContentLoaded', () => {
  const sections = [...document.querySelectorAll('#userScreen > section[id]')];
  let ticking = false;
  function syncNavigation() {
    ticking = false;
    if (!document.getElementById('userScreen').classList.contains('active')) return;
    const current = sections.filter(s => s.getBoundingClientRect().top <= window.innerHeight * .35).pop();
    const id = current?.id || 'home';
    // Game browsing belongs to the home experience.
    const target = id === 'games' ? 'home' : id;
    document.querySelectorAll('.bottom-nav .nav-link').forEach(link => {
      const active = link.getAttribute('href') === '#' + target;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(syncNavigation); }
  }, { passive: true });
});

const adminTitles={dashboard:'Dashboard Overview',orders:'Manajemen Pesanan',inventory:'Inventaris Unit PS',couriers:'Manajemen Kurir',reports:'Laporan & Analitik',chat:'Live Chat Pelanggan'};
function adminNav(id,el){
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('adm-'+id).classList.add('active');
  document.querySelectorAll('.anav-item').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('adminTitle').textContent=adminTitles[id]||id;
  if(id==='chat') loadRooms();
}
