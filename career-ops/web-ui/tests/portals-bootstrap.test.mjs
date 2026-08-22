/**
 * FIX-H2 — first-boot bootstrap appends a documented russian_portals:
 * block to portals.yml when it's missing. Idempotent on subsequent boots.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let projectRoot;
let createApp;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'portals-bootstrap-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
  ({ createApp } = await import('../server/index.mjs'));
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
});

test('createApp appends russian_portals: when portals.yml has none', () => {
  // No russian_portals block initially.
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  createApp();
  const text = readFileSync(resolve(projectRoot, 'portals.yml'), 'utf8');
  assert.match(text, /^russian_portals\s*:/m);
  assert.match(text, /sources:\s*\["hh", "habr"\]/);
  assert.match(text, /Senior PHP/);
  // Pre-existing content survives.
  assert.match(text, /tracked_companies/);
});

test('createApp is a no-op when russian_portals is already present', () => {
  writeFileSync(resolve(projectRoot, 'portals.yml'), [
    'tracked_companies: []',
    'russian_portals:',
    '  sources: ["hh"]',
    '  area: 1',
    '',
  ].join('\n'));
  const before = readFileSync(resolve(projectRoot, 'portals.yml'), 'utf8');
  createApp();
  const after = readFileSync(resolve(projectRoot, 'portals.yml'), 'utf8');
  assert.equal(before, after);
});

test('createApp does not crash when portals.yml is missing', () => {
  // No portals.yml at all — bootstrap silently skips.
  // (The Health page still surfaces the missing-file warning.)
  const path = resolve(projectRoot, 'portals.yml');
  if (existsSync(path)) unlinkSync(path);
  // Should not throw.
  createApp();
  // Restore a portals.yml so other tests in this file still work if reordered.
  writeFileSync(path, 'tracked_companies: []\n');
});
