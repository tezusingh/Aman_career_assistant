/**
 * v1.58.49 (TOOL-1) — `scripts/clean-test-fixtures.mjs` strips
 * example.com lines from `${CAREER_OPS_ROOT}/data/pipeline.md`.
 *
 * The test is CI-isolated: it creates a temporary parent-project root
 * under `mkdtempSync`, seeds a synthetic `data/pipeline.md` with a
 * mixture of real ATS URLs + example.com fixtures, runs the script
 * under that root, and asserts:
 *  - Only example.com lines were removed.
 *  - Real ATS URLs round-trip unchanged.
 *  - The script reports the count correctly.
 *  - `--dry-run` reports the count but does NOT modify the file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__d, '..', 'scripts', 'clean-test-fixtures.mjs');

function seed() {
  const root = mkdtempSync(resolve(tmpdir(), 'co-clean-fixtures-'));
  mkdirSync(resolve(root, 'data'));
  const pipelinePath = resolve(root, 'data', 'pipeline.md');
  const content = [
    '# Pipeline',
    '',
    '- https://boards.greenhouse.io/anthropic/jobs/4567',
    '- https://example.com/job/1',
    '- https://jobs.lever.co/figma/abc-123',
    '- https://EXAMPLE.com/job/2',
    '- https://hh.ru/vacancy/99999',
    '- https://www.example.com/x',
    '- https://career.habr.com/vacancies/1000111',
  ].join('\n');
  writeFileSync(pipelinePath, content);
  return { root, pipelinePath };
}

function run(args, root) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, CAREER_OPS_ROOT: root },
    encoding: 'utf8',
  });
}

test('TOOL-1 (v1.58.49): removes every example.com line, preserves real ATS URLs', () => {
  const { root, pipelinePath } = seed();
  const r = run([], root);
  assert.equal(r.status, 0, 'script must exit 0 on success');
  assert.match(r.stdout, /Removed 3 example\.com fixtures/, 'stdout must report removed count');

  const after = readFileSync(pipelinePath, 'utf8');
  // Every example.com (any case) gone:
  assert.ok(!/example\.com/i.test(after),
    `example.com lines must be removed; got:\n${after}`);
  // Real ATS lines preserved:
  for (const must of [
    'boards.greenhouse.io/anthropic/jobs/4567',
    'jobs.lever.co/figma/abc-123',
    'hh.ru/vacancy/99999',
    'career.habr.com/vacancies/1000111',
  ]) {
    assert.ok(after.includes(must), `real ATS URL must be preserved: ${must}`);
  }
});

test('TOOL-1 (v1.58.49): --dry-run reports the count but does not write the file', () => {
  const { root, pipelinePath } = seed();
  const before = readFileSync(pipelinePath, 'utf8');
  const r = run(['--dry-run'], root);
  assert.equal(r.status, 0, 'script must exit 0 in dry-run too');
  assert.match(r.stderr, /\(dry-run\) Would remove 3 example\.com/,
    'stderr must report the dry-run count');
  const after = readFileSync(pipelinePath, 'utf8');
  assert.equal(after, before, 'dry-run must not modify the file');
});

test('TOOL-1 (v1.58.49): a clean file is a no-op (exit 0, no write)', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'co-clean-fixtures-clean-'));
  mkdirSync(resolve(root, 'data'));
  const pipelinePath = resolve(root, 'data', 'pipeline.md');
  writeFileSync(pipelinePath, '- https://boards.greenhouse.io/x/jobs/1\n');
  const r = run([], root);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No example\.com fixtures found/);
});

test('TOOL-1 (v1.58.49): missing pipeline.md exits 2 with a clear error', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'co-clean-fixtures-missing-'));
  const r = run([], root);
  assert.equal(r.status, 2, 'must exit 2 when pipeline.md is absent');
  assert.match(r.stderr, /not found/);
});
