/**
 * Mini dotenv loader — server/lib/dotenv.mjs.
 *
 * The error messages in scanner code already point users at .env (e.g.
 * "set HH_USER_AGENT in .env or run from a Russian IP"); this module
 * makes that hint actually work without adding a dependency.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadEnvFile } from '../server/lib/dotenv.mjs';

function freshKey() {
  return 'TEST_DOTENV_' + Math.floor(Math.random() * 1e9);
}

test('loadEnvFile: KEY=value lines populate process.env', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'dotenv-1-'));
  const path = resolve(dir, '.env');
  const k1 = freshKey();
  const k2 = freshKey();
  writeFileSync(path, `${k1}=hello\n${k2}=world\n`);
  delete process.env[k1];
  delete process.env[k2];
  const r = loadEnvFile(path);
  assert.equal(r.loaded, 2);
  assert.equal(process.env[k1], 'hello');
  assert.equal(process.env[k2], 'world');
});

test('loadEnvFile: existing env vars are NOT overwritten', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'dotenv-2-'));
  const path = resolve(dir, '.env');
  const k = freshKey();
  process.env[k] = 'original';
  writeFileSync(path, `${k}=from-file\n`);
  loadEnvFile(path);
  assert.equal(process.env[k], 'original', 'shell-set value must win');
});

test('loadEnvFile: comments and blank lines are skipped', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'dotenv-3-'));
  const path = resolve(dir, '.env');
  const k = freshKey();
  writeFileSync(path, [
    '# a comment',
    '',
    `${k}=ok`,
    '   # indented comment',
    '',
  ].join('\n'));
  delete process.env[k];
  const r = loadEnvFile(path);
  assert.equal(r.loaded, 1);
  assert.equal(process.env[k], 'ok');
});

test('loadEnvFile: matched single + double quotes are stripped', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'dotenv-4-'));
  const path = resolve(dir, '.env');
  const k1 = freshKey();
  const k2 = freshKey();
  const k3 = freshKey();
  writeFileSync(path, `${k1}="quoted value"\n${k2}='single quoted'\n${k3}=plain\n`);
  delete process.env[k1];
  delete process.env[k2];
  delete process.env[k3];
  loadEnvFile(path);
  assert.equal(process.env[k1], 'quoted value');
  assert.equal(process.env[k2], 'single quoted');
  assert.equal(process.env[k3], 'plain');
});

test('loadEnvFile: missing file → noop, no throw', () => {
  const r = loadEnvFile('/nonexistent/path/.env-' + Date.now());
  assert.equal(r.loaded, 0);
});

test('loadEnvFile: malformed lines are skipped', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'dotenv-5-'));
  const path = resolve(dir, '.env');
  const k = freshKey();
  writeFileSync(path, [
    'NO_EQUAL_SIGN',
    '=just-equals',
    '   ',
    `${k}=valid`,
  ].join('\n'));
  delete process.env[k];
  const r = loadEnvFile(path);
  assert.equal(r.loaded, 1);
  assert.equal(process.env[k], 'valid');
});
