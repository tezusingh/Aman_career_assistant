/**
 * G-008 (v1.15.0) — modes/_profile.md editor CRUD.
 *
 * GET /api/modes/_profile        → { markdown, bytes, scaffolded }
 * PUT /api/modes/_profile { markdown } → { ok, sanitized, bytes }
 *
 * Isolation: CAREER_OPS_ROOT-scoped tmpdir + dynamic import of
 * server/index.mjs so PATHS resolves to the fixture (same pattern as
 * tests/batch-endpoints.test.mjs).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'modes-profile-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'),   { recursive: true });
  mkdirSync(resolve(dir, 'modes'),  { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '# Applications\n');
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

function ensureClean() {
  // Each test starts from a clean modes/ state.
  for (const f of ['_profile.md', '_profile.template.md']) {
    try { rmSync(resolve(dir, 'modes', f), { force: true }); } catch {}
  }
}

test('GET /api/modes/_profile returns built-in scaffold when neither file nor template exists', async () => {
  ensureClean();
  const r = await fetch(baseUrl + '/api/modes/_profile');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.match(body.markdown, /Career framing/);
  assert.match(body.markdown, /Target Roles/);
  assert.match(body.markdown, /Exit Narrative/);
  assert.equal(body.scaffolded, true);
  assert.ok(body.bytes > 0);
});

test('GET /api/modes/_profile returns _profile.template.md when it exists but _profile.md does not', async () => {
  ensureClean();
  writeFileSync(resolve(dir, 'modes', '_profile.template.md'),
    '# TEMPLATE\n\nFill me in.\n');
  const r = await fetch(baseUrl + '/api/modes/_profile');
  const body = await r.json();
  assert.equal(body.scaffolded, true);
  assert.match(body.markdown, /TEMPLATE/);
  // Read should NOT have persisted the template to _profile.md yet.
  assert.equal(existsSync(resolve(dir, 'modes', '_profile.md')), false);
});

test('GET /api/modes/_profile returns persisted _profile.md (template ignored)', async () => {
  ensureClean();
  writeFileSync(resolve(dir, 'modes', '_profile.template.md'), '# TEMPLATE\n');
  writeFileSync(resolve(dir, 'modes', '_profile.md'),         '# REAL\n\nMy framing.\n');
  const r = await fetch(baseUrl + '/api/modes/_profile');
  const body = await r.json();
  assert.equal(body.scaffolded, false);
  assert.match(body.markdown, /REAL/);
  assert.doesNotMatch(body.markdown, /TEMPLATE/);
});

test('PUT /api/modes/_profile writes the file and returns ok', async () => {
  ensureClean();
  const r = await fetch(baseUrl + '/api/modes/_profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: '# Career framing\n\nMy roles: Senior Backend.\n' }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.ok(body.bytes > 0);
  const persisted = readFileSync(resolve(dir, 'modes', '_profile.md'), 'utf8');
  assert.match(persisted, /My roles: Senior Backend/);
});

test('PUT /api/modes/_profile sanitizes script/javascript: payloads', async () => {
  ensureClean();
  const r = await fetch(baseUrl + '/api/modes/_profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      markdown: '# Framing\n\n<script>alert(1)</script>\n[bad](javascript:doStuff())\n',
    }),
  });
  assert.equal(r.status, 200);
  const persisted = readFileSync(resolve(dir, 'modes', '_profile.md'), 'utf8');
  assert.doesNotMatch(persisted, /<script>/);
  assert.doesNotMatch(persisted, /javascript:/);
});

test('PUT /api/modes/_profile rejects non-string body with 400', async () => {
  const r = await fetch(baseUrl + '/api/modes/_profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: { not: 'a string' } }),
  });
  assert.equal(r.status, 400);
});

test('PUT /api/modes/_profile rejects >256 KB body with 413', async () => {
  const big = '# Big\n' + 'x'.repeat(257 * 1024);
  const r = await fetch(baseUrl + '/api/modes/_profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: big }),
  });
  assert.equal(r.status, 413);
});

test('Generic GET /api/modes/:name still works for non-_profile slugs', async () => {
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n\nPrompt body.\n');
  const r = await fetch(baseUrl + '/api/modes/oferta');
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.match(text, /Oferta/);
});
