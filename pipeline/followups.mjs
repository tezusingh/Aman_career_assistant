// followups.mjs — who to chase today. Most interviews are lost to silence, not to
// rejection: a timely nudge measurably lifts reply rates.
//
// Reads career-ops' data/applications.md, and per status + date tells you which
// applications are due (or overdue) for a follow-up, using a simple cadence:
//   evaluated  -> nudge yourself to APPLY after 2 days
//   applied    -> follow up after 5 days (no reply)
//   responded  -> reply/keep warm after 3 days
//   interview  -> thank-you / status check after 2 days
// Terminal states (offer/hired/rejected/discarded/skip) are ignored.
//
// No LLM, no network. Usage:
//   node pipeline/followups.mjs
//   node pipeline/followups.mjs --applied 7 --responded 2   # override cadence days

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CAREER_OPS_ROOT = process.env.CAREER_OPS_ROOT || join(ROOT, 'career-ops');
const APPS_PATH = join(CAREER_OPS_ROOT, 'data', 'applications.md');

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
}
const CADENCE = {
  evaluated: arg('--evaluated', 2),
  applied:   arg('--applied', 5),
  responded: arg('--responded', 3),
  interview: arg('--interview', 2),
};
const CADENCE_ACTION = {
  evaluated: 'Apply — you evaluated it but never applied.',
  applied:   'Follow up — no reply since you applied.',
  responded: 'Reply / keep warm — they responded, keep momentum.',
  interview: 'Send a thank-you or ask for a status update.',
};

const STATE_ALIASES = {
  evaluated: ['evaluated', 'evaluada', 'condicional', 'hold'],
  applied:   ['applied', 'aplicado', 'enviada', 'aplicada', 'sent'],
  responded: ['responded', 'respondido'],
  interview: ['interview', 'entrevista'],
  offer: ['offer', 'oferta'], rejected: ['rejected', 'rechazado', 'rechazada'],
  discarded: ['discarded', 'descartado', 'descartada', 'cerrada', 'cancelada'],
  skip: ['skip', 'no_aplicar', 'monitor'], hired: ['hired', 'contratado', 'accepted'],
};
const ALIAS = new Map();
for (const [s, as] of Object.entries(STATE_ALIASES)) for (const a of as) ALIAS.set(a, s);
const statusOf = c => ALIAS.get(String(c || '').replace(/\*/g, '').trim().toLowerCase()) || null;

function parseRows(text) {
  const rows = [];
  let idx = { date: 2, company: 3, role: 4, status: 6 }, sawHeader = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim());
    if (!sawHeader) {
      const lower = cells.map(c => c.toLowerCase());
      if (lower.includes('status') && (lower.includes('company') || lower.includes('role'))) {
        idx = {
          date: lower.findIndex(c => c === 'date'),
          company: lower.findIndex(c => c === 'company'),
          role: lower.findIndex(c => c === 'role'),
          status: lower.findIndex(c => c === 'status'),
        };
        sawHeader = true;
      }
      continue;
    }
    if (/^[-\s|]+$/.test(line)) continue;
    const status = statusOf(cells[idx.status]);
    if (!status) continue;
    rows.push({
      date: idx.date >= 0 ? cells[idx.date] : '',
      company: idx.company >= 0 ? cells[idx.company] : '',
      role: idx.role >= 0 ? cells[idx.role] : '',
      status,
    });
  }
  return rows;
}

function daysSince(dateStr) {
  const d = Date.parse(dateStr);
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86400000);
}

function main() {
  if (!existsSync(APPS_PATH)) {
    console.log(`No data/applications.md yet at ${APPS_PATH}.`);
    console.log('Track a job in career-ops first, then follow-ups will show up here.');
    return;
  }
  const rows = parseRows(readFileSync(APPS_PATH, 'utf-8'));
  const due = [], upcoming = [], noDate = [];
  for (const r of rows) {
    const cad = CADENCE[r.status];
    if (cad === undefined) continue; // terminal state
    const age = daysSince(r.date);
    if (age === null) { noDate.push(r); continue; }
    const overdueBy = age - cad;
    if (overdueBy >= 0) due.push({ ...r, overdueBy, age });
    else upcoming.push({ ...r, inDays: -overdueBy, age });
  }
  due.sort((a, b) => b.overdueBy - a.overdueBy);
  upcoming.sort((a, b) => a.inDays - b.inDays);

  console.log('══════════════════════════════════════════════');
  console.log(' Follow-ups');
  console.log('══════════════════════════════════════════════');

  console.log(`\nDue now (${due.length})`);
  if (!due.length) console.log('  Nothing due — you are caught up.');
  for (const r of due) {
    const tag = r.overdueBy === 0 ? 'today' : `${r.overdueBy}d overdue`;
    console.log(`  • [${tag}] ${r.company} — ${r.role}  (${r.status}, ${r.age}d)`);
    console.log(`      → ${CADENCE_ACTION[r.status]}`);
  }

  if (upcoming.length) {
    console.log(`\nUpcoming (${upcoming.length})`);
    for (const r of upcoming.slice(0, 10)) {
      console.log(`  • in ${r.inDays}d  ${r.company} — ${r.role}  (${r.status})`);
    }
  }
  if (noDate.length) {
    console.log(`\nMissing a date (${noDate.length}) — add one so they enter the cadence:`);
    for (const r of noDate.slice(0, 10)) console.log(`  • ${r.company} — ${r.role} (${r.status})`);
  }
  console.log('');
}

main();
