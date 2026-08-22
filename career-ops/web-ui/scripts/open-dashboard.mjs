#!/usr/bin/env node
// v1.43.0 (user-requested) — open AND raise the dashboard browser tab.
// bare `open`/`xdg-open` left it in the background; rationale + usage in
// CHANGELOG [1.43.0]. Flags: `--no-wait` skips the /api/health poll.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WILDCARD_HOSTS = new Set(['', '0.0.0.0', '::', '[::]', '0:0:0:0:0:0:0:0']);

export function dashboardUrl(env = process.env) {
  // A server bound to a wildcard (0.0.0.0 / :: / [::]) is unreachable as
  // a URL — rewrite to loopback so the browser can actually open it.
  const raw = (env.HOST || '').trim();
  const host = WILDCARD_HOSTS.has(raw) ? '127.0.0.1' : raw;
  const port = env.PORT || '4317';
  return `http://${host}:${port}/`;
}

/** Resolve true once GET <url>api/health answers, or after `timeoutMs`. */
export async function waitForHealth(url, { timeoutMs = 12_000, stepMs = 400 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const healthUrl = url.replace(/\/$/, '') + '/api/health';
  while (Date.now() < deadline) {
    try {
      const r = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}

function run(cmd, args) {
  return new Promise((res) => {
    try {
      const p = spawn(cmd, args, { stdio: 'ignore', detached: false });
      p.on('error', () => res(false));
      p.on('exit', (code) => res(code === 0));
    } catch { res(false); }
  });
}

const RAISE_TITLES = ['Google Chrome', 'Brave Browser', 'Microsoft Edge', 'Safari', 'Arc', 'Firefox', 'Chromium'];

// Open `url` in the default browser and raise its window. `runner` is
// injected so tests assert platform routing with ZERO real spawns (a
// bare `npm test` must never pop a browser); returns the platform key.
export async function openAndRaise(url, platform = process.platform, runner = run) {
  if (platform === 'darwin') {
    await runner('open', [url]);
    const osa = RAISE_TITLES
      .map((b) => `if application "${b}" is running then tell application "${b}" to activate`)
      .join('\n');
    await runner('osascript', ['-e', osa]);
    return 'darwin';
  }
  if (platform === 'win32') {
    await runner('cmd', ['/c', 'start', '', url]);
    return 'win32';
  }
  // linux / *nix — xdg-open picks the default browser; wmctrl (if
  // present) raises whichever common browser window exists, in order.
  await runner('xdg-open', [url]);
  for (const title of RAISE_TITLES) await runner('wmctrl', ['-a', title]);
  return 'linux';
}

async function main() {
  const args = process.argv.slice(2);
  const noWait = args.includes('--no-wait');
  const url = dashboardUrl();
  console.log(`career-ops-ui — dashboard: ${url}`);
  if (!noWait) {
    const up = await waitForHealth(url);
    if (!up) {
      console.log('  (server not answering yet — opening anyway; reload if it 404s)');
    }
  }
  await openAndRaise(url);
  console.log('  ↑ browser raised. If you don\'t see it, open the URL above manually.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('open-dashboard failed:', e.message); process.exit(1); });
}
