/**
 * F-019 — every body-parser error must return JSON (not an HTML stack
 * trace) so the SPA's `await res.json()` can show a localized toast.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'global-err-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
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

test('F-019: malformed JSON body returns JSON 400 (not an HTML stack)', async () => {
  const res = await fetch(baseUrl + '/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{this is { broken json',
  });
  assert.equal(res.status, 400);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  const data = await res.json();
  assert.match(data.error, /malformed/i);
});

test('F-019: 11 MB payload to /api/cv/import returns JSON 413', async () => {
  // express.raw is capped at MAX_UPLOAD_BYTES (10 MB) for /api/cv/import.
  // Bigger bodies must surface as a JSON 413, not an HTML stack.
  const big = Buffer.alloc(11 * 1024 * 1024, 0x61);  // 'a' * 11MB
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'big.md' },
    body: big,
  });
  assert.equal(res.status, 413);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  const data = await res.json();
  assert.match(data.error, /too large/i);
});
