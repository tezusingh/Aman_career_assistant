/**
 * v1.28.1 — `HH_USER_AGENT` row removed from `/api/health`.
 *
 * Pre-v1.28.1 the health endpoint included a row:
 *     { name: 'HH_USER_AGENT', required: false, … }
 * which surfaced "unset (hh.ru may 403 from non-RU IPs)" on the dashboard
 * even for users who never plan to scan hh.ru. The 403-from-non-RU gate is
 * still documented in `docs/help/<locale>.md §16` (troubleshooting) and the
 * ru-scanner itself emits a stderr hint when it hits the gate at scan time.
 * Removed the row to reduce dashboard noise per user feedback.
 *
 * Regression guard: assert `/api/health` no longer returns a row named
 * 'HH_USER_AGENT' in any of its checks.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'health-no-hh-ua-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'x\n');
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

test('/api/health no longer surfaces HH_USER_AGENT row', async () => {
  const r = await fetch(baseUrl + '/api/health');
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(d.checks), 'health response must include checks array');
  const names = d.checks.map((c) => c.name);
  assert.ok(!names.includes('HH_USER_AGENT'), `expected HH_USER_AGENT row gone; got: ${names.join(', ')}`);
});

test('/api/health still carries the canonical optional rows', async () => {
  // Quick sanity that removing HH_USER_AGENT didn't accidentally nuke
  // adjacent optional rows.
  const r = await fetch(baseUrl + '/api/health');
  const d = await r.json();
  const names = d.checks.map((c) => c.name);
  for (const expected of [
    'Node version',
    'Project root',
    'cv.md',
    'GEMINI_API_KEY',
    'ANTHROPIC_API_KEY',
    'Playwright (parent node_modules)',
  ]) {
    assert.ok(names.includes(expected), `expected check "${expected}" still present; got: ${names.join(', ')}`);
  }
});
