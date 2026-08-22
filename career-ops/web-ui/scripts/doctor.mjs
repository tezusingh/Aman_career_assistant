#!/usr/bin/env node
/**
 * WS8.1 (v1.38.0) — `career-ops-ui doctor`.
 *
 * Standalone health check that reuses the EXACT `/api/health` engine
 * (single source of truth — doctor never drifts from the Health page).
 * Spins `createApp()` in-process on an ephemeral port, hits the
 * endpoint, renders a terminal report. Exit 0 when every REQUIRED
 * check is green; exit 1 otherwise (so `setup` / CI can gate on it).
 *
 * No new deps. Honors CLAUDE.md: read-only, no parent writes.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const C = process.stdout.isTTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', x: '\x1b[0m', b: '\x1b[1m' }
  : { g: '', r: '', y: '', dim: '', x: '', b: '' };

export function formatReport(health) {
  const lines = [];
  lines.push(`${C.b}career-ops-ui doctor${C.x} — v${health.version || '?'} ` +
    `(parent ${health.parentVersion || 'n/a'})`);
  lines.push('');
  let reqFail = 0;
  for (const c of health.checks || []) {
    const req = c.required;
    const ok = c.ok;
    if (req && !ok) reqFail++;
    const icon = ok ? `${C.g}✓${C.x}` : (req ? `${C.r}✗${C.x}` : `${C.y}○${C.x}`);
    const tag = req ? '' : `${C.dim} (optional)${C.x}`;
    const val = c.value ? `${C.dim} — ${c.value}${C.x}` : '';
    lines.push(`  ${icon} ${c.name}${tag}${val}`);
  }
  lines.push('');
  lines.push(reqFail === 0
    ? `${C.g}✓ all required checks pass${C.x}` +
      (health.warnings ? `${C.y} · ${health.warnings} optional warning(s)${C.x}` : '')
    : `${C.r}✗ ${reqFail} required check(s) failing — fix before running${C.x}`);
  return { text: lines.join('\n'), reqFail };
}

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try {
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const health = await res.json();
    const { text, reqFail } = formatReport(health);
    console.log(text);
    process.exitCode = reqFail === 0 ? 0 : 1;
  } catch (e) {
    console.error(`${C.r}✗ doctor failed:${C.x} ${e.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
