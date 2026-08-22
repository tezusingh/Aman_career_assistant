# FIX-PROMPT v1.54 — FINAL CONSOLIDATED

> **Single source of truth** for everything raised by the 2026-05-18 v1.54 regression run.
> Combines: 3 MEDIUM a11y findings (F-V54-A/B/C) + 7 senior/UI-architect observations (S-1..S-7, S-4 withdrawn) + W-001 deploy hygiene + docs-cross-check requirement map.
> **Reference spec:** `qa/REGRESSION-v1.54.md` (canonical, with §9-a + §10 added 2026-05-18).
> **Reference run:** `qa/v54-regression/2026-05-18-REGRESSION.md`.
> **Ship rule:** one fix per PR per CLAUDE.md — bump version + CHANGELOG ×8 + new test + Playwright-verify + pre-commit AI-review-LGTM. Never batch.

---

## TL;DR — what to ship and when

| Track | ID | Severity | Target | Owner | Sequence |
|---|---|---|---|---|---|
| **A11y** | F-V54-A | MEDIUM | v1.54.1 | UI | 1️⃣ |
| **A11y** | F-V54-B | MEDIUM | v1.54.2 | UI | 2️⃣ |
| **A11y** | F-V54-C | MEDIUM | v1.54.3 | UI | 3️⃣ |
| **Senior obs** | S-7 (help back-to-top class) | LOW (test fragility) | v1.54.4 | UI | 4️⃣ (quick win) |
| **Senior obs** | W-001 (asset URL versioning) | LOW (deploy hygiene) | v1.54.5 | Server | 5️⃣ |
| **Roadmap** | S-1, S-2, S-3, S-5, S-6 | n/a (UX research / arch debt) | v1.55+ | Product+UI | research + plan |

**Open backlog after these ship:** only G-005 (cross-repo, has closure kit).

---

## Part I — TRACK A11Y (MEDIUM, must-fix)

### F-V54-A — `#/cv` duplicate `<h1>` (v1.54.1)

**File:** `public/js/views/cv.js` line 189 (markdown injection point) **or** `public/js/ui.js::UI.md` (renderer).

**Symptom:** `document.querySelectorAll('main h1').length === 2`. Texts: `["CV", "Alex Doe"]`. The user's CV markdown's `# Name` is rendered as a top-level `<h1>` next to the page-title `<h1>CV</h1>`. Breaks WCAG 1.3.1 (Info & Relationships) and 2.4.6 (Headings and Labels).

**Patch — preferred (renderer-level, fixes all views that consume `UI.md`):**

```js
// public/js/ui.js — UI.md (add after marked.parse)
function shiftHeadings(html) {
  return html
    .replace(/<h6\b([^>]*)>/g, '<div role="heading" aria-level="7" class="h7"$1>')
    .replace(/<\/h6>/g, '</div>')
    .replace(/<h([1-5])\b/g, (_, n) => `<h${Number(n)+1}`)
    .replace(/<\/h([1-5])>/g, (_, n) => `</h${Number(n)+1}>`);
}

// in UI.md():
return shiftHeadings(marked.parse(text));
```

**Patch — alternative (one-liner at the call site, scoped to CV only):**

```diff
// public/js/views/cv.js line 189
- c('div', { className: 'card md', id: 'cv-preview', html: UI.md(data.markdown || '') })
+ c('div', { className: 'card md', id: 'cv-preview',
+   html: UI.md(data.markdown || '').replace(/<h1\b/g, '<h2').replace(/<\/h1>/g, '</h2>')
+ })
```

Choose **renderer-level** if `UI.md` is used in other views (help, reports). Otherwise call-site is sufficient.

**Test — `tests/cv-single-h1.test.mjs`:**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
// ... boot routine mirroring tests/help-ru-config-section.test.mjs

test('CV view: single <h1>, user H1 demoted to H2', async () => {
  const doc = await mountSpa({ cv: { markdown: '# Alex Doe\n\n## Summary\n\nSenior engineer.' } });
  await navigate(doc, '/cv');
  const h1s = doc.querySelectorAll('main h1');
  assert.equal(h1s.length, 1, 'CV must have exactly one <h1>');
  assert.match(h1s[0].textContent, /CV|Резюме|CV/);
  // user's # Alex Doe should now be <h2>
  const h2s = Array.from(doc.querySelectorAll('main h2')).map(h => h.textContent.trim());
  assert.ok(h2s.includes('Alex Doe'), 'user H1 must be demoted to <h2>');
});
```

**Acceptance:**

- ✅ `main h1` count === 1 on `#/cv` with any CV markdown
- ✅ User's `# X` rendered as `<h2>X</h2>` in `#cv-preview`
- ✅ `tests/cv-single-h1.test.mjs` PASS
- ✅ Static gate in `tests/canonical-docs-coverage.test.mjs` extended with "every view has single h1" assertion

