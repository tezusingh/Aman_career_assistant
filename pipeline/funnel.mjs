// funnel.mjs — unified job-search funnel across JobOps (SQLite) + career-ops (tracker).
//
// Answers "where am I losing candidates?" so you fix the right stage:
//   many searched, few applied  -> raise search quality / lower noise
//   many applied, few responded -> outreach / referral problem (do more contacto)
//   many responded, few interview -> screening / CV-JD fit problem
//
// No LLM, no network. Reads JobOps' jobs.db and career-ops' data/applications.md.
// Degrades cleanly when either source is absent.
//
// Usage:  node pipeline/funnel.mjs

import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const JOBOPS_DB = process.env.JOBOPS_DB || join(ROOT, 'job-ops', 'data', 'jobs.db');
const CAREER_OPS_ROOT = process.env.CAREER_OPS_ROOT || join(ROOT, 'career-ops');
const APPS_PATH = join(CAREER_OPS_ROOT, 'data', 'applications.md');

// Canonical statuses + aliases (mirrors career-ops/templates/states.yml).
const STATE_ALIASES = {
  evaluated: ['evaluated', 'evaluada', 'condicional', 'hold', 'evaluar', 'verificar'],
  applied:   ['applied', 'aplicado', 'enviada', 'aplicada', 'sent'],
  responded: ['responded', 'respondido'],
  interview: ['interview', 'entrevista', 'mulakat'],
  offer:     ['offer', 'oferta', 'teklif'],
  rejected:  ['rejected', 'rechazado', 'rechazada'],
  discarded: ['discarded', 'descartado', 'descartada', 'cerrada', 'cancelada'],
  skip:      ['skip', 'no_aplicar', 'no aplicar', 'monitor', 'geo blocker'],
  hired:     ['hired', 'contratado', 'contratada', 'accepted', 'accept'],
};
const ALIAS_TO_STATE = new Map();
for (const [state, aliases] of Object.entries(STATE_ALIASES)) {
  for (const a of aliases) ALIAS_TO_STATE.set(a.toLowerCase(), state);
}

function canonicalStatus(cell) {
  const t = String(cell || '').replace(/\*/g, '').trim().toLowerCase();
  return ALIAS_TO_STATE.get(t) || null;
}

// Parse the career-ops tracker table. Header locates the status column by name;
// falls back to the documented fixed layout (num|date|company|role|score|status|…).
function readTrackerStatuses(text) {
  const counts = {};
  let statusIdx = 6, sawHeader = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim());
    if (!sawHeader) {
      const lower = cells.map(c => c.toLowerCase());
      const si = lower.findIndex(c => c === 'status');
      if (si !== -1 && lower.some(c => c === 'company' || c === 'role')) {
        statusIdx = si; sawHeader = true;
      }
      continue;
    }
    if (/^[-\s|]+$/.test(line)) continue; // separator row
    const status = canonicalStatus(cells[statusIdx]);
    if (status) counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function readJobOps() {
  if (!existsSync(JOBOPS_DB)) return null;
  try {
    const db = new DatabaseSync(JOBOPS_DB, { readOnly: true });
    const total = db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n;
    const scored = db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE suitability_score IS NOT NULL').get().n;
    const strong = db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE suitability_score >= 70').get().n;
    db.close();
    return { total, scored, strong };
  } catch (e) {
    return { error: e.message };
  }
}

function bar(n, max, width = 24) {
  if (max <= 0) return '░'.repeat(width);
  return '█'.repeat(Math.max(0, Math.round((n / max) * width))).padEnd(width, '░');
}

function pct(a, b) { return b > 0 ? `${Math.round((a / b) * 100)}%` : '—'; }

function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log(' Job-search funnel');
  console.log('════════════════════════════════════════════════════════');

  const jo = readJobOps();
  console.log('\nJobOps (discovery)');
  if (!jo) {
    console.log('  no jobs.db yet — run a search in JobOps (http://localhost:3005).');
  } else if (jo.error) {
    console.log(`  could not read jobs.db: ${jo.error}`);
  } else {
    const m = jo.total || 1;
    console.log(`  discovered   ${String(jo.total).padStart(5)}  ${bar(jo.total, m)}`);
    console.log(`  scored       ${String(jo.scored).padStart(5)}  ${bar(jo.scored, m)}  ${pct(jo.scored, jo.total)}`);
    console.log(`  strong ≥70   ${String(jo.strong).padStart(5)}  ${bar(jo.strong, m)}  ${pct(jo.strong, jo.total)}`);
  }

  console.log('\ncareer-ops (application funnel)');
  if (!existsSync(APPS_PATH)) {
    console.log('  no data/applications.md yet — evaluate + track a job in career-ops first.');
  } else {
    const counts = readTrackerStatuses(readFileSync(APPS_PATH, 'utf-8'));
    const order = ['evaluated', 'applied', 'responded', 'interview', 'offer', 'hired'];
    const applied = counts.applied || 0;
    const denom = Math.max(1, ...order.map(s => counts[s] || 0));
    for (const s of order) {
      const n = counts[s] || 0;
      console.log(`  ${s.padEnd(11)}${String(n).padStart(4)}  ${bar(n, denom)}`);
    }
    const rejected = counts.rejected || 0, skip = counts.skip || 0, discarded = counts.discarded || 0;
    console.log(`  ${'rejected'.padEnd(11)}${String(rejected).padStart(4)}   (skip ${skip}, discarded ${discarded})`);

    console.log('\nConversion');
    console.log(`  applied → responded   ${pct(counts.responded || 0, applied)}`);
    console.log(`  responded → interview ${pct(counts.interview || 0, counts.responded || 0)}`);
    console.log(`  interview → offer     ${pct(counts.offer || 0, counts.interview || 0)}`);

    // One actionable diagnosis.
    console.log('\nBiggest leak');
    if (applied === 0) console.log('  Nothing applied yet — start applying to your strong matches.');
    else if ((counts.responded || 0) / applied < 0.15)
      console.log('  Low reply rate → this is an OUTREACH gap. Use career-ops `contacto` for referrals + `email` for recruiter cold emails.');
    else if ((counts.interview || 0) / Math.max(1, counts.responded || 0) < 0.3)
      console.log('  Replies but few interviews → CV↔JD FIT gap. Run pipeline/ats-check.mjs before applying.');
    else console.log('  Funnel looks healthy — keep volume up.');
  }
  console.log('');
}

main();
