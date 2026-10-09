/* nav.js — navigasi pelanggan & admin */
function userScroll(id, el){
  const el2 = document.getElementById(id);
  if(el2) el2.scrollIntoView({behavior:'smooth'});
  if(el){document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active'));el.classList.add('active');}
}

const adminTitles={dashboard:'Dashboard Overview',orders:'Manajemen Pesanan',inventory:'Inventaris Unit PS',couriers:'Manajemen Kurir',reports:'Laporan & Analitik',chat:'Live Chat Pelanggan'};
function adminNav(id,el){
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('adm-'+id).classList.add('active');
  document.querySelectorAll('.anav-item').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('adminTitle').textContent=adminTitles[id]||id;
  if(id==='chat') loadRooms();
}
