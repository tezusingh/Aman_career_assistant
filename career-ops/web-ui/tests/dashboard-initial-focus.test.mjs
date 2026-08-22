/**
 * v1.56.0 — UX-12: on the very first SPA paint the landing view's
 * heading must be programmatically focusable so screen-reader /
 * heading navigation can land on it (and #content is aria-live=
 * polite, so the dashboard heading is announced on boot) — WITHOUT
 * stealing focus, which would fight the skip-link (the deliberate
 * v1.41.0 behaviour). Only SUBSEQUENT route changes move focus.
 *
 * router.js is browser-only → asserted statically.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const R = readFileSync(resolve(__d, '..', 'public', 'js', 'router.js'), 'utf8');
const HTML = readFileSync(resolve(__d, '..', 'public', 'index.html'), 'utf8');

test('first-paint makes the heading focusable BEFORE the early return', () => {
  const fn = R.match(/function focusNewView\(content\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fn, 'focusNewView must exist');
  const body = fn[0];
  const tabIdx = body.indexOf("setAttribute('tabindex', '-1')");
  const guard = body.indexOf('if (!firstPaintDone)');
  assert.ok(tabIdx > -1 && guard > -1, 'both the tabindex set and the guard must be present');
  assert.ok(tabIdx < guard,
    'tabindex must be set BEFORE the first-paint early-return so the ' +
    'landing heading is focusable on boot');
});

test('first paint still does NOT steal focus (skip-link safe)', () => {
  const fn = R.match(/function focusNewView\(content\)\s*\{[\s\S]*?\n  \}/)[0];
  // The .focus() call must remain AFTER the firstPaintDone guard so
  // the very first paint never yanks focus from the skip-link.
  const guard = fn.indexOf('if (!firstPaintDone)');
  const focusCall = fn.indexOf('.focus({ preventScroll');
  assert.ok(focusCall > guard,
    'target.focus() must stay after the first-paint guard (v1.41.0)');
});

test('#content remains an aria-live polite region (boot announcement)', () => {
  assert.match(HTML, /id="content"[^>]*aria-live="polite"/,
    'the content region must stay aria-live=polite so the dashboard ' +
    'heading is announced on first paint without focus theft');
});
