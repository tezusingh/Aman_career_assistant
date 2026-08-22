#!/usr/bin/env node
/**
 * v1.24.1 (G-015) — CI gate against `.also(` leftovers in SPA views.
 *
 * `Element.prototype.also` was a global monkey-patch defined in cv.js
 * (and used by multiple views via the chained `c(...).also(fn)`
 * idiom). v1.22.0 N-2 dropped the monkey-patch and migrated cv.js
 * to a free variable + post-return setup block, but missed the same
 * idiom in `config.js:371`. The result was a hard crash on `#/config`
 * across all 8 locales: `c(...).also is not a function`.
 *
 * This script fails the build if any view JS still calls `.also(`,
 * so a future revert of the monkey-patch removal can't re-introduce
 * the same regression. Comments mentioning `.also(` are allowed.
 *
 * Wired into `npm test` via the postinstall / CI pipeline.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const VIEWS = join(REPO, 'public', 'js', 'views');

function* walkJs(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walkJs(p);
    else if (name.endsWith('.js')) yield p;
  }
}

const offenders = [];
for (const file of walkJs(VIEWS)) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip commented-out lines (// or * in a /** … */ block).
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    if (/\.also\(/.test(line)) {
      offenders.push(`${relative(REPO, file)}:${i + 1}  ${line.trim()}`);
    }
  }
}

if (offenders.length) {
  console.error('::error::Element.prototype.also call sites found (G-015 regression):');
  for (const o of offenders) console.error('  ' + o);
  console.error('');
  console.error('See public/js/views/cv.js for the migration pattern: extract');
  console.error('the tree to a `const root = c(...)`, run the setup statement');
  console.error('on its own, then `return root;`.');
  process.exit(1);
}
console.log('✓ no .also( leftovers in views/');