**Release:** v1.54.1. CHANGELOG ×8 entry: `fix(a11y): F-V54-A — CV preview demotes user-markdown h1→h2 (WCAG 1.3.1 single page h1)`.

---

### F-V54-B — `#/pipeline` `✕` button accessible name (v1.54.2)

**File:** `public/js/views/pipeline.js` line 170.

**Symptom:** Each of 1385 per-row pipeline rows renders:
```html
<button class="btn btn-ghost btn-sm pipeline-row-delete" title="Удалить">✕</button>
```
No `aria-label`. Text content is the glyph `✕` (U+2715) which most screen readers either silently skip or announce as "x". `title=` is WCAG H65 fallback but known-weak. Violates spec §2 #8/#22 + WCAG 4.1.2.

**Patch:**

```diff
// public/js/views/pipeline.js line ~170
         c('button', {
           className: 'btn btn-ghost btn-sm pipeline-row-delete',
+          'aria-label': t('common.delete', 'Delete') + ' — ' + url.slice(0, 60) + (url.length > 60 ? '…' : ''),
           title: t('common.delete', 'Delete'),
           onClick: async (e) => { ... },
         }, '✕'),
```

Including the URL in the aria-label disambiguates the 1385 otherwise-identical buttons. Truncate at 60 chars to keep VoiceOver/NVDA announcements tractable.

**Test — `tests/pipeline-row-delete-a11y.test.mjs`:**

```js
test('every per-row pipeline delete button has an aria-label that includes the URL', async () => {
  const doc = await mountSpa({ pipeline: ['https://a.example.com/x', 'https://b.example.com/y', 'https://c.example.com/z'] });
  await navigate(doc, '/pipeline');
  const btns = doc.querySelectorAll('main .pipeline-row-delete');
  assert.equal(btns.length, 3);
  for (const b of btns) {
    const al = b.getAttribute('aria-label');
    assert.ok(al && al.length > 0, 'pipeline-row-delete missing aria-label');
    assert.match(al, /Delete|Удалить|Eliminar|Excluir|削除|삭제|删除|刪除/, 'aria-label must be localized');
    assert.match(al, /example\.com/, 'aria-label must include URL for disambiguation');
  }
});
```

**Acceptance:**

- ✅ Every `.pipeline-row-delete` button has non-empty `aria-label`
- ✅ Screen reader announces "Delete — https://example.com/..." (not just "x")
- ✅ `tests/pipeline-row-delete-a11y.test.mjs` PASS
- ✅ All 8 locales produce a translated `common.delete` segment in the aria-label

**Release:** v1.54.2.

---

### F-V54-C — `#/batch` TSV textarea accessible name (v1.54.3)

**File:** `public/js/views/batch.js` line 33.

**Symptom:**
```html
<textarea id="batch-tsv" aria-describedby="batch-tsv-hint" rows="14" placeholder="...">
```
No `aria-label`, no `<label for="batch-tsv">`. Only `aria-describedby` to a hint paragraph — that provides **description**, not **name**. Without name, screen readers announce "edit, multiline, <description>" with no clue of WHAT the field is. All other batch inputs (parallel/min-score/max-retries/model/start-from) carry `aria-label` (lines 56/66/81/96/105); only the central TSV editor was missed. Violates WCAG 1.3.1 + 4.1.2.

**Patch — code:**

```diff
// public/js/views/batch.js line ~33
  const textarea = c('textarea', {
    id: 'batch-tsv',
+   'aria-label': t('batch.tsvAria', 'Batch TSV editor: id<tab>url<tab>source<tab>notes per row'),
    'aria-describedby': 'batch-tsv-hint',
    className: 'textarea',
    rows: 14,
    style: { minHeight: '320px', fontFamily: 'ui-monospace, monospace', fontSize: '13px' },
    placeholder: '# id\turl\tsource\tnotes\n1\thttps://jobs.example.com/abc\tLinkedIn\t',
  });
```

**Patch — i18n (`public/js/i18n-dict.js`):**

Add key `batch.tsvAria` to all 8 locales:

