import './setup.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startTestDatabase, stopTestDatabase } from './helpers/testDb.js';

const { createApp } = await import('../src/app.js');
const { setDatabaseDriver } = await import('../src/config/db.js');
const app = createApp();

before(startTestDatabase);
after(stopTestDatabase);

test('GET /api/health returns ok when the database is up', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'ok');
  assert.equal(res.body.data.database, 'up');
});

test('security headers are set and x-powered-by is hidden', async () => {
  const res = await request(app).get('/api/health');
  assert.ok(res.headers['x-content-type-options'], 'helmet header missing');
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('CORS allows the configured frontend origin', async () => {
  const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
});

test('CORS does not allow an unknown origin', async () => {
  const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('unknown route returns a JSON 404', async () => {
  const res = await request(app).get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('malformed JSON returns 400, not 500', async () => {
  const res = await request(app)
    .post('/api/health')
    .set('Content-Type', 'application/json')
    .send('{"broken":');
  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Request body is not valid JSON');
});

// Runs last: simulates the database going down (e.g. Supabase project paused).
test('health reports 503 when the database connection fails', async () => {
  const failing = { query: async () => { throw new Error('connection refused'); }, close: async () => {} };
  setDatabaseDriver(failing);
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 503);
  assert.equal(res.body.data.database, 'down');
});
