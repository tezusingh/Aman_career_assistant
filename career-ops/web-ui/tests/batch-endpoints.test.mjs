/**
 * v1.13.0 — batch evaluate endpoints.
 *   GET  /api/batch
 *   PUT  /api/batch       { raw }
 *   GET  /api/stream/batch
 *   POST /api/batch/merge
 *
 * We don't actually spawn batch/batch-runner.sh here — that would require
 * the parent project, real network, and a working batch input. Instead
 * we hit the no-runner branch (error frame) and assert on the contract.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'batch-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'batch', 'tracker-additions'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

test('GET /api/batch: empty fixture returns exists=false, rows=[]', async () => {
  const r = await fetch(baseUrl + '/api/batch').then((r) => r.json());
  assert.equal(r.exists, false);
  assert.equal(r.runnerExists, false);
  assert.deepEqual(r.rows, []);
  assert.deepEqual(r.additions, []);
});

test('PUT /api/batch: persists TSV, GET reads parsed rows', async () => {
  const raw = '# header comment\n1\thttps://jobs.example.com/a\tLinkedIn\tnote A\n2\thttps://jobs.example.com/b\tGreenhouse\t\n';
  const put = await fetch(baseUrl + '/api/batch', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  }).then((r) => r.json());
  assert.equal(put.ok, true);
  assert.equal(put.rows, 2);

  const get = await fetch(baseUrl + '/api/batch').then((r) => r.json());
  assert.equal(get.exists, true);
  assert.equal(get.rows.length, 2);
  assert.equal(get.rows[0].url, 'https://jobs.example.com/a');
  assert.equal(get.rows[0].source, 'LinkedIn');
  assert.equal(get.rows[1].url, 'https://jobs.example.com/b');
});

test('PUT /api/batch: rejects body with no URL anywhere', async () => {
  const r = await fetch(baseUrl + '/api/batch', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: '1\tnot-a-url\tLinkedIn\t\n' }),
  });
  assert.equal(r.status, 400);
  const data = await r.json();
  assert.match(data.error, /no URL/);
});

test('PUT /api/batch: 413 when body exceeds 1MB', async () => {
  const big = 'x'.repeat(1024 * 1024 + 100);
  const r = await fetch(baseUrl + '/api/batch', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: big }),
  });
  assert.equal(r.status, 413);
});

test('GET /api/stream/batch: when batch-runner.sh missing, emits error frame', async () => {
  // No batch/batch-runner.sh in our fixture → server emits an SSE error
  // immediately and closes the stream. Parse the SSE up to `done`.
  const res = await fetch(baseUrl + '/api/stream/batch');
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /event: error/);
  assert.match(text, /batch-runner\.sh not found/);
  assert.match(text, /event: done/);
});
