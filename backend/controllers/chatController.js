const { query } = require('../config/database');
const { ok, fail } = require('../middleware/errorHandler');
function canAccess(req, roomId) { return req.user.role === 'admin' || roomId === `user_${req.user.id}`; }

async function getMessages(req, res, next) {
  try {
    const { room_id: roomId } = req.params;
    if (!canAccess(req, roomId)) return fail(res, 'Akses ditolak.', 403);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { before } = req.query;
    let sql = `SELECT cm.*, u.name AS sender_name, u.avatar AS sender_avatar
               FROM chat_messages cm JOIN users u ON cm.sender_id = u.id WHERE cm.room_id = $1`;
    const params = [roomId];
    if (before) { params.push(before); sql += ` AND cm.id < $${params.length}`; }
    params.push(limit);
    sql += ` ORDER BY cm.id DESC LIMIT $${params.length}`;
    const messages = (await query(sql, params)).rows.reverse();
    const otherRole = req.user.role === 'admin' ? 'user' : 'admin';
    await query('UPDATE chat_messages SET is_read = 1 WHERE room_id = $1 AND sender_role = $2', [roomId, otherRole]);
    return ok(res, { messages });
  } catch (err) { return next(err); }
}

async function sendMessage(req, res, next) {
  try {
    const { room_id: roomId } = req.params;
    if (!canAccess(req, roomId)) return fail(res, 'Akses ditolak.', 403);
    const { message } = req.body;
    if (!message || !message.trim()) return fail(res, 'Pesan tidak boleh kosong.');
    if (message.length > 1000) return fail(res, 'Pesan maksimal 1000 karakter.');
    const result = await query(
      `INSERT INTO chat_messages (room_id, sender_id, sender_role, message) VALUES ($1,$2,$3,$4) RETURNING *`,
      [roomId, req.user.id, req.user.role, message.trim()]
    );
    const msg = (await query(
      `SELECT cm.*, u.name AS sender_name FROM chat_messages cm JOIN users u ON cm.sender_id = u.id WHERE cm.id = $1`,
      [result.rows[0].id]
    )).rows[0];
    return ok(res, { message: msg }, 'Pesan terkirim.', 201);
  } catch (err) { return next(err); }
}

async function getRooms(req, res, next) {
  try {
    let rooms;
    if (req.user.role === 'admin') {
      rooms = (await query(
        `SELECT cm.room_id, MAX(cm.created_at) AS last_at,
          SUM(CASE WHEN cm.is_read = 0 AND cm.sender_role = 'user' THEN 1 ELSE 0 END)::int AS unread,
          (SELECT c2.message FROM chat_messages c2 WHERE c2.room_id = cm.room_id ORDER BY c2.id DESC LIMIT 1) AS last_message,
          (SELECT u.name FROM chat_messages c3 JOIN users u ON c3.sender_id = u.id WHERE c3.room_id = cm.room_id AND c3.sender_role = 'user' ORDER BY c3.id ASC LIMIT 1) AS user_name
         FROM chat_messages cm GROUP BY cm.room_id ORDER BY last_at DESC`
      )).rows;
    } else {
      const roomId = `user_${req.user.id}`;
      const unread = await query("SELECT COUNT(*)::int AS count FROM chat_messages WHERE room_id = $1 AND is_read = 0 AND sender_role = 'admin'", [roomId]);
      const last = await query('SELECT message, created_at FROM chat_messages WHERE room_id = $1 ORDER BY id DESC LIMIT 1', [roomId]);
      rooms = [{ room_id: roomId, unread: Number(unread.rows[0].count), last_message: last.rows[0]?.message, last_at: last.rows[0]?.created_at }];
    }
    return ok(res, { rooms });
  } catch (err) { return next(err); }
}
module.exports = { getMessages, sendMessage, getRooms };
