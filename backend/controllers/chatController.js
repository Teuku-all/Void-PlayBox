const { getDb } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');

// room_id format: "user_{userId}". Pelanggan hanya boleh mengakses room miliknya; admin boleh semua.
function canAccess(req, room_id) {
  return req.user.role === 'admin' || room_id === `user_${req.user.id}`;
}

// ── Get Messages ──────────────────────────────────────────
function getMessages(req, res, next) {
  try {
    const { room_id } = req.params;
    if (!canAccess(req, room_id)) return fail(res, 'Akses ditolak.', 403);
    const { limit = 50, before } = req.query;
    const db = getDb();

    let sql = `
      SELECT cm.*, u.name AS sender_name, u.avatar AS sender_avatar
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.room_id = ?
    `;
    const params = [room_id];
    if (before) { sql += ' AND cm.id < ?'; params.push(before); }
    sql += ' ORDER BY cm.id DESC LIMIT ?';
    params.push(parseInt(limit));

    const messages = db.prepare(sql).all(...params).reverse();

    // Tandai pesan lawan bicara sebagai sudah dibaca
    const otherRole = req.user.role === 'admin' ? 'user' : 'admin';
    db.prepare('UPDATE chat_messages SET is_read = 1 WHERE room_id = ? AND sender_role = ?').run(room_id, otherRole);

    return ok(res, { messages });
  } catch (err) { next(err); }
}

// ── Send Message ──────────────────────────────────────────
function sendMessage(req, res, next) {
  try {
    const { room_id } = req.params;
    if (!canAccess(req, room_id)) return fail(res, 'Akses ditolak.', 403);
    const { message } = req.body;
    if (!message || !message.trim()) return fail(res, 'Pesan tidak boleh kosong.');
    if (message.length > 1000) return fail(res, 'Pesan maksimal 1000 karakter.');

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO chat_messages (room_id, sender_id, sender_role, message)
      VALUES (?, ?, ?, ?)
    `).run(room_id, req.user.id, req.user.role, message.trim());

    const msg = db.prepare(`
      SELECT cm.*, u.name AS sender_name FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id WHERE cm.id = ?
    `).get(result.lastInsertRowid);

    return ok(res, { message: msg }, 'Pesan terkirim.', 201);
  } catch (err) { next(err); }
}

// ── Get Chat Rooms (admin: semua room, user: room sendiri) ─
function getRooms(req, res, next) {
  try {
    const db = getDb();
    let rooms;
    if (req.user.role === 'admin') {
      rooms = db.prepare(`
        SELECT room_id,
               MAX(created_at) AS last_at,
               SUM(CASE WHEN is_read = 0 AND sender_role = 'user' THEN 1 ELSE 0 END) AS unread,
               (SELECT message FROM chat_messages c2 WHERE c2.room_id = cm.room_id ORDER BY id DESC LIMIT 1) AS last_message,
               (SELECT u.name FROM chat_messages c3 JOIN users u ON c3.sender_id = u.id WHERE c3.room_id = cm.room_id AND c3.sender_role = 'user' LIMIT 1) AS user_name
        FROM chat_messages cm GROUP BY room_id ORDER BY last_at DESC
      `).all();
    } else {
      const room_id = `user_${req.user.id}`;
      const unread  = db.prepare("SELECT COUNT(*) AS c FROM chat_messages WHERE room_id = ? AND is_read = 0 AND sender_role = 'admin'").get(room_id);
      const lastMsg = db.prepare('SELECT message, created_at FROM chat_messages WHERE room_id = ? ORDER BY id DESC LIMIT 1').get(room_id);
      rooms = [{ room_id, unread: unread.c, last_message: lastMsg?.message, last_at: lastMsg?.created_at }];
    }
    return ok(res, { rooms });
  } catch (err) { next(err); }
}

module.exports = { getMessages, sendMessage, getRooms };
