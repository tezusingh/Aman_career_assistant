/**
 * v1.43.0 (user-requested) — `career-ops-ui open` / autostart browser
 * raise. Pure helpers (dashboardUrl, openAndRaise platform routing) are
 * unit-tested without launching a real browser; the dispatcher + start.sh
 * wiring is asserted statically (no spawn, CI-isolated).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { dashboardUrl, openAndRaise, waitForHealth } from '../scripts/open-dashboard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);

test('dashboardUrl: defaults to 127.0.0.1:4317', () => {
  assert.equal(dashboardUrl({}), 'http://127.0.0.1:4317/');
});

test('dashboardUrl: honors PORT', () => {
  assert.equal(dashboardUrl({ PORT: '8080' }), 'http://127.0.0.1:8080/');
});

test('dashboardUrl: wildcard binds → 127.0.0.1 (0.0.0.0 / :: / [::])', () => {
  // A server bound to a wildcard is unreachable as a URL — must be
  // rewritten to loopback so the browser can actually open it.
  for (const h of ['0.0.0.0', '::', '[::]', '0:0:0:0:0:0:0:0', '']) {
    assert.equal(dashboardUrl({ HOST: h, PORT: '4317' }), 'http://127.0.0.1:4317/', `HOST=${h}`);
  }
});

test('dashboardUrl: explicit HOST is preserved', () => {
  assert.equal(dashboardUrl({ HOST: '192.168.1.50', PORT: '4317' }), 'http://192.168.1.50:4317/');
});

test('openAndRaise: routes per platform with an injected runner (no real spawn)', async () => {
  // CRITICAL: a bare `npm test` must never pop a browser. The runner is
  // dependency-injected so we assert routing + the commands that WOULD
  // run, with zero process spawns.
  const mk = () => { const calls = []; return [calls, (c, a) => { calls.push([c, a.join(' ')]); return Promise.resolve(true); }]; };

  const [mac, rMac] = mk();
  assert.equal(await openAndRaise('http://127.0.0.1:4317/', 'darwin', rMac), 'darwin');
  assert.deepEqual(mac[0], ['open', 'http://127.0.0.1:4317/']);
  assert.equal(mac[1][0], 'osascript');
  assert.match(mac[1][1], /Google Chrome[\s\S]*Safari[\s\S]*Firefox/);

  const [win, rWin] = mk();
  assert.equal(await openAndRaise('http://127.0.0.1:4317/', 'win32', rWin), 'win32');
  assert.deepEqual(win[0], ['cmd', '/c start  http://127.0.0.1:4317/']);

  const [lin, rLin] = mk();
  assert.equal(await openAndRaise('http://127.0.0.1:4317/', 'linux', rLin), 'linux');
  assert.deepEqual(lin[0], ['xdg-open', 'http://127.0.0.1:4317/']);
  assert.ok(lin.slice(1).every(([c]) => c === 'wmctrl'), 'linux raise tries wmctrl titles');
  assert.ok(lin.length > 2, 'linux tries multiple browser titles, not just Firefox');
});

test('waitForHealth: returns false fast against a dead port (bounded)', async () => {
  const t0 = Date.now();
  const ok = await waitForHealth('http://127.0.0.1:59999/', { timeoutMs: 800, stepMs: 200 });
  assert.equal(ok, false);
  assert.ok(Date.now() - t0 < 4000, 'must respect the timeout bound');
});

test('dispatcher: open/dash/focus verbs route to open-dashboard.mjs', () => {
  const sh = readFileSync(R('bin', 'career-ops-ui.sh'), 'utf8');
  assert.match(sh, /open\|dash\|focus\)/);
  assert.match(sh, /scripts\/open-dashboard\.mjs/);
  assert.match(sh, /career-ops-ui open\s+\S+ open \+ RAISE/);
});

test('start.sh: autostart delegates to open-dashboard.mjs + honors NO_OPEN', () => {
  const sh = readFileSync(R('bin', 'start.sh'), 'utf8');
  assert.match(sh, /scripts\/open-dashboard\.mjs/);
  assert.match(sh, /NO_OPEN/);
  // The old bare-open path must be gone (no silent background tab).
  assert.ok(!/open "\$URL" 2>\/dev\/null/.test(sh), 'start.sh still uses bare `open $URL`');
});
