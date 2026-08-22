/**
 * FIX-M1 — when the server is reachable from the LAN (HOST=0.0.0.0 or
 * any non-loopback bind), /api/health must not leak the absolute project
 * path or the exact Node version. Loopback responses keep the values
 * for local diagnostics.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let createApp;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'health-priv-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  ({ createApp } = await import('../server/index.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  delete process.env.HOST;
});

async function bootAndGetHealth(host) {
  process.env.HOST = host;
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    return await res.json();
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('on loopback, Node version + project root are visible', async () => {
  const h = await bootAndGetHealth('127.0.0.1');
  const node = h.checks.find((c) => c.name === 'Node version');
  const root = h.checks.find((c) => c.name === 'Project root');
  assert.match(node.value, /^v\d+\./, 'expected vN.x.x version');
  assert.match(root.value, /^\//, 'expected absolute path');
});

test('on 0.0.0.0, Node version + project root are masked', async () => {
  const h = await bootAndGetHealth('0.0.0.0');
  const node = h.checks.find((c) => c.name === 'Node version');
  const root = h.checks.find((c) => c.name === 'Project root');
  assert.equal(node.value, 'hidden');
  assert.equal(root.value, 'hidden');
});

test('masking applies to any non-loopback HOST', async () => {
  const h = await bootAndGetHealth('192.168.1.42');
  assert.equal(h.checks.find((c) => c.name === 'Node version').value, 'hidden');
  assert.equal(h.checks.find((c) => c.name === 'Project root').value, 'hidden');
});

test('the ok/required flags are unaffected by masking', async () => {
  const h = await bootAndGetHealth('0.0.0.0');
  // The Node check should still be "ok: true" since we ARE on Node ≥ 18 here.
  const node = h.checks.find((c) => c.name === 'Node version');
  assert.equal(node.ok, true);
  assert.equal(node.required, true);
});