| Locale | Value |
|---|---|
| en | `Batch TSV editor: id<tab>url<tab>source<tab>notes per row` |
| ru | `Редактор TSV пакета: id<TAB>url<TAB>источник<TAB>примечания на строку` |
| es | `Editor TSV de lote: id<tab>url<tab>fuente<tab>notas por fila` |
| pt-BR | `Editor TSV em lote: id<tab>url<tab>origem<tab>notas por linha` |
| ko | `배치 TSV 편집기: 행마다 id<탭>url<탭>출처<탭>메모` |
| ja | `バッチTSVエディター: 1行ごとに id<タブ>url<タブ>ソース<タブ>備考` |
| zh-CN | `批处理 TSV 编辑器：每行 id<制表符>url<制表符>来源<制表符>备注` |
| zh-TW | `批次 TSV 編輯器：每列 id<TAB>url<TAB>來源<TAB>備註` |

Extend `tests/i18n-coverage.test.mjs::required keys` to include `batch.tsvAria`.

**Test — `tests/batch-tsv-a11y.test.mjs`:**

```js
test('#/batch TSV textarea has an accessible name in every locale', async () => {
  for (const locale of ['en','es','pt-BR','ko','ja','ru','zh-CN','zh-TW']) {
    const doc = await mountSpa({ locale });
    await navigate(doc, '/batch');
    const ta = doc.querySelector('#batch-tsv');
    assert.ok(ta, `[${locale}] batch-tsv missing`);
    const al = ta.getAttribute('aria-label');
    const hasLabel = ta.labels?.length > 0;
    assert.ok(al || hasLabel, `[${locale}] batch-tsv has no accessible name`);
    if (al) assert.ok(al.length > 5, `[${locale}] aria-label too short: "${al}"`);
  }
});
```

**Acceptance:**

- ✅ `#batch-tsv` has non-empty localized `aria-label`
- ✅ `tests/batch-tsv-a11y.test.mjs` PASS for all 8 locales
- ✅ `tests/i18n-coverage.test.mjs` still passes (key added to required-key set)

**Release:** v1.54.3.

---

## Part II — TRACK SENIOR OBSERVATIONS (LOW, easy wins first)

### S-7 — `#/help` back-to-top class (v1.54.4 — quick win)

**File:** `public/js/views/help.js` (search for `↑` or `Наверх` or `i18nKey: 'help.backToTop'` ).

**Symptom:** The "↑ Наверх" button works in live but uses an ad-hoc selector. The spec §2 #28 test is written against `.back-to-top` / `[data-back-to-top]` and would yellow if anyone tightens it.

**Patch — one line:**

```diff
   c('button', {
     className: 'btn back-to-top',
     onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
   }, '↑ ' + t('help.backToTop', 'Top')),
```

**Test:**

```js
test('#/help back-to-top button has the canonical .back-to-top class', async () => {
  const doc = await mountSpa({});
  await navigate(doc, '/help');
  assert.ok(doc.querySelector('main .back-to-top'), 'help missing .back-to-top');
});
```

**Release:** v1.54.4 (or roll into v1.54.3 since one CSS-no-op line).

---

### W-001 — version-stamped asset URLs (v1.54.5)

**Files:** `public/index.html` + `server/index.mjs`.

**Symptom:** After deploy, browsers may serve cached old `api.js` / `router.js` for hours → stale-cache 404 reports on query-string routes. Observed live during v1.29.2 regression.

**Option A — version-stamp at boot (preferred, no server change):**

Add to `public/index.html` (top of head or via boot script):

```html
<script>
  // v1.54.5 — bust asset cache on every deploy
  (function() {
    const v = document.documentElement.dataset.version || 'dev';
    document.querySelectorAll('script[src], link[rel="stylesheet"]').forEach(el => {
      const attr = el.tagName === 'SCRIPT' ? 'src' : 'href';
      const url = new URL(el.getAttribute(attr), location.origin);
      if (url.origin === location.origin) {
        url.searchParams.set('v', v);
        el[attr] = url.pathname + url.search;
      }
    });
  })();
</script>
```

Plus inject `<html data-version="1.54.5">` from the server (`server/index.mjs` SPA shell handler).

**Option B — Cache-Control header (simpler but less surgical):**

```js
// server/index.mjs (in static-file middleware)
app.use('/public', express.static(PUBLIC_DIR, {
  setHeaders: (res, path) => {
    if (/\.(js|mjs|css)$/.test(path)) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
    }
  },
}));
```

