/**
 * v1.54.1 (F-V54-A) — the CV markdown's own `# Name` rendered as a
 * SECOND top-level <h1> beside the page-title <h1>CV</h1> (WCAG 1.3.1
 * Info & Relationships / 2.4.6 Headings). cv.js now feeds the preview
 * through a `cvMd()` heading-shift (h1→h2 … h6→role=heading level 7)
 * at every injection point, scoped to cv.js (UI.md is shared by
 * help/reports/deep/evaluate which manage headings their own way).
 *
 * cv.js is browser-only → wiring asserted statically (router.test.mjs
 * style); the shift transform is re-derived from the source and
 * exercised as a pure function so the WCAG behaviour is locked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const CV = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'cv.js'), 'utf8');

test('cv.js defines cvMd() with the full h1→…→h6 shift chain', () => {
  assert.ok(CV.includes("const cvMd = (src) => UI.md(src || '')"));
  assert.ok(CV.includes(`<div role="heading" aria-level="7"$1>`), 'h6→aria-level=7 div');
  for (const [a, b] of [[5, 6], [4, 5], [3, 4], [2, 3], [1, 2]]) {
    assert.ok(CV.includes(`'<h${b}')`), `missing open h${a}→h${b}`);
    assert.ok(CV.includes(`'</h${b}>')`), `missing close h${a}→h${b}`);
  }
});

test('every CV-preview injection point uses cvMd, never raw UI.md', () => {
  // The 3 preview writes: initial render (#cv-preview html:), the
  // import onChange (#cv-preview innerHTML), the live editor sync.
  const previewLines = CV.split('\n').filter((l) =>
    /cv-preview|p\.innerHTML =/.test(l) && /Md\(|UI\.md\(/.test(l));
  assert.ok(previewLines.length >= 3, `expected ≥3 preview writes, got ${previewLines.length}`);
  for (const l of previewLines) {
    assert.ok(/cvMd\(/.test(l) && !/\bUI\.md\(/.test(l),
      `preview write must use cvMd, not UI.md: ${l.trim()}`);
  }
  // the only UI.md( in the file is inside the cvMd definition itself
  const rawUiMd = (CV.match(/\bUI\.md\(/g) || []).length;
  assert.equal(rawUiMd, 1, 'UI.md must appear exactly once (inside cvMd)');
});

test('page-title <h1> is still the single top-level heading source', () => {
  // v1.58.21 (U-1) — supersedes v1.56.0 UX-9: the breadcrumb chip is gone,
  // the H1 is back to the standard `.page-title` style with a visible
  // `.page-subtitle` paragraph like every other page. F-V54-A invariant
  // unchanged: still exactly ONE <h1>, still the page title.
  assert.match(CV, /c\('h1',\s*\{\s*className:\s*'page-title'\s*\},\s*t\('cv\.title'\)\)/);
  assert.equal((CV.match(/c\('h1'/g) || []).length, 1, 'cv.js builds exactly one <h1>');
});

test('cvMd transform (re-derived) maps every heading level down by one', () => {
  // Re-implement the exact transform from cv.js and prove the contract:
  // a CV body `# Alex Doe` becomes <h2>, never a second <h1>.
  const cvMd = (html) => html
    .replace(/<h6\b([^>]*)>/g, '<div role="heading" aria-level="7"$1>')
    .replace(/<\/h6>/g, '</div>')
    .replace(/<h5\b/g, '<h6').replace(/<\/h5>/g, '</h6>')
    .replace(/<h4\b/g, '<h5').replace(/<\/h4>/g, '</h5>')
    .replace(/<h3\b/g, '<h4').replace(/<\/h3>/g, '</h4>')
    .replace(/<h2\b/g, '<h3').replace(/<\/h2>/g, '</h3>')
    .replace(/<h1\b/g, '<h2').replace(/<\/h1>/g, '</h2>');
  const out = cvMd('<h1>Alex Doe</h1><h2>Summary</h2><h6>Foot</h6>');
  assert.ok(!/<h1[ >]/.test(out), 'no <h1> may remain in CV preview output');
  assert.equal(out, '<h2>Alex Doe</h2><h3>Summary</h3><div role="heading" aria-level="7">Foot</div>');
});
