/**
 * NEW-F1-sub-r1 (v1.59.10) — un-encoded `../` path-traversal under
 * `/api/*` must return 404 JSON `{error: 'invalid path'}`.
 *
 * v1.59.8 added a middleware that inspected `req.originalUrl`, but it
 * was placed AFTER `app.all('/api/*', JSON-404)` and AFTER all route
 * registrations — by which time Express had already normalised the URL
 * (collapsing `..` segments). `/api/jds/../../../etc/passwd` was
 * rewritten to `/etc/passwd` and fell through to the SPA static
 * handler (200 OK on index.html). v1.59.10 hoists the guard ABOVE all
 * route registrations so it inspects the verbatim request URL before
 * any normalisation.
 *
 * Boots the real app via `createApp` against an isolated CAREER_OPS_ROOT
 * (same scaffolding as asset-cache-control.test.mjs).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import * as http from 'node:http';

let createApp;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'api-traversal-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ createApp } = await import('../server/index.mjs'));
});

after(() => { delete process.env.CAREER_OPS_ROOT; });

/**
 * Probe with the RAW request path verbatim — Node's fetch normalises
 * `../` client-side, so we drop to the http module and write the
 * request line ourselves. This is the only way to assert the
 * server's behaviour against an un-encoded `../` traversal.
 */
async function rawGet(path) {
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try {
    const port = server.address().port;
    return await new Promise((resolveProbe, reject) => {
      const req = http.request({
        host: '127.0.0.1', port, path, method: 'GET',
      }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch { /* not JSON */ }
          resolveProbe({
            status: res.statusCode,
            ct: res.headers['content-type'] || '',
            body, json,
          });
        });
      });
      req.on('error', reject);
      req.end();
    });
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('NEW-F1-sub-r1: un-encoded /api/jds/../../../etc/passwd → 404 JSON {invalid path}', async () => {
  const r = await rawGet('/api/jds/../../../etc/passwd');
  assert.equal(r.status, 404, `expected 404, got ${r.status} body=${r.body.slice(0, 200)}`);
  assert.ok(r.ct.includes('application/json'),
    `expected application/json, got ${r.ct}`);
  assert.equal(r.json?.error, 'invalid path');
});

test('NEW-F1-sub-r1: un-encoded /api/interview-prep/../../../package.json → 404 JSON {invalid path}', async () => {
  const r = await rawGet('/api/interview-prep/../../../package.json');
  assert.equal(r.status, 404);
  assert.ok(r.ct.includes('application/json'));
  assert.equal(r.json?.error, 'invalid path');
});

test('NEW-F1-sub-r1: un-encoded /api/reports/../../config/profile.yml → 404 JSON {invalid path}', async () => {
  const r = await rawGet('/api/reports/../../config/profile.yml');
  assert.equal(r.status, 404);
  assert.ok(r.ct.includes('application/json'));
  assert.equal(r.json?.error, 'invalid path');
});

test('NEW-F1-sub-r1: encoded traversal %2e%2e%2f → 404 JSON (regression lock — was already correct)', async () => {
  const r = await rawGet('/api/jds/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
  assert.equal(r.status, 404);
  assert.ok(r.ct.includes('application/json'),
    `encoded traversal must return JSON 404, got ${r.ct}`);
});

test('NEW-F1-sub-r1: valid /api/health still returns 200 JSON (regression lock)', async () => {
  // The traversal guard must NOT swallow legitimate /api requests.
  // The fixture is intentionally minimal (some health checks may
  // report `ok: false` because the parent project isn't bootstrapped),
  // but the response must still be a 200 JSON document with the
  // expected shape: `version` field + `checks` array.
  const r = await rawGet('/api/health');
  assert.equal(r.status, 200, `valid /api/health must 200, got ${r.status}`);
  assert.ok(r.ct.includes('application/json'));
  assert.equal(typeof r.json?.version, 'string', 'health must report a version');
  assert.ok(Array.isArray(r.json?.checks), 'health must return a checks array');
});

test('NEW-F1-sub-r1: unknown /api/* (no traversal) still returns {unknown api} (regression lock)', async () => {
  // The guard MUST NOT swallow plain unknown endpoints; the existing
  // `app.all('/api/*')` fallback handles those with a distinct error
  // message so the SPA can tell the two failure modes apart.
  const r = await rawGet('/api/no-such-endpoint');
  assert.equal(r.status, 404);
  assert.ok(r.ct.includes('application/json'));
  assert.equal(r.json?.error, 'unknown api',
    'plain unknown /api/* must still report {unknown api}, not {invalid path}');
});
