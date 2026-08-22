/**
 * v1.69.2 — test-root isolation guard.
 *
 * `server/lib/paths.mjs` resolves PROJECT_ROOT (the parent career-ops dir)
 * EAGERLY at module load, and "PATHS resolves once per process". A test that
 * needs an isolated `CAREER_OPS_ROOT` (temp dir) MUST set the env var BEFORE the
 * first import of any paths.mjs-backed module — otherwise PATHS pins the REAL
 * parent and write endpoints (e.g. `PUT /api/profile`) leak fixtures into the
 * user's real `config/profile.yml` / `data/`.
 *
 * Root cause that prompted this guard (v1.69.2): `critical-fixes.test.mjs`
 * statically imported `prompts.mjs` (→ paths.mjs) at the top of the file, so the
 * F-008 `PUT /api/profile` wrote "Acceptance Test" into the real profile on every
 * `npm test`. Fix: load such modules via DYNAMIC `import()` inside `before()`,
 * after `process.env.CAREER_OPS_ROOT` is set.
 *
 * These known paths.mjs carriers must never be statically imported by a test that
 * also sets CAREER_OPS_ROOT.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));

// Modules whose import eagerly resolves PATHS (directly or transitively).
const PATHS_CARRIERS = [
  '../server/index.mjs',
  '../server/lib/prompts.mjs',
  '../server/lib/store.mjs',
  '../server/lib/en-scanner.mjs',
  '../server/lib/ru-scanner.mjs',
  '../server/lib/paths.mjs',
];

function testFiles() {
  return readdirSync(TESTS_DIR).filter((n) => n.endsWith('.test.mjs'));
}

test('no test that sets CAREER_OPS_ROOT statically imports a paths.mjs carrier', () => {
  const offenders = [];
  for (const f of testFiles()) {
    const src = readFileSync(resolve(TESTS_DIR, f), 'utf8');
    if (!/process\.env\.CAREER_OPS_ROOT\s*=/.test(src)) continue; // only isolation-needing tests
    for (const carrier of PATHS_CARRIERS) {
      // a TOP-LEVEL static `import ... from '<carrier>'` (column 0, not `await import(`)
      const re = new RegExp(`^import\\s+[^\\n]*from\\s+'${carrier.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'`, 'm');
      if (re.test(src)) offenders.push(`${f} → static import of ${carrier}`);
    }
  }
  assert.deepEqual(offenders, [],
    `These tests set CAREER_OPS_ROOT but statically import a PATHS carrier (resolve it dynamically inside before() instead):\n  ${offenders.join('\n  ')}`);
});

test('critical-fixes.test.mjs loads prompts.mjs via dynamic import (regression lock)', () => {
  const src = readFileSync(resolve(TESTS_DIR, 'critical-fixes.test.mjs'), 'utf8');
  assert.doesNotMatch(src, /^import\s+[^\n]*from\s+'\.\.\/server\/lib\/prompts\.mjs'/m,
    'prompts.mjs must NOT be a top-level static import in critical-fixes.test.mjs');
  assert.match(src, /await import\('\.\.\/server\/lib\/prompts\.mjs'\)/,
    'critical-fixes.test.mjs must load prompts.mjs via dynamic import() inside before()');
});
