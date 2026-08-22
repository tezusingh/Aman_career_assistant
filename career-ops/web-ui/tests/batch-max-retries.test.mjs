/**
 * v1.28.0 — `GET /api/stream/batch?maxRetries=N` passes through to the
 * `batch-runner.sh --max-retries N` flag (canonical career-ops.org/docs
 * `batch-evaluate-offers` claim).
 *
 * Branches covered:
 *   1. `retry=1` + `maxRetries=3` → args include `--max-retries 3`.
 *   2. `retry=1` + `maxRetries=11` (out of range) → flag dropped silently.
 *   3. `retry=1` + `maxRetries=0` (out of range) → flag dropped silently.
 *   4. `retry=1` + `maxRetries=abc` (non-int) → flag dropped silently.
 *   5. `retry=0` + `maxRetries=5` → flag dropped (max-retries is
 *      meaningless without --retry-failed).
 *   6. No `maxRetries` param → flag absent (runner default 2 wins).
 *
 * Test strategy: stub the runner with an empty script that just exits 0.
 * The SSE `start` event includes the `args` array — we parse the event,
 * pull args, and assert on flag presence/absence. No real batch executed.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'batch-mr-'));
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
  // Stub runner: just echo args to stderr (which becomes SSE 'log' frames)
  // and exit 0. The server's `start` SSE frame already carries the args list,
  // so we don't need the runner output — but we keep it for readability.
  const stub = '#!/usr/bin/env bash\necho "stub-runner args: $@" >&2\nexit 0\n';
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
  // Find the first `event: start` block.
  const m = text.match(/event:\s*start\s*\ndata:\s*(\{[^\n]+\})/);
  if (!m) throw new Error(`no start frame in:\n${text.slice(0, 400)}`);
  return JSON.parse(m[1]).args;
}

test('maxRetries=3 + retry=1 → args include --max-retries 3', async () => {
  const args = await getStartArgs('retry=1&maxRetries=3');
  assert.ok(args.includes('--retry-failed'), `expected --retry-failed in ${JSON.stringify(args)}`);
  const idx = args.indexOf('--max-retries');
  assert.notStrictEqual(idx, -1, `expected --max-retries flag in ${JSON.stringify(args)}`);
  assert.equal(args[idx + 1], '3');
});

test('maxRetries=11 (out of range, > 10) → flag silently dropped', async () => {
  const args = await getStartArgs('retry=1&maxRetries=11');
  assert.ok(args.includes('--retry-failed'));
  assert.equal(args.indexOf('--max-retries'), -1, `unexpected --max-retries in ${JSON.stringify(args)}`);
});

test('maxRetries=0 (out of range, < 1) → flag silently dropped', async () => {
  const args = await getStartArgs('retry=1&maxRetries=0');
  assert.ok(args.includes('--retry-failed'));
  assert.equal(args.indexOf('--max-retries'), -1);
});

test('maxRetries=abc (non-integer) → flag silently dropped', async () => {
  const args = await getStartArgs('retry=1&maxRetries=abc');
  assert.ok(args.includes('--retry-failed'));
  assert.equal(args.indexOf('--max-retries'), -1);
});

test('maxRetries=5 without retry=1 → flag dropped (depends on retry-failed)', async () => {
  const args = await getStartArgs('maxRetries=5');
  assert.equal(args.indexOf('--retry-failed'), -1, `unexpected --retry-failed in ${JSON.stringify(args)}`);
  assert.equal(args.indexOf('--max-retries'), -1, `--max-retries must not appear without --retry-failed in ${JSON.stringify(args)}`);
});

test('no maxRetries param + retry=1 → flag absent (runner default 2)', async () => {
  const args = await getStartArgs('retry=1');
  assert.ok(args.includes('--retry-failed'));
  assert.equal(args.indexOf('--max-retries'), -1);
});

test('combined: parallel=2 minScore=4.0 dryRun=1 retry=1 maxRetries=3 → all 4 flags + max-retries present', async () => {
  const args = await getStartArgs('parallel=2&minScore=4.0&dryRun=1&retry=1&maxRetries=3');
  assert.ok(args.includes('--dry-run'));
  assert.deepEqual(args.slice(args.indexOf('--parallel'), args.indexOf('--parallel') + 2), ['--parallel', '2']);
  assert.deepEqual(args.slice(args.indexOf('--min-score'), args.indexOf('--min-score') + 2), ['--min-score', '4.0']);
  assert.ok(args.includes('--retry-failed'));
  assert.deepEqual(args.slice(args.indexOf('--max-retries'), args.indexOf('--max-retries') + 2), ['--max-retries', '3']);
});
