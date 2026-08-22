# FIX-PROMPT — v1.54 a11y regression sweep (3 MEDIUM findings)

> Apply each fix as a separate one-fix ship per CLAUDE.md project rules:
> bump `package.json` patch + update CHANGELOG ×8 + add the named test +
> Playwright-verify locally + commit through `.githooks/pre-commit`. Never batch.
> Reference run: `qa/v54-regression/2026-05-18-REGRESSION.md`.

---

## F-V54-A — fix `#/cv` duplicate `<h1>` (target: v1.54.1)

**File:** `public/js/views/cv.js` (line 189 area)
**Root cause:** `UI.md(data.markdown)` injects user CV markdown verbatim; first line `# Alex Doe` becomes a second `<h1>` competing with the page-title.

**Patch (preferred — heading-shift in renderer):**

If `UI.md` is a thin wrapper around a marked-style API, look in `public/js/ui.js` for the md() definition and add a post-process step:

```js
// public/js/ui.js — inside UI.md(text, opts = {})
const html = marked.parse(text);
// v1.54.1 — demote h1 in user markdown so the page-title remains the
// single top-level heading (WCAG 1.3.1).
return html
  .replace(/<h6\b/g,  '<div role="heading" aria-level="7" class="h7"')
  .replace(/<\/h6>/g, '</div>')
  .replace(/<h5\b/g, '<h6')
  .replace(/<\/h5>/g, '</h6>')
  .replace(/<h4\b/g, '<h5')
  .replace(/<\/h4>/g, '</h5>')
  .replace(/<h3\b/g, '<h4')
  .replace(/<\/h3>/g, '</h4>')
  .replace(/<h2\b/g, '<h3')
  .replace(/<\/h2>/g, '</h3>')
  .replace(/<h1\b/g, '<h2')
  .replace(/<\/h1>/g, '</h2>');
```

**Alternative (one-liner at the call site):**

```js
// public/js/views/cv.js — line ~189
c('div', { className: 'card md', id: 'cv-preview',
  html: UI.md(data.markdown || '').replace(/<h1\b/g, '<h2').replace(/<\/h1>/g, '</h2>')
})
```

Pick the renderer-level fix if `UI.md` is used in other views too (`/help`, `/reports`?); otherwise the call-site fix is fine.

**Test to add — `tests/cv-single-h1.test.mjs`:**
```js
// Boots the app, navigates to /cv with a fixture markdown that begins with `# Alex`,
// asserts main h1 count === 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
// ... (mirror tests/help-ru-config-section.test.mjs structure)
test('CV view renders single <h1>', async () => {
  // boot SPA with fixture CV {markdown:'# Alex Doe\n\nSenior engineer.'}
  // await router /cv
  const h1s = doc.querySelectorAll('main h1');
  assert.equal(h1s.length, 1);
  assert.match(h1s[0].textContent, /CV|Резюме/);
});
```

**Acceptance:**
- `document.querySelectorAll('main h1').length === 1` on `#/cv` with any CV markdown
- `tests/cv-single-h1.test.mjs` PASS
- `tests/canonical-docs-coverage.test.mjs::single-h1` PASS (extend the static gate)
- Visual: CV preview's first heading visually demoted from h1-size to h2-size

---

## F-V54-B — add `aria-label` to pipeline per-row `✕` delete (target: v1.54.2)

**File:** `public/js/views/pipeline.js` line 170

**Patch:**

```diff
         c('button', {
           className: 'btn btn-ghost btn-sm pipeline-row-delete',
+          'aria-label': t('common.delete', 'Delete') + ' — ' + url,
           title: t('common.delete', 'Delete'),
           onClick: async (e) => {
             ...
           },
         }, '✕'),
```

Including the `url` in the aria-label disambiguates the 1385 otherwise-identical delete buttons when a screen reader user tabs through them. Truncate if needed:

```js
'aria-label': t('common.delete','Delete') + ' — ' + url.slice(0, 60) + (url.length > 60 ? '…' : '')
```

**Test to add — `tests/pipeline-row-delete-a11y.test.mjs`:**
```js
test('every per-row delete button has an aria-label', () => {
  // boot SPA with fixture pipeline of 3 rows
  const btns = doc.querySelectorAll('main .pipeline-row-delete');
  assert.equal(btns.length, 3);
  for (const b of btns) {
    const al = b.getAttribute('aria-label');
    assert.ok(al && al.length > 0, `delete button missing aria-label`);
    assert.match(al, /Delete|Удалить|Eliminar|削除|삭제|删除/);
  }
});
```

**Acceptance:**
- Every `.pipeline-row-delete` has non-empty `aria-label`
- Screen reader announces "Delete — https://..." not just "x"
- `tests/pipeline-row-delete-a11y.test.mjs` PASS

