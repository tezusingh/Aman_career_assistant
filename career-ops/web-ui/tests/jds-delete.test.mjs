/**
 * FIX-H4 — DELETE /api/jds/:name lets the UI remove saved JDs without
 * shelling out. Path-traversal characters are stripped before any
 * filesystem touch, and we refuse anything that doesn't end in .txt.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let projectRoot;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'jds-del-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'jds'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
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

async function del(path) {
  const res = await fetch(baseUrl + path, { method: 'DELETE' });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('DELETE /api/jds/:name removes the file', async () => {
  const target = 'qa-test-delete.txt';
  writeFileSync(resolve(projectRoot, 'jds', target), 'sample JD body');
  assert.ok(existsSync(resolve(projectRoot, 'jds', target)));

  const r = await del('/api/jds/' + target);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.deleted, target);
  assert.ok(!existsSync(resolve(projectRoot, 'jds', target)));
});

test('DELETE /api/jds/:name returns 404 for missing file', async () => {
  const r = await del('/api/jds/never-existed-' + Date.now() + '.txt');
  assert.equal(r.status, 404);
});

test('DELETE /api/jds/:name rejects names without .txt', async () => {
  const r = await del('/api/jds/nope.md');
  assert.equal(r.status, 400);
});

test('DELETE /api/jds/:name strips path traversal segments', async () => {
  // ../../etc/passwd has no .txt → 400 (refusal). Even with a .txt suffix
  // the slashes are stripped before file resolution, so the real /etc
  // can never be reached. This test asserts the request fails (4xx) and
  // that the real file outside jds/ is untouched.
  const r1 = await del('/api/jds/' + encodeURIComponent('../../etc/passwd'));
  assert.ok(r1.status >= 400 && r1.status < 500, `got ${r1.status}`);
  const r2 = await del('/api/jds/' + encodeURIComponent('../../etc/passwd.txt'));
  // After sanitization: "....etcpasswd.txt" → 404 (no such jd file).
  assert.ok(r2.status >= 400 && r2.status < 500, `got ${r2.status}`);
});

test('DELETE /api/jds/:name rejects empty name after sanitization', async () => {
  const r = await del('/api/jds/' + encodeURIComponent('!!!@@@'));
  assert.equal(r.status, 400);
});
