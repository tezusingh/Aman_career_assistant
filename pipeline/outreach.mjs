// outreach.mjs — turn your career-ops pipeline into per-job outreach worksheets.
//
// Applications get you in the queue; a referral or a recruiter reply gets you the
// interview. For every pending job this writes a worksheet with:
//   • a filled starter draft you can send as-is (LinkedIn note + recruiter cold email
//     + peer referral ask), and
//   • a "sharpen with AI" prompt to paste into career-ops (web-ui or CLI) for a
//     tailored version once your keys are set.
//
// No LLM and no network — reads data/pipeline.md + config/profile.yml, writes markdown.
//
// Usage:
//   node pipeline/outreach.mjs                 # all pending jobs
//   node pipeline/outreach.mjs --limit 10
//   node pipeline/outreach.mjs --out career-ops/networking/outreach

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const require = createRequire(import.meta.url);

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const CAREER_OPS_ROOT = process.env.CAREER_OPS_ROOT || join(ROOT, 'career-ops');
const PIPELINE_PATH = join(CAREER_OPS_ROOT, 'data', 'pipeline.md');
const PROFILE_PATH = join(CAREER_OPS_ROOT, 'config', 'profile.yml');
const OUT_DIR = resolve(arg('--out', join(CAREER_OPS_ROOT, 'networking', 'outreach')));
const LIMIT = Number(arg('--limit', '0')); // 0 = all

// Load profile via career-ops' js-yaml if present; degrade to empty profile otherwise.
function loadProfile() {
  if (!existsSync(PROFILE_PATH)) return {};
  try {
    const yaml = require(join(CAREER_OPS_ROOT, 'node_modules', 'js-yaml'));
    return yaml.load(readFileSync(PROFILE_PATH, 'utf-8')) || {};
  } catch {
    return {}; // js-yaml not installed yet — worksheets still render with placeholders
  }
}

// Pending pipeline rows: "- [ ] {url} | {company} | {title} | {location}".
function parsePipeline(text) {
  const jobs = [];
  let inPending = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) { inPending = /pending/i.test(line); continue; }
    if (!inPending) continue;
    const m = line.match(/^-\s*\[[ xX]\]\s*(.+)$/);
    if (!m) continue;
    const parts = m[1].split('|').map(s => s.trim());
    const url = parts[0] || '';
    if (!/^https?:\/\//.test(url)) continue;
    jobs.push({ url, company: parts[1] || '', title: parts[2] || '', location: parts[3] || '' });
  }
  return jobs;
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'job';
}

function worksheet(job, p) {
  const c = p.candidate || {};
  const n = p.narrative || {};
  const name = c.full_name || '[Your Name]';
  const headline = n.headline || '[your one-line headline]';
  const linkedin = c.linkedin || '[your LinkedIn]';
  const email = c.email || '[your email]';
  const supers = Array.isArray(n.superpowers) ? n.superpowers : [];
  const proofs = Array.isArray(n.proof_points) ? n.proof_points : [];
  const role = job.title || '[role]';
  const company = job.company || '[company]';

  const proofLines = proofs.length
    ? proofs.map(pp => `- ${pp.name || 'Project'}${pp.hero_metric ? ` — ${pp.hero_metric}` : ''}${pp.url ? ` (${pp.url})` : ''}`).join('\n')
    : '- [add a proof point with a number]';
  const superLine = supers.length ? supers.slice(0, 3).join(', ') : '[your top 3 strengths]';

  return `# Outreach — ${company} · ${role}

- **Job:** ${job.url}
- **Location:** ${job.location || '—'}
- **You:** ${name} — ${headline}
- **Proof points:**
${proofLines}

---

## 1) LinkedIn connection note to a team peer (≤300 chars)

> Hi [First name] — I'm exploring the ${role} role at ${company} and saw you work on the team.
> I'm ${headline.toLowerCase()} (${superLine}). Would you be open to a quick chat or pointing me
> to the right person? Thanks either way! — ${name}

## 2) Recruiter cold email

**Subject:** ${role} — ${name} (${supers[0] || 'strong fit'})

Hi [Recruiter name],

I'd like to be considered for the **${role}** role at ${company} (${job.url}).

In short: ${headline}. A few relevant results:
${proofLines}

I've attached a CV tailored to this role. Happy to share more or set up a quick call.

Best,
${name}
${email} · ${linkedin}

## 3) Referral ask to a peer/1st-degree contact

Hi [First name],

I'm applying for the ${role} role at ${company} and think it's a strong fit
(${superLine}). If you know anyone there, a referral or intro would mean a lot —
I've attached my CV to make it easy. Thank you!

— ${name}

---

## Sharpen with AI (paste into career-ops web-ui #/contacto or CLI)

\`\`\`
Using my cv.md and config/profile.yml, tailor outreach for this job:
  Company: ${company}
  Role:    ${role}
  JD URL:  ${job.url}
Produce: (a) a ≤300-char LinkedIn note to a team peer, (b) a recruiter cold email
with a specific subject line, (c) a referral ask. Mirror the JD's language, keep it
concrete with my metrics, no fluff, and do not fabricate anything.
\`\`\`
`;
}

function main() {
  if (!existsSync(PIPELINE_PATH)) {
    console.error(`No pipeline yet at ${PIPELINE_PATH}.`);
    console.error('Add jobs first: run a JobOps search + .\\pipeline\\sync.ps1, or /career-ops scan.');
    process.exit(2);
  }
  const p = loadProfile();
  if (!p.candidate) {
    console.warn('⚠  config/profile.yml is empty or still the template — worksheets will contain placeholders.\n');
  }
  let jobs = parsePipeline(readFileSync(PIPELINE_PATH, 'utf-8'));
  if (jobs.length === 0) { console.log('No pending jobs in pipeline.md.'); return; }
  if (LIMIT > 0) jobs = jobs.slice(0, LIMIT);

  mkdirSync(OUT_DIR, { recursive: true });
  const index = [`# Outreach worksheets (${jobs.length})`, ''];
  for (const job of jobs) {
    const file = `${slug(job.company)}-${slug(job.title)}.md`;
    writeFileSync(join(OUT_DIR, file), worksheet(job, p), 'utf-8');
    index.push(`- [${job.company || 'Company'} — ${job.title || 'Role'}](${file})  ·  ${job.url}`);
    console.log(`  + ${file}`);
  }
  writeFileSync(join(OUT_DIR, 'INDEX.md'), index.join('\n') + '\n', 'utf-8');
  console.log(`\nWrote ${jobs.length} worksheet(s) to ${OUT_DIR}`);
  console.log('Open INDEX.md, personalize the [bracketed] bits, and send. Set API keys to auto-tailor via career-ops.');
}

main();
