#!/usr/bin/env node
/**
 * v1.58.49 (TOOL-1) — strip example.com test fixtures from the parent
 * project's data/pipeline.md.
 *
 * Why this is here, not in the parent repo: the fixtures accumulate
 * during web-ui regression runs (Playwright smoke + E2E paste
 * `https://example.com/job/<n>` URLs into #/pipeline). The v1.58.36
 * audit found 1252+ such entries piled up. Manual cleanup is tedious.
 *
 * Contract:
 *  - Reads `${CAREER_OPS_ROOT or ..}/data/pipeline.md`.
 *  - Removes every line containing `example.com` (case-insensitive).
 *  - Preserves every line that doesn't reference example.com — real
 *    ATS URLs (greenhouse / lever / ashby / workable / smartrecruiters
 *    / workday / hh.ru / habr) round-trip unchanged.
 *  - Dry-run mode via `--dry-run`: prints the would-be filtered output
 *    to stdout, makes no on-disk changes.
 *  - On a writable run prints `Removed N example.com fixtures.` and
 *    exits 0 if anything happened, or `No example.com fixtures found.`
 *    and exits 0 if there was nothing to do.
 *
 * Doctrine — this script writes to the parent project, so it's a
 * destructive operation by definition. Guard it behind an explicit
 * `--confirm` flag in CI; on local runs it's a one-shot the user
 * deliberately invokes via `make clean-test-fixtures`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.env.CAREER_OPS_ROOT
  || resolve(new URL('..', import.meta.url).pathname, '..');
const path = resolve(root, 'data', 'pipeline.md');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

if (!existsSync(path)) {
  console.error(`pipeline.md not found at ${path}`);
  process.exit(2);
}

const before = readFileSync(path, 'utf8');
const lines = before.split('\n');
// Match `example.com` anywhere on the line (the URL form on a pipeline
// line is the literal address); case-insensitive to catch
// `EXAMPLE.com` typos too. Don't touch blank lines or markdown
// structure.
const filtered = lines.filter((l) => !/example\.com/i.test(l));
const removed = lines.length - filtered.length;

if (removed === 0) {
  console.log(`No example.com fixtures found in ${path}.`);
  process.exit(0);
}

if (dryRun) {
  process.stdout.write(filtered.join('\n'));
  console.error(`\n(dry-run) Would remove ${removed} example.com line(s) from ${path}.`);
  process.exit(0);
}

writeFileSync(path, filtered.join('\n'));
console.log(`Removed ${removed} example.com fixtures from ${path}.`);
