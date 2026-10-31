/* nav.js — navigasi pelanggan & admin */
function userScroll(id, el){
  closeSidebar();
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

const adminTitles={dashboard:'Ringkasan operasional',orders:'Manajemen pesanan',inventory:'Inventaris PS4',couriers:'Manajemen kurir',reports:'Laporan & analitik',chat:'Percakapan pelanggan'};
function adminNav(id,el){
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('adm-'+id).classList.add('active');
  document.querySelectorAll('.anav-item').forEach(i=>i.classList.remove('active'));
  const active = el || document.querySelector(`.anav-item[data-section="${id}"]`);
  active?.classList.add('active');
  document.querySelectorAll('.anav-item').forEach(item => item.setAttribute('aria-current', item === active ? 'page' : 'false'));
  document.getElementById('adminTitle').textContent=adminTitles[id]||id;
  if(id==='chat') { loadRooms(); if(admRoom) loadAdminChat(); }
}

let openSidebarId = null, sidebarReturnFocus = null;
function toggleSidebar(role) {
  if (!window.matchMedia('(max-width:768px)').matches) return;
  const id = role === 'admin' ? 'adminSidebar' : 'userSidebar';
  if (openSidebarId === id) return closeSidebar();
  closeSidebar();
  ChatNotifications.closePanel();
  sidebarReturnFocus = document.activeElement;
  openSidebarId = id;
  const sidebar = $(id);
  sidebar.inert = false;
  sidebar.classList.add('sidebar-open');
  sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true');
  $(role === 'admin' ? 'adminMenuBtn' : 'userMenuBtn').setAttribute('aria-expanded', 'true');
  $('sidebarBackdrop').hidden = false;
  document.body.classList.add('sidebar-is-open');
  sidebar.querySelector('button,a[href]')?.focus();
}
function closeSidebar(restoreFocus = true) {
  if (!openSidebarId) return;
  const sidebar = $(openSidebarId);
  sidebar.classList.remove('sidebar-open'); sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal');
  sidebar.inert = window.matchMedia('(max-width:768px)').matches;
  document.querySelectorAll('.mobile-menu-btn').forEach(button => button.setAttribute('aria-expanded', 'false'));
  $('sidebarBackdrop').hidden = true; document.body.classList.remove('sidebar-is-open');
  openSidebarId = null;
  if (restoreFocus) sidebarReturnFocus?.focus({ preventScroll: true });
  sidebarReturnFocus = null;
}
document.addEventListener('DOMContentLoaded', () => {
  function updateSidebarMode() {
    closeSidebar();
    const mobile = window.matchMedia('(max-width:768px)').matches;
    for (const id of ['adminSidebar', 'userSidebar']) $(id).inert = mobile;
  }
  updateSidebarMode();
  window.matchMedia('(max-width:768px)').addEventListener('change', updateSidebarMode);
  document.addEventListener('keydown', event => {
    if (!openSidebarId) return;
    if (event.key === 'Escape') { event.preventDefault(); closeSidebar(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...$(openSidebarId).querySelectorAll('button,a[href],input,select')].filter(el => !el.disabled && el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
});
