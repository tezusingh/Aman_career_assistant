/**
 * v1.54.7 — W-001 (regression run): the SPA loads `api.js` /
 * `router.js` / views via plain `<script src>` with no version query
 * string and there is no build step (no content hashing), so after a
 * deploy a browser could serve a cached old bundle for hours →
 * stale-cache 404s on query-string routes (observed live during the
 * v1.29.2 regression). Fix: code/style assets + the SPA shell are
 * served `Cache-Control: no-store` so the browser always revalidates.
 *
 * Boots the real app (createApp) against an isolated CAREER_OPS_ROOT
 * and asserts the response headers — same pattern as
 * security-headers.test.mjs.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let createApp;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'asset-cache-'));
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

async function get(path) {
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'manual' });
    await res.text();
    return { status: res.status, cc: res.headers.get('cache-control') };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('JS assets are served Cache-Control: no-store', async () => {
  for (const p of ['/js/api.js', '/js/router.js', '/js/lib/modes-form.js']) {
    const r = await get(p);
    assert.equal(r.status, 200, `${p} should 200`);
    assert.equal(r.cc, 'no-store', `${p} must be no-store, got ${r.cc}`);
  }
});

test('CSS assets are served Cache-Control: no-store', async () => {
  const r = await get('/css/app.css');
  assert.equal(r.status, 200);
  assert.equal(r.cc, 'no-store', `css must be no-store, got ${r.cc}`);
});

test('static index.html is no-store', async () => {
  const r = await get('/index.html');
  assert.equal(r.status, 200);
  assert.equal(r.cc, 'no-store', `index.html must be no-store, got ${r.cc}`);
});

test('SPA catch-all (deep route → index.html) is no-store', async () => {
  // sendFile path — exercises the explicit header on the catch-all,
  // not express.static's setHeaders.
  const r = await get('/some/deep/spa/route');
  assert.equal(r.status, 200);
  assert.equal(r.cc, 'no-store', `catch-all shell must be no-store, got ${r.cc}`);
});
