const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validCoordinates } = require('../utils/coordinates');

// Isolate the controller from a real database; never mutate production orders.
const databasePath = require.resolve('../config/database');
const previousDatabase = require.cache[databasePath];
let row, writes, queries, createdCoordinates;
const database = {
  query: async sql => {
    queries.push(sql);
    if (sql.includes('FROM packages')) return { rows: [{ id: 2, price: 15000, ps_type: 'ps4_slim' }] };
    return { rows: [{ count: 1 }] };
  },
  withTransaction: async fn => fn({ query: async (sql, params) => {
    queries.push(sql);
    if (sql.startsWith('SELECT id, user_id')) return { rows: row ? [row] : [] };
    writes.push({ sql, params });
    if (sql.startsWith('INSERT INTO orders')) {
      createdCoordinates = params.slice(8, 10);
      return { rows: [{ id: 17 }] };
    }
    return { rows: [{ ...row, delivery_lat: params[0], delivery_lng: params[1] }] };
  } }),
};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: database };
const orders = require('../controllers/orderController');
const maps = require('../controllers/mapsController');
if (previousDatabase) require.cache[databasePath] = previousDatabase;
else delete require.cache[databasePath];

function reset(order = { id: 17, user_id: 4, status: 'pending' }) { row = order; writes = []; queries = []; createdCoordinates = undefined; }
async function call(handler, body, userId = 4) {
  const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ body, user: { id: userId, role: 'user' }, params: { id: '17' } }, res, err => { throw err; });
  return res;
}

test('coordinates accept zero and numeric strings, reject missing, non-finite and out-of-range values', () => {
  assert.equal(validCoordinates(0, 0), true);
  assert.equal(validCoordinates('5.5483', '95.3238'), true);
  for (const [lat, lng] of [[null, 95], [5, undefined], ['', 95], [91, 95], [5, 181], [NaN, 95], [5, Infinity], [true, 95], [[], 95]]) assert.equal(validCoordinates(lat, lng), false);
});

test('booking rejects partial or invalid coordinates before accessing the database', async () => {
  for (const point of [{ delivery_lat: 5 }, { delivery_lat: 100, delivery_lng: 95 }, { delivery_lat: '', delivery_lng: '' }]) {
    reset();
    const res = await call(orders.create, { package_id: 2, payment_method: 'cod', delivery_address: 'Alamat uji', ...point });
    assert.equal(res.code, 400); assert.equal(queries.length, 0);
  }
});

test('booking persists the exact GPS point and still supports manual addresses', async () => {
  for (const point of [{ delivery_lat: 5.552345, delivery_lng: 95.324567 }, {}]) {
    reset();
    const res = await call(orders.create, { package_id: 2, payment_method: 'cod', delivery_address: 'Alamat uji', ...point });
    assert.equal(res.code, 201);
    assert.deepEqual(createdCoordinates, [point.delivery_lat ?? null, point.delivery_lng ?? null]);
  }
});

test('updating coordinates requires a valid point and an existing owned order', async () => {
  reset(); assert.equal((await call(orders.updateLocation, { delivery_lat: 5 })).code, 400); assert.equal(queries.length, 0);
  reset(null); assert.equal((await call(orders.updateLocation, { delivery_lat: 5, delivery_lng: 95 })).code, 404); assert.equal(writes.length, 0);
  reset(); assert.equal((await call(orders.updateLocation, { delivery_lat: 5, delivery_lng: 95 }, 999)).code, 403); assert.equal(writes.length, 0);
});

test('delivery and completed orders cannot have their destination silently changed', async () => {
  for (const status of ['on_delivery', 'delivered', 'active', 'returning', 'completed', 'cancelled']) {
    reset({ id: 17, user_id: 4, status });
    assert.equal((await call(orders.updateLocation, { delivery_lat: 5, delivery_lng: 95 })).code, 409);
    assert.equal(writes.length, 0);
  }
});

test('allowed destination changes persist coordinates and an audit entry in one transaction', async () => {
  for (const status of ['pending', 'confirmed', 'preparing']) {
    reset({ id: 17, user_id: 4, status });
    const res = await call(orders.updateLocation, { delivery_lat: '5.552345', delivery_lng: '95.324567' });
    assert.equal(res.code, 200);
    assert.match(queries[0], /FOR UPDATE/);
    assert.deepEqual(writes[0].params, [5.552345, 95.324567, 17]);
    assert.match(writes[1].sql, /INSERT INTO order_tracking/);
    assert.deepEqual(writes[1].params.slice(3), [5.552345, 95.324567]);
  }
});

test('reverse lookup rejects invalid coordinates and accepts zero without calling a real provider', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; return { ok: true, json: async () => ({ display_name: 'Alamat uji', lat: '0', lon: '0', address: {} }) }; };
  try {
    const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await maps.reverseGeocode({ query: { lat: 100, lng: 95 } }, res, err => { throw err; });
    assert.equal(res.code, 400); assert.equal(calls, 0);
    await maps.reverseGeocode({ query: { lat: 0, lng: 0 } }, res, err => { throw err; });
    assert.equal(res.code, 200); assert.equal(calls, 1); assert.equal(res.data.data.lat, 0);
  } finally { global.fetch = originalFetch; }
});
