const { test } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = require('path').join(__dirname, '..', 'data', 'test.db');
process.env.RESET_DB = 'true';

const app = require('../src/server');
const http = require('node:http');

let server, base;
test('boot', async () => {
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

const req = (method, path, body, headers = {}) => new Promise((resolve, reject) => {
  const data = body ? JSON.stringify(body) : null;
  const r = http.request(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers } }, (res) => {
    let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b && /^[\[{]/.test(b) ? JSON.parse(b) : b }));
  });
  r.on('error', reject); if (data) r.write(data); r.end();
});

test('health endpoint', async () => {
  const r = await req('GET', '/api/debug/health');
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
});

test('login admin', async () => {
  const r = await req('POST', '/api/auth/login', { email: 'admin@pantau.local', password: 'admin123' });
  assert.equal(r.status, 200); assert.ok(r.body.token);
});

test('monitors require auth', async () => {
  const r = await req('GET', '/api/monitors');
  assert.equal(r.status, 401);
});

test('list monitors with token', async () => {
  const login = await req('POST', '/api/auth/login', { email: 'admin@pantau.local', password: 'admin123' });
  const r = await req('GET', '/api/monitors', null, { Authorization: 'Bearer ' + login.body.token });
  assert.equal(r.status, 200); assert.ok(Array.isArray(r.body));
});

test('teardown', () => server.close());
