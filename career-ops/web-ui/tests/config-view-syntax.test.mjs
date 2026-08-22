/**
 * v1.24.1 (G-015) — config.js syntax + no-.also-leftover canary.
 *
 * The G-015 regression was a runtime crash on `#/config`:
 * `c(...).also is not a function`. Element.prototype.also was a
 * monkey-patch dropped by v1.22.0 N-2; cv.js was migrated then, but
 * config.js kept calling `.also(...)` on a chained `c(...)` expression
 * and crashed at first invocation of the view.
 *
 * Browser-level proof is in Playwright smoke (existing `Config keys
 * masked` and `App settings` flows render the page end-to-end). This
 * unit file adds a static guard so a CI run without Playwright still
 * catches the regression: parse config.js with the Node `vm` module
 * to confirm it compiles, and assert no `.also(` call sites survive.
 *
 * Pairs with the broader `scripts/check-no-also-leftovers.mjs` CI gate
 * that sweeps every file under `public/js/views/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Script } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_VIEW = resolve(__dirname, '..', 'public', 'js', 'views', 'config.js');

test('config.js parses with no syntax errors', () => {
  const src = readFileSync(CONFIG_VIEW, 'utf8');
  // The view is a browser-side IIFE that reads `Router`, `UI`, `API`,
  // `I18n` from the global scope. We only validate that the file is
  // syntactically valid JS — not execute it. `new Script(src)` throws
  // on parse error, which is the regression we want to catch.
  assert.doesNotThrow(() => new Script(src), 'config.js failed to parse');
});

test('config.js has no .also( call sites (G-015 canary)', () => {
  // The hot-fix removed the single call site. If a future refactor
  // accidentally re-introduces `.also(` via the chained-builder idiom,
  // this test fires before the SPA does.
  const src = readFileSync(CONFIG_VIEW, 'utf8');
  // Strip line + block comments before scanning so the migration-note
  // comment ("was `.also((root) => …)` via Element.prototype.also")
  // doesn't trigger a false positive.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  assert.equal(/\.also\(/.test(stripped), false,
    'config.js still calls .also( — Element.prototype.also was removed in v1.22.0 N-2');
});

test('config.js returns the tree via a named const + setup block', () => {
  // The migration pattern (from cv.js:188+) is:
  //   const root = c('div', null, [ … ]);
  //   { … setup statements using `root` … }
  //   return root;
  // Assert each piece is present so a regression in the migration
  // shape (e.g., someone re-chaining the return) is caught.
  const src = readFileSync(CONFIG_VIEW, 'utf8');
  assert.match(src, /const root = c\('div'/,
    'config.js: expected `const root = c(\'div\'…` migration anchor');
  assert.match(src, /return root;/,
    'config.js: expected `return root;` at end of view factory');
});
