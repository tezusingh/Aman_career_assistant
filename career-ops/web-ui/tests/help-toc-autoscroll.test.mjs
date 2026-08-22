/**
 * v1.56.0 — UX-11: when the #/help TOC filter narrows to EXACTLY one
 * section, jump there for the user after a 300ms idle (debounced so
 * mid-typing keystrokes don't yank the page). Never fires for 0 or
 * >1 matches. help.js is browser-only → source-static.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const HELP = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'help.js'), 'utf8');

test('each TOC link records its target heading id', () => {
  assert.match(HELP, /a\.dataset\.targetId = h\.id/,
    'tocLinks must carry dataset.targetId for the 1-match jump');
});

test('the filter debounces and only auto-scrolls on exactly 1 match', () => {
  assert.match(HELP, /clearTimeout\(tocScrollTimer\)/,
    'previous pending jump must be cancelled on each keystroke');
  assert.match(HELP, /visible\.length === 1/,
    'auto-scroll only when exactly one section remains');
  assert.match(HELP, /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*300\s*\)/,
    'a 300ms idle debounce must guard the jump');
  // Reuses the same scroll+focus pattern as the click handler.
  assert.match(HELP, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
});

test('a 0-match or >1-match filter does NOT schedule a jump', () => {
  // The setTimeout is inside the `q && visible.length === 1` guard,
  // so the clearTimeout always runs but a new timer is only armed
  // for the single-match case.
  assert.match(HELP,
    /clearTimeout\(tocScrollTimer\);\s*\n\s*if \(q && visible\.length === 1\)/,
    'jump scheduling must be gated behind the exactly-one-match check');
});
