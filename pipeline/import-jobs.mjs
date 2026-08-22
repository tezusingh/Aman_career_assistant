// import-jobs.mjs — Bridge: JobOps (SQLite) -> career-ops (data/pipeline.md)
//
// Reads the jobs JobOps has scraped/scored from its local SQLite DB and appends
// the qualifying ones to career-ops' pipeline so they can be deep-evaluated,
// tailored, and turned into referral/cold-email drafts.
//
// No auth, no network: reads JobOps' DB file directly and writes a markdown file.
//
// Usage (from anywhere):
//   node pipeline/import-jobs.mjs
//   node pipeline/import-jobs.mjs --min-score 60 --status discovered,ready
//   node pipeline/import-jobs.mjs --dry-run
//
// Env overrides:
//   JOBOPS_DB         path to jobs.db (default: ../job-ops/data/jobs.db)
//   CAREER_OPS_ROOT   career-ops project dir (default: ../career-ops)
//   MIN_SCORE         minimum suitabilityScore 0-100 (default: 70)
//   STATUSES          comma list of JobOps statuses to import (default: discovered,ready)

import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const DRY_RUN = process.argv.includes('--dry-run');

const JOBOPS_DB = process.env.JOBOPS_DB || join(ROOT, 'job-ops', 'data', 'jobs.db');
const CAREER_OPS_ROOT = process.env.CAREER_OPS_ROOT || join(ROOT, 'career-ops');
const PIPELINE_PATH = join(CAREER_OPS_ROOT, 'data', 'pipeline.md');
const MIN_SCORE = Number(arg('--min-score', process.env.MIN_SCORE || '70'));
const STATUSES = (arg('--status', process.env.STATUSES || 'discovered,ready'))
  .split(',').map(s => s.trim()).filter(Boolean);

const PIPELINE_SKELETON = `# Pipeline — Pending URLs

Paste job URLs below as \`- [ ] {url}\` then run \`/career-ops pipeline\`.

## Pending

## Processed
`;

// Normalize a URL for dedup: lowercase host+path, drop trailing slash and hash.
function normUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    u.pathname = u.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    u.host = u.host.toLowerCase();
    return u.toString();
  } catch {
    return String(url || '').trim();
  }
}

// `|` is the pipeline column separator and newlines break the row; neutralize both.
function field(v) {
  return String(v ?? '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function existingUrls(text) {
  const seen = new Set();
  for (const m of text.matchAll(/https?:\/\/[^\s|]+/g)) seen.add(normUrl(m[0]));
  return seen;
}

function toEntry(job) {
  const url = field(job.jobUrl || job.applicationLink);
  const parts = [`- [ ] ${url}`, field(job.employer), field(job.title)];
  const loc = field(job.location);
  if (loc) parts.push(loc);
  return parts.join(' | ');
}

function main() {
  if (!existsSync(JOBOPS_DB)) {
    console.error(`JobOps DB not found at: ${JOBOPS_DB}`);
    console.error('Run a search in JobOps first (http://localhost:3005) so it creates jobs.db, then re-run this bridge.');
    process.exit(2);
  }

  const db = new DatabaseSync(JOBOPS_DB, { readOnly: true });
  const placeholders = STATUSES.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, job_url AS jobUrl, application_link AS applicationLink,
            title, employer, location,
            suitability_score AS suitabilityScore, status
     FROM jobs
     WHERE status IN (${placeholders})
       AND suitability_score IS NOT NULL
       AND suitability_score >= ?
     ORDER BY suitability_score DESC`
  ).all(...STATUSES, MIN_SCORE);
  db.close();

  const qualifying = rows.filter(r => (r.jobUrl || r.applicationLink));
  if (qualifying.length === 0) {
    console.log(`No JobOps jobs matched (min-score ${MIN_SCORE}, status ${STATUSES.join('/')}).`);
    return;
  }

  let text = existsSync(PIPELINE_PATH) ? readFileSync(PIPELINE_PATH, 'utf-8') : PIPELINE_SKELETON;
  const seen = existingUrls(text);

  const fresh = [];
  for (const job of qualifying) {
    const key = normUrl(job.jobUrl || job.applicationLink);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(job);
  }

  console.log(`JobOps matched: ${qualifying.length} | already in pipeline: ${qualifying.length - fresh.length} | new: ${fresh.length}`);
  if (fresh.length === 0) return;

  const block = fresh.map(toEntry).join('\n');
  for (const job of fresh) {
    console.log(`  + [${Math.round(job.suitabilityScore)}] ${field(job.employer)} — ${field(job.title)}`);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written. Would append the above under "## Pending".');
    return;
  }

  // Insert under "## Pending" (create skeleton if the file is missing/blank).
  if (!text.includes('## Pending')) text = PIPELINE_SKELETON;
  const marker = '## Pending';
  const at = text.indexOf(marker) + marker.length;
  const nextSection = text.indexOf('\n## ', at);
  const insertAt = nextSection === -1 ? text.length : nextSection;
  text = text.slice(0, insertAt) + '\n' + block + '\n' + text.slice(insertAt);

  mkdirSync(dirname(PIPELINE_PATH), { recursive: true });
  writeFileSync(PIPELINE_PATH, text, 'utf-8');
  console.log(`\nWrote ${fresh.length} job(s) to ${PIPELINE_PATH}`);
  console.log('Next: evaluate + draft outreach in career-ops (web-ui #/pipeline, or /career-ops pipeline in your AI CLI).');
}

main();
