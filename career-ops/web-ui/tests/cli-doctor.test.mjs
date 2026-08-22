/**
 * WS8.1 (v1.38.0) — `career-ops-ui doctor` + CLI dispatcher.
 * formatReport is pure; the in-process /api/health reuse is the
 * single-source-of-truth contract (doctor never drifts from Health).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { formatReport } from '../scripts/doctor.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);

test('formatReport: all required pass → reqFail 0', () => {
  const { reqFail, text } = formatReport({
    version: '1.38.0', parentVersion: '1.8.0', warnings: 0,
    checks: [
      { name: 'Node version', required: true, ok: true, value: 'v20' },
      { name: 'cv.md', required: true, ok: true },
      { name: 'GEMINI_API_KEY', required: false, ok: false, value: 'unset' },
    ],
  });
  assert.equal(reqFail, 0);
  assert.match(text, /all required checks pass/);
});

test('formatReport: a required fail → reqFail > 0', () => {
  const { reqFail, text } = formatReport({
    version: '1.38.0', checks: [
      { name: 'Node version', required: true, ok: true },
      { name: 'portals.yml', required: true, ok: false },
    ],
  });
  assert.equal(reqFail, 1);
  assert.match(text, /1 required check\(s\) failing/);
});

test('formatReport: only optional fails → still reqFail 0', () => {
  const { reqFail } = formatReport({
    checks: [
      { name: 'cv.md', required: true, ok: true },
      { name: 'ANTHROPIC_API_KEY', required: false, ok: false },
      { name: 'Playwright', required: false, ok: false },
    ],
  });
  assert.equal(reqFail, 0);
});

test('formatReport tolerates empty/missing checks', () => {
  assert.equal(formatReport({}).reqFail, 0);
  assert.equal(formatReport({ checks: [] }).reqFail, 0);
});

test('CLI dispatcher routes setup/run/doctor/init/help', () => {
  const sh = readFileSync(R('bin', 'career-ops-ui.sh'), 'utf8');
  for (const verb of ['setup)', 'run|start)', 'doctor)', 'init)', 'help|-h|--help)']) {
    assert.ok(sh.includes(verb), `dispatcher missing case: ${verb}`);
  }
  assert.match(sh, /scripts\/doctor\.mjs/);
});

test('package.json bin points at the dispatcher', () => {
  const pkg = JSON.parse(readFileSync(R('package.json'), 'utf8'));
  assert.equal(pkg.bin['career-ops-ui'], 'bin/career-ops-ui.sh');
});
