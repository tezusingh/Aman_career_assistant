// daily.mjs — run the whole candidate-side flow in one command.
//
// Chains the pipeline tools in the order you'd run them each day:
//   1. import-jobs  — pull JobOps' scored jobs into career-ops (skipped if no DB yet)
//   2. outreach     — regenerate per-job outreach worksheets
//   3. followups    — who to chase today
//   4. funnel       — where you're losing candidates
//
// Every step degrades cleanly, so this is safe to run before any data exists.
//
// Usage:
//   node pipeline/daily.mjs
//   node pipeline/daily.mjs --min-score 65
//   node pipeline/daily.mjs --no-import        # skip the JobOps import step

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const MIN_SCORE = arg('--min-score', '70');
const SKIP_IMPORT = process.argv.includes('--no-import');

function run(title, script, args = []) {
  console.log(`\n\x1b[36m━━━ ${title} ━━━\x1b[0m`);
  const res = spawnSync(process.execPath, [join(HERE, script), ...args], { stdio: 'inherit' });
  // Advisory tools use exit 2 for "nothing to do"; only a real crash (>2) is worth flagging.
  if (res.status && res.status > 2) console.log(`  (${script} exited ${res.status})`);
}

console.log('\x1b[1mDaily job-search run\x1b[0m');
if (!SKIP_IMPORT) run('1/4  Import scored jobs (JobOps → career-ops)', 'import-jobs.mjs', ['--min-score', MIN_SCORE]);
else console.log('\n(skipping import — --no-import)');
run('2/4  Generate outreach worksheets', 'outreach.mjs');
run('3/4  Follow-ups due today', 'followups.mjs');
run('4/4  Funnel', 'funnel.mjs');

console.log('\n\x1b[32mDone.\x1b[0m Next: personalize + send outreach, apply to strong matches, log status in career-ops.');
