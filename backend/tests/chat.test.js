const { test } = require('node:test');
const assert = require('node:assert/strict');
const databasePath = require.resolve('../config/database');
const previous = require.cache[databasePath];
let messages = [], calls = [];
const database = { query: async (sql, params) => {
  calls.push({ sql, params });
  if (sql.startsWith('UPDATE chat_messages')) {
    for (const m of messages) if (m.room_id === params[0] && m.sender_role === params[1] && m.id <= params[2]) m.is_read = 1;
    return { rows: [] };
  }
  if (sql.includes('cm.is_read = 0')) {
    const unread = messages.filter(m => !m.is_read && m.sender_role === params[0] && (params.length === 1 || m.room_id === params[1]));
    return { rows: sql.includes('COUNT(*)') ? [{ total: unread.length }] : unread.sort((a, b) => b.id - a.id).slice(0, 30) };
  }
  return { rows: messages.filter(m => m.room_id === params[0]).sort((a, b) => b.id - a.id) };
} };
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: database };
const chat = require('../controllers/chatController');
if (previous) require.cache[databasePath] = previous; else delete require.cache[databasePath];
function reset() {
  calls = [];
  messages = [
    { id: 1, room_id: 'user_4', sender_role: 'user', is_read: 0, message: 'Pesan pelanggan' },
    { id: 2, room_id: 'user_4', sender_role: 'admin', is_read: 0, message: 'Balasan admin' },
    { id: 3, room_id: 'user_5', sender_role: 'admin', is_read: 0, message: 'Pesan pribadi pengguna lain' },
    { id: 4, room_id: 'user_5', sender_role: 'user', is_read: 0, message: 'Pesan pelanggan lain' },
    { id: 5, room_id: 'user_4', sender_role: 'admin', is_read: 0, message: 'Balasan yang datang belakangan' },
  ];
}
async function call(handler, { role = 'user', room = 'user_4', body = {} } = {}) {
  const res = { status(code) { this.code = code; return this; }, json(json) { this.data = json; return this; } };
  await handler({ user: { id: 4, role }, params: { room_id: room }, query: {}, body }, res, err => { throw err; });
  return res;
}
test('fetching messages never marks a hidden conversation as read', async () => {
  reset(); const res = await call(chat.getMessages);
  assert.equal(res.code, 200); assert.equal(messages.filter(m => m.is_read).length, 0);
  assert.ok(calls.every(c => !c.sql.startsWith('UPDATE')));
});
test('user notifications contain only incoming admin messages from their own room', async () => {
  reset(); const res = await call(chat.getNotifications);
  assert.equal(res.data.data.total, 2);
  assert.deepEqual(res.data.data.messages.map(m => m.id), [5, 2]);
});
test('admin notifications include customer messages across rooms and exclude admin messages', async () => {
  reset(); const res = await call(chat.getNotifications, { role: 'admin' });
  assert.equal(res.data.data.total, 2); assert.deepEqual(res.data.data.messages.map(m => m.id), [4, 1]);
});
test('read acknowledgments cannot access another customer room', async () => {
  reset(); const res = await call(chat.markRead, { room: 'user_5', body: { through_id: 4 } });
  assert.equal(res.code, 403); assert.equal(calls.length, 0);
});
test('read acknowledgments reject invalid IDs before querying the database', async () => {
  for (const id of [undefined, -1, 0, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
    reset(); assert.equal((await call(chat.markRead, { body: { through_id: id } })).code, 400); assert.equal(calls.length, 0);
  }
});
test('acknowledgment only reads incoming messages through the visible message ID', async () => {
  reset(); assert.equal((await call(chat.markRead, { body: { through_id: 2 } })).code, 200);
  assert.deepEqual(messages.filter(m => m.is_read).map(m => m.id), [2]);
  assert.match(calls[0].sql, /id <= \$3/);
  const unread = await call(chat.getNotifications); assert.deepEqual(unread.data.data.messages.map(m => m.id), [5]);
});
test('admin acknowledgment does not read their outgoing replies', async () => {
  reset(); await call(chat.markRead, { role: 'admin', body: { through_id: 5 } });
  assert.deepEqual(messages.filter(m => m.is_read).map(m => m.id), [1]);
});
