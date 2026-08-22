#!/usr/bin/env node
/**
 * WS7 — point git at the in-repo .githooks/ dir. Idempotent; run by
 * `npm install` via the `prepare` script. No-op outside a git repo
 * (e.g. when installed as a published package tarball).
 */
import { execFileSync } from 'node:child_process';
try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
  console.log('✓ git core.hooksPath → .githooks (pre-commit AI review active)');
} catch {
  // Not a git checkout (npm tarball / CI cache) — nothing to wire.
}
