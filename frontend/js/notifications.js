/* In-app unread inbox plus opt-in device alerts while this site is open. */
const ChatNotifications = (() => {
  let timer = null, epoch = 0, busy = false, owner = null, initialized = false, cursor = 0;
  let unread = [], total = 0, panelTrigger = null, bannerTimer = null;
  const readThrough = new Map(), reading = new Set();
  const baseTitle = document.title;
  const storageKey = suffix => `pbx_chat_${owner}_${suffix}`;
  function stored(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function store(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* Memory state remains available. */ } }
  function active(room) {
    if (!owner || document.visibilityState !== 'visible' || !document.hasFocus()) return false;
    if (document.body.classList.contains('sidebar-is-open') || document.querySelector('.booking-panel.open,.modal-ov.open')) return false;
    const admin = Session.user?.role === 'admin';
    const rect = $(admin ? 'admChatMsgs' : 'chatMsgs').getBoundingClientRect();
    const visible = rect.top < innerHeight - 40 && rect.bottom > 100 && rect.width > 0;
    if (admin) return visible && $('adminScreen').classList.contains('active') && $('adm-chat').classList.contains('active') && admRoom === room;
    return visible && room === `user_${Session.user?.id}` && $('userScreen').classList.contains('active');
  }
  function atBottom(box) { return box.scrollHeight - box.scrollTop - box.clientHeight < 90; }
  function render() {
    document.querySelectorAll('.notification-bell').forEach(button => button.setAttribute('aria-label', total ? `Notifikasi chat, ${total} pesan belum dibaca` : 'Notifikasi chat'));
    document.querySelectorAll('.notification-count,.user-chat-badge').forEach(el => { el.hidden = !total; el.textContent = total > 99 ? '99+' : total; });
    $('chatBadge').style.display = total ? '' : 'none'; $('chatBadge').textContent = total > 99 ? '99+' : total;
    $('adminUnreadCount').textContent = total ? `${total} pesan belum dibaca` : 'Semua pesan sudah dibaca';
    $('notificationSummary').textContent = total ? `${total} pesan belum dibaca` : 'Belum ada pesan baru';
    document.title = total ? `(${total}) ${baseTitle}` : baseTitle;
    const html = unread.length ? unread.map(m => `<button class="notification-item" type="button" data-room="${esc(m.room_id)}"><span class="notification-avatar">${esc((m.sender_name || 'P').charAt(0).toUpperCase())}</span><span><strong>${esc(m.sender_name || 'Pesan baru')}</strong><span class="notification-preview">${esc(m.message)}</span><small>Buka percakapan</small></span><i aria-hidden="true"></i></button>`).join('') : `<div class="notification-empty"><span>${icon('check-circle')}</span><strong>Semua pesan sudah dibaca.</strong><p>Pesan baru akan muncul di sini.</p></div>`;
    if ($('notificationList').innerHTML !== html) $('notificationList').innerHTML = html;
    updatePermission();
  }
  function updatePermission(message) {
    const btn = $('enableNotificationsBtn'), status = $('notificationPermissionStatus');
    if (!('Notification' in window) || !window.isSecureContext) { btn.disabled = true; status.textContent = 'Notifikasi perangkat tidak tersedia pada browser ini. Badge dan notifikasi di situs tetap aktif.'; return; }
    const enabled = stored(storageKey('device')) === '1' && Notification.permission === 'granted';
    btn.disabled = Notification.permission === 'denied';
    btn.textContent = enabled ? 'Matikan notifikasi perangkat' : 'Aktifkan notifikasi perangkat';
    status.textContent = message || (Notification.permission === 'denied' ? 'Izin ditolak. Ubah izin notifikasi di pengaturan browser untuk mengaktifkannya.' : enabled ? 'Aktif selama situs masih terbuka. Isi pesan tidak ditampilkan di notifikasi perangkat.' : 'Izinkan notifikasi perangkat untuk pemberitahuan saat situs masih terbuka.');
  }
  async function enableDevice() {
    if (!owner || !('Notification' in window) || !window.isSecureContext) return updatePermission();
    if (stored(storageKey('device')) === '1' && Notification.permission === 'granted') { store(storageKey('device'), '0'); return updatePermission(); }
    const currentOwner = owner;
    try {
      const permission = await Notification.requestPermission();
      if (currentOwner !== owner) return;
      store(storageKey('device'), permission === 'granted' ? '1' : '0'); updatePermission();
    } catch { updatePermission('Browser belum bisa mengaktifkan notifikasi perangkat. Notifikasi di situs tetap tersedia.'); }
  }
  function announce(messages) {
    const latest = messages[0];
    $('notificationLive').innerHTML = `<button type="button" class="new-chat-banner"><span>${icon('message-circle')}</span><span><strong>${messages.length > 1 ? messages.length + ' pesan baru' : 'Pesan dari ' + esc(latest.sender_name || 'percakapanmu')}</strong><small>Buka percakapan</small></span></button>`;
    $('notificationLive').querySelector('button').onclick = () => open(latest.room_id);
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { $('notificationLive').innerHTML = ''; }, 8000);
    if ('Notification' in window && Notification.permission === 'granted' && stored(storageKey('device')) === '1') {
      try {
        const notification = new Notification('Void Play Box · Pesan baru', { body: 'Ada pesan baru untukmu. Buka percakapan di Void Play Box.', icon: 'assets/void-play-box.png', tag: 'pbx-chat-' + owner });
        const currentOwner = owner;
        notification.onclick = () => { if (currentOwner === owner) { window.focus(); open(latest.room_id); } notification.close(); };
      } catch { updatePermission('Browser ini belum mendukung pemberitahuan perangkat melalui halaman. Notifikasi di situs tetap aktif.'); }
    }
  }
  async function poll() {
    if (!owner || busy || !Session.token) return;
    busy = true; const generation = epoch;
    try {
      const data = await api.get('/chat/notifications');
      if (generation !== epoch) return;
      unread = data.messages || []; total = Number(data.total) || 0;
      const sharedCursor = Math.max(cursor, Number(stored(storageKey('cursor'))) || 0);
      const highest = Math.max(sharedCursor, ...unread.map(m => Number(m.id) || 0));
      const fresh = unread.filter(m => Number(m.id) > sharedCursor && !active(m.room_id));
      if (initialized && fresh.length) announce(fresh);
      cursor = highest; store(storageKey('cursor'), cursor); initialized = true; render();
    } catch {
      if (generation === epoch) $('notificationSummary').textContent = 'Belum bisa memeriksa pesan. Mencoba kembali secara otomatis.';
    }
    finally { if (generation === epoch) busy = false; }
  }
  async function ack(room, messages, box) {
    if (!active(room) || !atBottom(box) || box.getBoundingClientRect().bottom > innerHeight + 4 || reading.has(room)) return;
    const incoming = Session.user?.role === 'admin' ? 'user' : 'admin';
    const ids = messages.filter(m => m.sender_role === incoming && !Number(m.is_read)).map(m => Number(m.id)).filter(Number.isSafeInteger);
    const last = Math.max(0, ...ids);
    if (!last || last <= (readThrough.get(room) || 0)) return;
    reading.add(room); const generation = epoch;
    try {
      await api.put(`/chat/${encodeURIComponent(room)}/read`, { through_id: last });
      if (generation !== epoch) return;
      readThrough.set(room, last);
      // Clear immediately, then reconcile with the server (which may have newer messages).
      const removed = unread.filter(m => m.room_id === room && Number(m.id) <= last).length;
      unread = unread.filter(m => m.room_id !== room || Number(m.id) > last); total = Math.max(0, total - removed); render();
      poll();
      if (Session.user?.role === 'admin') loadRooms();
    } catch { /* A later visible-chat refresh will retry acknowledgment. */ }
    finally { if (generation === epoch) reading.delete(room); }
  }
  function start() {
    stop(); owner = String(Session.user?.id || ''); if (!owner) return;
    cursor = Number(stored(storageKey('cursor'))) || 0;
    poll(); timer = setInterval(poll, 7000);
  }
  function stop() {
    ++epoch; clearInterval(timer); clearTimeout(bannerTimer); timer = null; busy = false; owner = null; initialized = false; cursor = 0; unread = []; total = 0; reading.clear(); readThrough.clear();
    closePanel(); $('notificationLive').innerHTML = ''; render();
  }
  function closePanel() {
    $('notificationPanel').hidden = true;
    document.querySelectorAll('.notification-bell').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function togglePanel(button) {
    if (!$('notificationPanel').hidden) { closePanel(); return; }
    closeSidebar(); panelTrigger = button;
    $('notificationPanel').hidden = false; button.setAttribute('aria-expanded', 'true');
    $('notificationPanel').querySelector('button').focus(); poll();
  }
  function open(room) {
    if (!/^user_\d+$/.test(room)) return;
    closePanel(); $('notificationLive').innerHTML = '';
    if (Session.user?.role === 'admin') { adminNav('chat'); openRoom(room); }
    else if (room === `user_${Session.user?.id}`) { userScroll('chat-sec'); requestAnimationFrame(() => loadChat()); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('notificationList').addEventListener('click', e => { const button = e.target.closest('[data-room]'); if (button) open(button.dataset.room); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('notificationPanel').hidden) { closePanel(); panelTrigger?.focus(); } });
    document.addEventListener('click', e => { if (!e.target.closest('.notification-panel,.notification-bell')) closePanel(); });
    const sync = () => {
      if (!owner) return;
      poll();
      if (Session.user?.role === 'admin' && admRoom && active(admRoom)) loadAdminChat();
      else if (Session.user?.role === 'user' && active(`user_${Session.user.id}`)) loadChat();
    };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    let pending = false;
    window.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; if (owner && Session.user?.role === 'user' && active(`user_${Session.user.id}`)) loadChat(); }); } }, { passive: true });
  });
  return { start, stop, poll, ack, active, atBottom, togglePanel, closePanel, enableDevice, open };
})();
