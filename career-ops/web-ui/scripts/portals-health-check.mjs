#!/usr/bin/env node
/**
 * portals-health-check.mjs — sanity-checks every enabled company in
 * parent's portals.yml by HEAD-requesting its `careers_url`. Anything
 * that returns HTTP 4xx/5xx is reported so we can disable it before
 * the next scan.
 *
 * Usage:
 *   node scripts/portals-health-check.mjs                 # human-readable
 *   node scripts/portals-health-check.mjs --json          # machine-readable
 *   CAREER_OPS_ROOT=/path/to/career-ops node scripts/...  # explicit project
 *
 * Exit code:
 *   0  — all enabled portals respond < 400
 *   1  — at least one DEAD result
 *   2  — could not read portals.yml
 *
 * No network writes, no file edits — read-only by design. The output is
 * meant to feed a follow-up PR that flips `enabled: true` to `enabled: false`
 * the way FIX-C3 did.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveProjectRoot() {
  if (process.env.CAREER_OPS_ROOT) {
    return resolve(process.cwd(), process.env.CAREER_OPS_ROOT);
  }
  // scripts/ → web-ui/ → parent
  return resolve(__dirname, '..', '..');
}

const PROJECT_ROOT = resolveProjectRoot();
const PORTALS = resolve(PROJECT_ROOT, 'portals.yml');
const JSON_OUTPUT = process.argv.includes('--json');

if (!existsSync(PORTALS)) {
  console.error(`portals.yml not found at ${PORTALS}`);
  console.error('Set CAREER_OPS_ROOT to the parent project root.');
  process.exit(2);
}

let portals;
try {
  portals = yaml.load(readFileSync(PORTALS, 'utf8')) || {};
} catch (e) {
  console.error('YAML parse error:', e.message);
  process.exit(2);
}

const tracked = portals.tracked_companies || portals.companies || [];
const enabled = tracked.filter((c) => c.enabled !== false && c.careers_url);

if (!JSON_OUTPUT) {
  console.error(`Probing ${enabled.length} enabled companies (skipping ${tracked.length - enabled.length} disabled)…`);
}

async function probe(c) {
  const url = c.careers_url;
  try {
    // HEAD first (fast). Some sites reject HEAD with 405 — fall back to GET.
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'career-ops-portals-health-check/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'career-ops-portals-health-check/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
    }
    return { name: c.name, url, status: res.status, ok: res.ok };
  } catch (e) {
    return { name: c.name, url, status: 0, ok: false, error: e.message };
  }
}

const results = await Promise.all(enabled.map(probe));
const dead = results.filter((r) => !r.ok);

if (JSON_OUTPUT) {
  console.log(JSON.stringify({ probed: results.length, dead: dead.length, results }, null, 2));
} else {
  for (const r of results) {
    const tag = r.ok ? '✓' : '✗';
    const status = r.error ? `ERR ${r.error.slice(0, 60)}` : `HTTP ${r.status}`;
    console.log(`  ${tag} ${r.name.padEnd(28)} ${status.padEnd(20)} ${r.url}`);
  }
  console.log('');
  console.log(`  ${results.length - dead.length}/${results.length} alive · ${dead.length} dead`);
  if (dead.length) {
    console.log('');
    console.log('  Suggested patch — flip these to enabled: false in portals.yml:');
    for (const r of dead) console.log(`    - ${r.name}  (${r.error || 'HTTP ' + r.status})`);
  }
}

process.exit(dead.length ? 1 : 0);
