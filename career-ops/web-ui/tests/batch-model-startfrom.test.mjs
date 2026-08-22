/**
 * v1.31.0 — parent career-ops 1.8.0 added `batch-runner.sh --model`
 * (#504) + `--start-from`. `GET /api/stream/batch?model=…&startFrom=…`
 * passes them through with defense-in-depth validation (same pattern
 * as v1.28.0 --max-retries).
 *
 * Branches covered:
 *   1. model=claude-sonnet-4-6 → args include --model claude-sonnet-4-6.
 *   2. model with shell-meta chars (`;rm -rf`) → flag dropped (charset gate).
 *   3. model empty/whitespace → flag absent.
 *   4. startFrom=5 → args include --start-from 5.
 *   5. startFrom=0 (< 1) → flag dropped.
 *   6. startFrom=abc (non-int) → flag dropped.
 *   7. combined: model + startFrom + the existing flags all coexist.
 *
 * Same stub-runner strategy as tests/batch-max-retries.test.mjs — the
 * SSE `start` frame carries the resolved args array; no real batch runs.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'batch-ms-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'batch', 'tracker-additions'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  const stub = '#!/usr/bin/env bash\necho "stub args: $@" >&2\nexit 0\n';
  const runnerPath = resolve(dir, 'batch', 'batch-runner.sh');
  writeFileSync(runnerPath, stub);
  chmodSync(runnerPath, 0o755);
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

async function getStartArgs(qs) {
  const r = await fetch(baseUrl + '/api/stream/batch?' + qs);
  assert.equal(r.status, 200);
  const text = await r.text();
  const m = text.match(/event:\s*start\s*\ndata:\s*(\{[^\n]+\})/);
  if (!m) throw new Error(`no start frame in:\n${text.slice(0, 400)}`);
  return JSON.parse(m[1]).args;
}

test('model=claude-sonnet-4-6 → args include --model claude-sonnet-4-6', async () => {
  const args = await getStartArgs('model=claude-sonnet-4-6');
  const idx = args.indexOf('--model');
  assert.notStrictEqual(idx, -1, `expected --model in ${JSON.stringify(args)}`);
  assert.equal(args[idx + 1], 'claude-sonnet-4-6');
});

test('model with shell-meta chars → flag dropped (charset gate)', async () => {
  const args = await getStartArgs('model=' + encodeURIComponent('claude;rm -rf /'));
  assert.equal(args.indexOf('--model'), -1, `injection leaked: ${JSON.stringify(args)}`);
});

test('model empty → flag absent', async () => {
  const args = await getStartArgs('model=' + encodeURIComponent('   '));
  assert.equal(args.indexOf('--model'), -1);
});

test('startFrom=5 → args include --start-from 5', async () => {
  const args = await getStartArgs('startFrom=5');
  const idx = args.indexOf('--start-from');
  assert.notStrictEqual(idx, -1, `expected --start-from in ${JSON.stringify(args)}`);
  assert.equal(args[idx + 1], '5');
});

test('startFrom=0 (< 1) → flag dropped', async () => {
  const args = await getStartArgs('startFrom=0');
  assert.equal(args.indexOf('--start-from'), -1);
});

test('startFrom=abc (non-integer) → flag dropped', async () => {
  const args = await getStartArgs('startFrom=abc');
  assert.equal(args.indexOf('--start-from'), -1);
});

test('combined: model + startFrom + dryRun + parallel coexist', async () => {
  const args = await getStartArgs('model=claude-haiku-4-5&startFrom=10&dryRun=1&parallel=2');
  assert.ok(args.includes('--dry-run'));
  assert.equal(args[args.indexOf('--parallel') + 1], '2');
  assert.equal(args[args.indexOf('--model') + 1], 'claude-haiku-4-5');
  assert.equal(args[args.indexOf('--start-from') + 1], '10');
});
