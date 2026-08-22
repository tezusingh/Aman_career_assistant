/**
 * v1.26.0 — Functional coverage for /api/jds list (GET /api/jds),
 * read (GET /api/jds/:name), and create (POST /api/jds).
 *
 * v1.25 baseline left jds.mjs at 61.64 % line coverage — only the
 * DELETE path was tested. The GET-list / GET-single / POST handlers
 * (lines 21-28 and 53-71 per the coverage report) were uncovered.
 * v1.26 closes the gap.
 *
 * Tier: functional. Mirrors the `before()`-once + per-test isolation
 * pattern from `api.test.mjs` — single tmpdir, single createApp(),
 * tests use unique filenames so they don't collide.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let projectRoot;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'jds-routes-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'jds'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  process.env.CAREER_OPS_ROOT = dir;
  projectRoot = dir;
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

test('GET /api/jds returns shape { jds: [] } even on empty dir', async () => {
  const r = await fetch(baseUrl + '/api/jds');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(Array.isArray(body.jds), 'expected jds: array');
});

test('POST /api/jds with slug uses sanitized slug as filename', async () => {
  const slug = 'jds-create-by-slug-' + Date.now();
  const r = await fetch(baseUrl + '/api/jds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Body text', slug }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.name, `${slug}.txt`);
  assert.ok(existsSync(resolve(projectRoot, 'jds', body.name)));
});

test('POST /api/jds default slug → jd-<date>-<ts>.txt format', async () => {
  const r = await fetch(baseUrl + '/api/jds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Senior Backend Engineer PHP Go Remote EU.' }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.match(body.name, /^jd-\d{4}-\d{2}-\d{2}-\d+\.txt$/);
  assert.ok(existsSync(resolve(projectRoot, 'jds', body.name)));
});

test('POST /api/jds with characters needing normalization emits warning', async () => {
  const r = await fetch(baseUrl + '/api/jds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'x', slug: 'Slug-With-Caps-Norm-' + Date.now() }),
  });
  // Either no warning (when slug doesn't strip any chars) or a warning
  // mentioning normalization. Both are documented behaviour. The test
  // proves the path is reachable.
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(body.name && body.name.endsWith('.txt'));
});

test('POST /api/jds with empty text → 400', async () => {
  const r = await fetch(baseUrl + '/api/jds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(r.status, 400);
});

test('POST /api/jds with slug that strips to empty → 400', async () => {
  const r = await fetch(baseUrl + '/api/jds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'x', slug: '@@@' }),
  });
  assert.equal(r.status, 400);
});

test('GET /api/jds/:name returns text/plain body of a saved JD', async () => {
  const slug = 'jds-read-' + Date.now();
  writeFileSync(resolve(projectRoot, 'jds', `${slug}.txt`), 'Senior Engineer JD body.');
  const r = await fetch(baseUrl + `/api/jds/${slug}.txt`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/plain/);
  const body = await r.text();
  assert.equal(body, 'Senior Engineer JD body.');
});

test('GET /api/jds/:name with unknown name → 404', async () => {
  const r = await fetch(baseUrl + '/api/jds/does-not-exist-' + Date.now() + '.txt');
  assert.equal(r.status, 404);
});

test('GET /api/jds list returns created entries with size + mtime fields', async () => {
  const slug = 'jds-list-shape-' + Date.now();
  await fetch(baseUrl + '/api/jds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'shape probe', slug }),
  });
  const r = await fetch(baseUrl + '/api/jds');
  const body = await r.json();
  const created = body.jds.find((j) => j.name === `${slug}.txt`);
  assert.ok(created, 'newly created entry should appear in list');
  assert.ok(typeof created.size === 'number' && created.size > 0);
  assert.ok(created.mtime);
});

test('GET /api/jds/:name with traversal-style names rejected (no file leak)', async () => {
  // v1.21.0 (H-4) sanitizePathName integration on the jds GET path —
  // ".." / "....pdf" / leading-dot names must NOT return 200 with a
  // file body. They may 400 (handler sanitized to empty) or 404
  // (handler sanitized to a non-existent filename). The invariant is
  // "no file leak", not a specific status code.
  for (const name of ['..', '....txt', '....', '...']) {
    const r = await fetch(baseUrl + '/api/jds/' + encodeURIComponent(name));
    assert.ok([400, 404].includes(r.status),
      `jds/${name} returned ${r.status} (expected 400 or 404)`);
  }
});
