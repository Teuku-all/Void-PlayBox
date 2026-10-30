const { test } = require('node:test');
const assert = require('node:assert/strict');

const databasePath = require.resolve('../config/database');
const previousDatabase = require.cache[databasePath];
let calls = 0;
const database = {
  query: async () => { calls++; return { rows: [{ id: 1, ps_type: 'ps5', features: [] }] }; },
  withTransaction: async () => { throw new Error('An unsupported console must never reach checkout.'); },
};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: database };
const packages = require('../controllers/packageController');
const inventory = require('../controllers/inventoryController');
const orders = require('../controllers/orderController');
if (previousDatabase) require.cache[databasePath] = previousDatabase;
else delete require.cache[databasePath];

async function call(handler, body) {
  calls = 0;
  const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ body, user: { id: 4, role: 'admin' }, params: { id: '1' } }, res, err => { throw err; });
  return res;
}

test('new and updated packages reject consoles outside the PS4 family', async () => {
  const body = { name: 'Paket uji', category: 'harian', ps_type: 'ps5', duration: 1, price: 15000, features: [] };
  for (const handler of [packages.create, packages.update]) {
    const res = await call(handler, body);
    assert.equal(res.code, 400); assert.match(res.data.message, /hanya menyediakan konsol PS4/); assert.equal(calls, 0);
  }
});

test('new inventory rejects unsupported console types before writing data', async () => {
  const res = await call(inventory.create, { serial_no: 'TEST-001', ps_type: 'ps5', name: 'Unit uji' });
  assert.equal(res.code, 400); assert.equal(calls, 0);
});

test('a legacy unsupported package cannot be booked by its ID', async () => {
  const res = await call(orders.create, { package_id: 1, payment_method: 'cod', delivery_address: 'Alamat uji' });
  assert.equal(res.code, 409); assert.match(res.data.message, /hanya menyediakan PS4/); assert.equal(calls, 1);
});

test('both PS4 variants remain available for new packages', async () => {
  for (const ps_type of ['ps4_slim', 'ps4_pro']) {
    const res = await call(packages.create, { name: 'Paket uji', category: 'harian', ps_type, duration: 1, price: 15000, features: ['2 Controller'] });
    assert.equal(res.code, 201); assert.equal(calls, 1);
  }
});
