// ats-check.mjs — pre-apply ATS gate: how well does your CV cover a job's keywords?
//
// ATS (applicant tracking systems) rank résumés by keyword overlap with the JD.
// This flags the important JD terms missing from your CV BEFORE you apply, so you
// can add the real ones you legitimately have. No LLM, no network — pure text.
//
// Usage:
//   node pipeline/ats-check.mjs --jd path/to/jd.txt
//   node pipeline/ats-check.mjs --jd-text "We are hiring a Senior Go engineer..."
//   node pipeline/ats-check.mjs --jd jd.txt --cv ../career-ops/cv.md --top 25
//
// Exit code: 0 always (advisory). Prints a coverage score 0-100 and missing terms.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const CV_PATH = resolve(arg('--cv', join(ROOT, 'career-ops', 'cv.md')));
const JD_PATH = arg('--jd', '');
const JD_TEXT = arg('--jd-text', '');
const TOP = Number(arg('--top', '20'));

// Words too generic to matter for ATS ranking.
const STOP = new Set(`a an the and or but of to in on at for with from by as is are be been being
this that these those we you they it he she our your their his her its will would can could should
must may might have has had do does did not no yes if then else when while who whom which what where
why how all any both each few more most other some such only own same so than too very just about
into over under again further once here there work working experience years team teams role roles
join looking hiring candidate candidates ideal strong excellent good great ability able help build
building make making including include includes across within using use used new using per etc via
plus responsibilities requirements qualifications preferred nice must-have day days week weeks month`
  .split(/\s+/).filter(Boolean));

// Multi-word tech phrases worth matching as a unit.
const PHRASES = [
  'machine learning', 'deep learning', 'data science', 'data engineering', 'natural language',
  'computer vision', 'large language', 'ci cd', 'ci/cd', 'unit testing', 'rest api', 'graph ql',
  'graphql', 'micro services', 'microservices', 'distributed systems', 'event driven',
  'infrastructure as code', 'site reliability', 'product management', 'cloud native',
  'test driven', 'design patterns', 'system design', 'time series', 'a/b testing',
];

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9+#./ -]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(text) {
  const norm = normalize(text);
  const found = new Map();
  for (const p of PHRASES) {
    if (norm.includes(p)) found.set(p.replace('/', ' '), (found.get(p) || 0) + 2);
  }
  for (const w of norm.split(' ')) {
    const t = w.replace(/^[-.]+|[-.]+$/g, '');
    if (t.length < 2 || STOP.has(t) || /^\d+$/.test(t)) continue;
    found.set(t, (found.get(t) || 0) + 1);
  }
  return found;
}

function main() {
  let jd = JD_TEXT;
  if (!jd && JD_PATH) {
    const p = resolve(JD_PATH);
    if (!existsSync(p)) { console.error(`JD file not found: ${p}`); process.exit(2); }
    jd = readFileSync(p, 'utf-8');
  }
  if (!jd.trim()) {
    console.error('Provide a job description with --jd <file> or --jd-text "<text>".');
    process.exit(2);
  }
  if (!existsSync(CV_PATH)) {
    console.error(`CV not found: ${CV_PATH} (put your resume in career-ops/cv.md).`);
    process.exit(2);
  }
  const cvText = readFileSync(CV_PATH, 'utf-8');
  if (/EDIT ME/i.test(cvText)) {
    console.warn('⚠  cv.md is still the placeholder template — results are meaningless until you add your real CV.\n');
  }

  const cv = tokens(cvText);
  const jdTerms = [...tokens(jd).entries()].sort((a, b) => b[1] - a[1]);

  const missing = [];
  let covered = 0, total = 0;
  for (const [term, weight] of jdTerms) {
    total += weight;
    if (cv.has(term)) covered += weight; else missing.push([term, weight]);
  }
  const score = total ? Math.round((covered / total) * 100) : 0;

  const bar = '█'.repeat(Math.round(score / 5)).padEnd(20, '░');
  console.log(`ATS keyword coverage:  ${score}/100  [${bar}]`);
  console.log(score >= 75 ? '  Strong — you cover most JD keywords.'
    : score >= 50 ? '  Moderate — add the real, truthful terms below to lift your ranking.'
    : '  Weak — this JD wants keywords your CV does not surface.');

  if (missing.length) {
    console.log(`\nTop ${Math.min(TOP, missing.length)} missing JD keywords (add only ones you genuinely have):`);
    for (const [term, weight] of missing.slice(0, TOP)) {
      console.log(`  ${String(weight).padStart(2)}×  ${term}`);
    }
  } else {
    console.log('\nNo missing keywords — full coverage.');
  }
  console.log('\nNote: never add a skill you cannot back up in an interview. This is a gap finder, not a fabricator.');
}

main();