**Test — `tests/asset-cache-versioning.test.mjs`:**

```js
test('GET /public/js/app.js responds with no-store cache control', async () => {
  const r = await fetch(`${baseUrl}/public/js/app.js`);
  assert.match(r.headers.get('cache-control') || '', /no-store|max-age=0/i);
});
```

**Release:** v1.54.5.

---

## Part III — TRACK ROADMAP (UX research / arch debt, plan for v1.55+)

These are **NOT one-fix ships**. They need design + UX research + capacity planning before any code lands. Document the decision; revisit in next planning cycle.

### S-1 — Dashboard header information density (v1.55+ planning)

- **What:** 30 click-eligible nodes on `#/dashboard`. Visual hierarchy unclear; every node reads as primary CTA.
- **Action plan:**
  1. UX-research session: 5 users, observe which buttons they click in their first 90 seconds on the dashboard. Record click frequency on:
     - 5 header CTAs (Doctor / Quick scan / Open Pipeline / 🌐 Scan now / ✨ Auto-pipeline)
     - 8 status-bucket cards (Evaluated / Applied / Responded / Interview / Offer / Rejected / Discarded / SKIP)
     - 5 recent-apps rows
  2. Identify the P0 set (clicked by >60% of users in first session).
  3. Design proposal: keep P0 visible; move P1 behind "More actions" disclosure; demote P2 to dashboard sidebar.
  4. Ship as v1.55.0 dashboard redesign with a/b feature flag.
- **Owner:** Product + UI.
- **Risk if not addressed:** new-user activation drops as more features land on dashboard.

### S-2 — Pipeline list virtualization (v1.55+ planning, trigger > 1000 rows)

- **What:** `#/pipeline` renders 2778 DOM buttons for 1385 rows. Smooth at 1k. Memory + scroll-jank risk at 5–10k.
- **Action plan:**
  1. Synthesize benchmark: generate 5k-row fixture pipeline; measure first-paint + scroll-frame-rate. Threshold: first-paint > 800ms OR avg scroll FPS < 50.
  2. If thresholds breached, implement vanilla-JS virtualization:
     - Render only viewport-visible rows + 5-row buffer above/below
     - Use IntersectionObserver to mount/unmount rows
     - Preserve scroll position across mounts
  3. Test against the 1385-row real fixture to confirm no regression for current users.
- **Owner:** UI / Performance.
- **Trigger:** when median user pipeline crosses 2000 rows OR scroll-jank reports start.

### S-3 — Scan filter cognitive load (v1.55+ planning)

- **What:** `#/scan` has 8 inputs + 13 buttons (free-text / Source / Remote-Hybrid-Onsite / Stack chips / Dynamic chips / Active Companies / Company dropdown).
- **Action plan:**
  1. Instrument filter usage: log which filters are touched in each scan session (no PII, just filter-name + boolean-changed).
  2. After 4 weeks, analyze: which 3 filters are used > 80%? Promote those as the "Primary" group at the top.
  3. Move the remaining 5+ behind `<details><summary>Advanced filters</summary>...`. Collapsed by default; remember preference in localStorage.
- **Owner:** Product + UX-research.
- **Acceptance:** mean time-to-first-scan drops on the redesigned screen.

### S-5 — CV page-title vs content title visual hierarchy (paired with F-V54-A)

- **What:** After F-V54-A demotes user-h1 to h2 semantically, the visual side still shows two near-equal lines competing for attention.
- **Action plan:**
  1. After F-V54-A ships, screenshot the CV view in 3 locales.
  2. Designer reviews: should the page-title "CV" become a chip/breadcrumb at the top, letting the user's name "own" the visual space?
  3. Implement via CSS: `.page-title` on `#/cv` gets `font-size: 0.875rem; opacity: 0.7; font-weight: 500` (vs default `font-size: 1.875rem; font-weight: 700`).
- **Owner:** Designer + UI.
- **Effort:** 1 PR, CSS-only.

### S-6 — Tracker pagination scaling (v1.55+ planning, trigger > 500 rows)

- **What:** `#/tracker` does 25/page client-side pagination over `data/applications.md`. Full-file fetch on every navigation. Won't scale past ~1000 entries.
- **Action plan:**
  1. Add server-side pagination + filter to `/api/tracker` (mirror `/api/scan` endpoint pattern).
  2. Update `views/tracker.js` to call paginated API.
  3. Preserve client-side filter UX (status/score/search) — pass them as query params.
  4. Migration path: feature-flag on per-user basis until applications.md > 500 rows.
