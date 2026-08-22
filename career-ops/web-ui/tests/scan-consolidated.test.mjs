/**
 * v1.12.0 — F-018 LITE. /api/stream/scan?source=<id> consolidates the
 * two legacy endpoints behind a single SSE entrypoint.
 *
 * We read the SSE stream up to the first `start` event so we don't need
 * the upstream APIs (Greenhouse/Ashby/Lever/hh.ru) to be reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'scan-consolidated-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'),
    'tracked_companies: []\n' +
    'russian_portals:\n  enabled: false\n  sources: []\n  queries: []\n' +
    'title_filter:\n  positive: []\n  negative: []\n  seniority_boost: []\n');
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

async function readFirstStart(path) {
  const ctrl = new AbortController();
  const res = await fetch(baseUrl + path, { signal: ctrl.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let start = null;
  try {
    while (!start) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const frames = buf.split('\n\n');
      buf = frames.pop();
      for (const frame of frames) {
        let ev = null, data = null;
        for (const l of frame.split('\n')) {
          if (l.startsWith('event: ')) ev = l.slice(7).trim();
          if (l.startsWith('data: ')) data = l.slice(6);
        }
        if (ev === 'start' && data) { start = JSON.parse(data); break; }
        if (ev === 'error' && data) { start = { _error: JSON.parse(data) }; break; }
      }
    }
  } finally { ctrl.abort(); }
  return start;
}

test('F-018 LITE: /api/stream/scan?source=ats emits an en-scanner start frame', async () => {
  const s = await readFirstStart('/api/stream/scan?source=ats');
  assert.ok(s && s.script, 'expected a start event with `script` field');
  assert.equal(s.script, 'en-scanner');
});

test('F-018 LITE: /api/stream/scan?source=regional emits a ru-scanner start frame', async () => {
  const s = await readFirstStart('/api/stream/scan?source=regional');
  assert.ok(s && s.script);
  assert.equal(s.script, 'ru-scanner');
});

test('F-018 LITE: /api/stream/scan (no source) defaults to both, starts with en-scanner', async () => {
  const s = await readFirstStart('/api/stream/scan');
  assert.equal(s.script, 'en-scanner');  // both means ATS first
});

test('F-018 LITE: /api/stream/scan?source=unknown emits an error frame', async () => {
  const s = await readFirstStart('/api/stream/scan?source=bogus');
  assert.ok(s._error, 'expected error frame');
  assert.match(s._error.message, /unknown source/);
});

// v1.18.0 — the legacy /api/stream/scan-{en,ru} aliases were retired.
// Sunset header had been live since v1.15.0; the migration window is
// now closed. These two former back-compat assertions now verify that
// requests to the old paths cleanly 404 instead of being routed to the
// SPA catch-all (which would have returned the index.html with 200).

test('F-018 v1.18.0: legacy /api/stream/scan-en returns 404', async () => {
  const res = await fetch(baseUrl + '/api/stream/scan-en');
  assert.equal(res.status, 404);
});

test('F-018 v1.18.0: legacy /api/stream/scan-ru returns 404', async () => {
  const res = await fetch(baseUrl + '/api/stream/scan-ru');
  assert.equal(res.status, 404);
});

// v1.22.0 (M-8) — `/api/scan-ru/config` was retired in v1.20.0. The
// v1.18 retirements have explicit 404 canaries; this one didn't, so
// nothing would fire if someone re-introduced the alias by accident.
test('v1.20.0: retired /api/scan-ru/config returns 404', async () => {
  const res = await fetch(baseUrl + '/api/scan-ru/config');
  assert.equal(res.status, 404);
});
