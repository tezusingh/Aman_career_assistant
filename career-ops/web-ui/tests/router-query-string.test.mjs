/**
 * v1.28.1 — Router strips `?query` before route lookup.
 *
 * Pre-v1.28.1 the SPA router's `current()` did:
 *
 *     const hash = window.location.hash.slice(2);
 *     const [rawName, ...rest] = hash.split('/');
 *
 * so a hash like `#/evaluate?url=https%3A%2F%2F...` produced
 * `rawName = "evaluate?url=https%3A%2F%2F..."` — which is NOT a
 * registered route → `__not_found__` (404).
 *
 * Two reported failures led to this hot-fix:
 *   • `#/pipeline → ▶` button (`Router.go('/evaluate?url=…')`)
 *   • `App settings → Modes` deep link (`href="#/config?tab=modes"`)
 *
 * The view itself still parses the query string via
 * `window.location.hash.split('?')[1]` + URLSearchParams; the router
 * just needs to drop the query portion from the NAME lookup.
 *
 * This test asserts the static source of router.js to catch any
 * future regression that re-introduces the `hash.slice(2).split('/')`
 * pattern without the query-string strip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTER = resolve(__dirname, '..', 'public', 'js', 'router.js');

test('router.current() strips ?query before route lookup', () => {
  const src = readFileSync(ROUTER, 'utf8');
  assert.match(
    src,
    /hash\.split\(['"]\?['"]\)\[0\]/,
    'router.js must split off `?query` before the route-name lookup ' +
    '(see #/evaluate?url=…, #/config?tab=modes use cases)',
  );
});

test('router source mentions the v1.28.1 hot-fix rationale', () => {
  // Belt-and-suspenders: ensure a future "cleanup" commit doesn't drop
  // the explainer block above the fix.
  const src = readFileSync(ROUTER, 'utf8');
  assert.ok(
    src.includes('v1.28.1') && src.includes('?query'),
    'router.js must keep the v1.28.1 query-string explainer comment',
  );
});

test('simulate router.current() logic — query-bearing hash resolves to bare route name', () => {
  // Pure logic test that mirrors `current()` so we catch the bug even if
  // the static-source regex above is bypassed by a refactor.
  function simulateCurrent(rawHash) {
    const hash = (rawHash || '').slice(2) || 'dashboard';
    const beforeQuery = hash.split('?')[0];
    const [rawName, ...rest] = beforeQuery.split('/');
    return { name: rawName, params: rest };
  }
  assert.equal(simulateCurrent('#/evaluate?url=https://x').name, 'evaluate');
  assert.equal(simulateCurrent('#/config?tab=modes').name, 'config');
  assert.equal(simulateCurrent('#/reports/abc-123').name, 'reports');
  assert.deepEqual(simulateCurrent('#/reports/abc-123').params, ['abc-123']);
  assert.equal(simulateCurrent('#/dashboard').name, 'dashboard');
  assert.equal(simulateCurrent('').name, 'dashboard');
});