- **Owner:** Server + UI.
- **Trigger:** when median user applications.md crosses 500 rows.

---

## Part IV — DOCS REQUIREMENT MAP (verified 2026-05-18)

Map of every claim in the 4 canonical docs to its current SPA / code / test surface. **Used as the regression contract for future runs — keep this in sync.**

### Quick Start ([career-ops.org/docs](https://career-ops.org/docs))

| Docs claim | SPA / code surface | Verified |
|---|---|---|
| Setup: `git clone` + `npm install` + `npx playwright install chromium` | parent project flow; web-ui has its own `bin/setup.sh` | PASS (CLI surface §6) |
| Verify: `npm run doctor` | `bin/career-ops-ui.sh doctor` + `/api/health` | PASS |
| Profile: `cp config/profile.example.yml config/profile.yml` | server reads `config/profile.yml`; SPA `#/profile` displays it; `#/config → Profile tab` edits it | PASS |
| CV: `cv.md` in root | SPA `#/cv` view, `PUT /api/cv` (stripDangerousMarkdown'd) | PASS |
| Modes profile: `cp modes/_profile.template.md modes/_profile.md` | server reads `modes/_profile.md`; `#/config → Modes tab` edits it | PASS |
| AI assistants: Claude Code / Codex / OpenCode / Qwen CLI | help §intro × 8 locales + README × 8 | PASS (v1.28.0) |
| Auto-pipeline command | SPA `#/auto` view with URL input + 5-step `<ol class="auto-stepper">` | PASS |
| 5 auto-pipeline stages (read JD → read CV → score → report → PDF → tracker) | `views/auto.js::STEPS` = `[validate, fetch, evaluate, save_report, append_tracker]` | PASS (NOTE: PDF generation is a separate user action via `#/cv` → 📄 Generate PDF — not part of auto-pipeline by default) |
| Score 0.0–5.0 | `views/reports.js` score-pill renders 0–5 with redundant glyphs ✓ ◐ ○ | PASS |
| Report blocks A/B/C/D/E/F | `prompts.mjs` v1.15+ A-F (legacy A-G renderer-tolerant) | PASS (G-005 cross-repo) |
| Outputs: `reports/`, `output/`, `data/applications.md` | server reads all three; `#/reports` lists reports; `#/tracker` reads applications.md | PASS |

### Scan Job Portals

| Docs claim | SPA / code surface | Verified |
|---|---|---|
| `cp templates/portals.example.yml portals.yml` | parent project flow; web-ui reads `portals.yml` | PASS |
| 3 sections (`title_filter` / `tracked_companies` / `search_queries`) | yaml structure read via js-yaml in scanner; help §5 × 8 documents it | PASS |
| `npm run scan` direct script (Greenhouse/Ashby/Lever, ~30s, no AI tokens) | server's `en-scanner.mjs` uses adapter pattern; runs in-process, dryRun=1 in 30s | PASS |
| `npm run scan -- --dry-run` | `GET /api/stream/scan?dryRun=1`; SPA dry-run checkbox | PASS |
| `npm run scan -- --company X` | `GET /api/stream/scan?company=Anthropic`; SPA `companySelect` dropdown | PASS |
| AI-powered `/career-ops scan` | parent CLI surface — web-ui mirrors via `#/scan` button | PASS |
| Scan output: `Companies scanned / Total jobs found / Filtered by title / Duplicates / New offers added` | scanners emit `counts: { raw, removedTitle, removedNeg, dup, fresh, skipped }`; SPA renders via SSE log | PASS (semantic equivalent; help §5 explains key mapping) |
| New offers → `data/pipeline.md` | server appends; SPA `#/pipeline` reads | PASS |
| Dedup → `data/scan-history.tsv` | scanner writes; not surfaced in UI by design (read on every scan to dedupe) | PASS |
| `/career-ops pipeline` to evaluate | SPA `#/evaluate` per URL OR `#/batch` for bulk | PASS |

### Apply for a Job

| Docs claim | SPA / code surface | Verified |
|---|---|---|
| Score thresholds: ≥4.5 apply, 4.0-4.4 apply/contacto, 3.5-3.9 deep, <3.5 skip | `views/reports.js` score-thresholds card + i18n keys `rep.thr45/thr40/thr35/thrLow` | PASS |
| Apply checklist mentioning `/career-ops apply` + "never auto-submit" warning | SPA `#/apply` is the checklist view (NOT a mode page — explicit) | PASS |

### Batch Evaluate Offers

| Docs claim | SPA / code surface | Verified |
|---|---|---|
| `#/batch` UI flags: parallel / min-score / dry-run / retry / max-retries / model / start-from | 9 inputs in `views/batch.js`: batch-tsv (textarea) + batch-parallel + batch-min-score + batch-dry-run + batch-retry + batch-max-retries + batch-model + batch-start-from + global-search | PASS (`#/batch` 7 of 9 inputs are batch controls; F-V54-C will add accessible name to batch-tsv) |

### Set up Playwright

| Docs claim | SPA / code surface | Verified |
|---|---|---|
| `npx playwright install chromium` for PDF generation | parent setup; web-ui has Playwright dependency for `#/cv → 📄 Generate PDF` | PASS |
| Liveness streams | SSE pattern across `/api/stream/scan`, `/api/stream/batch`, `/api/stream/pdf*` | PASS |

---

## Part V — Execution playbook

For each fix (F-V54-A → F-V54-B → F-V54-C → S-7 → W-001), in strict order:

```bash
# 1. Branch
git checkout -b fix/v54.1-cv-single-h1

# 2. Apply patch from this prompt
# (see Part I, F-V54-A section)

# 3. Add the new test file
# (paste test from F-V54-A section)

# 4. Run targeted test green
node --test tests/cv-single-h1.test.mjs       # PASS

# 5. Bump + CHANGELOG ×8 (script if it exists, otherwise per file)
node scripts/bump-version.mjs 1.54.1          # or sed -i
# update CHANGELOG.md + CHANGELOG.{ru,es,pt-BR,ko-KR,ja,zh-CN,zh-TW}.md
# entry text (localize each):
#   ## [1.54.1] — 2026-MM-DD
#   ### Fixed
#   - F-V54-A — CV preview demotes user-markdown h1→h2 (WCAG 1.3.1 single page h1)

# 6. Verify CI
npm run test:ci                                # 718/718 (added test)
node scripts/check-changelog-parity.mjs        # ✓ all 8 @ 1.54.1
node scripts/check-no-also-leftovers.mjs       # ✓

# 7. Playwright e2e (on host with browser installed)
node tests/e2e.mjs                             # passed: N  failed: 0
node tests/e2e-comprehensive.mjs               # N/N  failed: 0

# 8. Commit through the hook (never --no-verify)
git add -A
git commit -m "fix(a11y): F-V54-A — CV preview demotes user-markdown h1→h2 (WCAG 1.3.1)"

# 9. Tag + push
git tag v1.54.1
git push origin main --tags
```

Repeat for v1.54.2 (F-V54-B), v1.54.3 (F-V54-C), v1.54.4 (S-7), v1.54.5 (W-001).

After v1.54.5 ships, this fix-prompt is **closed**. Open backlog reduces to just G-005 (cross-repo).

---

## Part VI — Definition of Done

This fix-prompt is fully closed when ALL of the following are true:

- [ ] v1.54.1 shipped (F-V54-A): `tests/cv-single-h1.test.mjs` exists + PASS; visual screenshot in 3 locales confirms h2 demotion
- [ ] v1.54.2 shipped (F-V54-B): `tests/pipeline-row-delete-a11y.test.mjs` exists + PASS; VoiceOver/NVDA spot-check confirms "Delete — https://..." announcement
- [ ] v1.54.3 shipped (F-V54-C): `tests/batch-tsv-a11y.test.mjs` exists + PASS in all 8 locales; `i18n-coverage.test.mjs` includes `batch.tsvAria`
- [ ] v1.54.4 shipped (S-7): `back-to-top` class added; existing spec test now matches without flake
- [ ] v1.54.5 shipped (W-001): asset URL versioning or `Cache-Control: no-store` in place; `tests/asset-cache-versioning.test.mjs` exists + PASS
- [ ] `qa/REGRESSION-v1.54.md` §9-a marked CLOSED for F-V54-A/B/C
- [ ] `qa/REGRESSION-v1.54.md` §10 S-7 / W-001 marked CLOSED with release version
- [ ] S-1 / S-2 / S-3 / S-5 / S-6 entered the v1.55+ planning backlog with owner + trigger
- [ ] Single open item across the project: G-005

Once all checkboxes are ticked, archive this file under `qa/archive/v1.54-fix-prompts/` and update `qa/README.md` to point at the next regression spec.