---

## F-V54-C — add `aria-label` to `#/batch` TSV textarea (target: v1.54.3)

**File:** `public/js/views/batch.js` line 33

**Patch:**

```diff
  const textarea = c('textarea', {
    id: 'batch-tsv',
+   'aria-label': t('batch.tsvAria', 'Batch TSV: id<tab>url<tab>source<tab>notes per row'),
    'aria-describedby': 'batch-tsv-hint',
    className: 'textarea',
    rows: 14,
    style: { ... },
    placeholder: '# id\turl\tsource\tnotes\n1\thttps://jobs.example.com/abc\tLinkedIn\t',
  });
```

**Add the dict key `batch.tsvAria` to all 8 locales** in `public/js/i18n-dict.js`:
- en — `'Batch TSV: id\\turl\\tsource\\tnotes per row'`
- ru — `'TSV пакета: id\\turl\\tисточник\\tпримечания на строку'`
- es — `'TSV de lote: id\\turl\\tfuente\\tnotas por fila'`
- pt-BR — `'TSV em lote: id\\turl\\torigem\\tnotas por linha'`
- ko — `'배치 TSV: id<탭>url<탭>출처<탭>메모 / 행'`
- ja — `'バッチTSV: id<タブ>url<タブ>ソース<タブ>備考（1行ごと）'`
- zh-CN — `'批处理 TSV：每行 id<制表符>url<制表符>来源<制表符>备注'`
- zh-TW — `'批次 TSV：每列 id<TAB>url<TAB>來源<TAB>備註'`

**Test to add — `tests/batch-tsv-a11y.test.mjs`:**
```js
test('batch TSV textarea has an accessible name', () => {
  // boot SPA, route to #/batch
  const ta = doc.querySelector('#batch-tsv');
  assert.ok(ta);
  assert.ok(ta.getAttribute('aria-label') || ta.labels?.length,
    'batch-tsv has neither aria-label nor associated <label>');
});
```

Also extend `tests/i18n-coverage.test.mjs` to include the new `batch.tsvAria` key in the required-key set.

**Acceptance:**
- `document.getElementById('batch-tsv').getAttribute('aria-label')` returns a non-empty localized string
- `tests/batch-tsv-a11y.test.mjs` PASS in all 8 locales
- `tests/i18n-coverage.test.mjs` still 5/5 PASS

---

## Optional polish (advisory, not part of the fix sweep)

These came out of the senior/UI-architect audit (§S-1..S-7 in the run report) and are NOT bugs. Consider them when planning v1.55+:

| Item | What |
|---|---|
| S-1 | Dashboard header — 30 click-eligible nodes. Audit which are P0 CTAs. |
| S-2 | Pipeline — virtualize the list once row count crosses ~2000. |
| S-3 | Scan — collapse advanced filters behind disclosure (only 3 used >80%). |
| S-4 | Auto — pre-render 5-step skeleton instead of empty-until-run. |
| S-5 | CV — visual hierarchy: page-title chip vs full title (after F-V54-A fixes the semantic side). |
| S-6 | Tracker — server-side pagination + filter once applications.md > 1000 rows. |
| S-7 | Help — add `.back-to-top` class to the existing `↑ Наверх` button for selector stability. |
| W-001 | Add version-stamped query string to `public/index.html` `<script>` / `<link>` to prevent stale-cache 404 reports. |

---

## How to apply (per the project's one-fix-ship rule)

For each finding (F-V54-A → F-V54-B → F-V54-C), in order:

```bash
# 1. Branch
git checkout -b fix/v54.1-cv-single-h1

# 2. Apply patch (above)

# 3. Add the new test file
# (paste test from this prompt)

# 4. Bump version + CHANGELOG ×8
sed -i '' 's/"version": "1.54.0"/"version": "1.54.1"/' package.json
# update 8 CHANGELOG files:
for f in CHANGELOG{,.ru,.es,.pt-BR,.ko-KR,.ja,.zh-CN,.zh-TW}.md; do
  # prepend a new version block with the F-V54-A fix description (localized)
  :
done

# 5. Verify CI
npm run test:ci
node scripts/check-changelog-parity.mjs

# 6. Commit through pre-commit hook (no --no-verify)
git add -A
git commit -m "fix(a11y): F-V54-A — CV preview demotes user-markdown h1→h2 (single page h1)"

# 7. Verify Playwright + tag
node tests/e2e-comprehensive.mjs
git tag v1.54.1
```

Repeat for F-V54-B (v1.54.2) and F-V54-C (v1.54.3).

After v1.54.3 ships, this fix-prompt is closed.
