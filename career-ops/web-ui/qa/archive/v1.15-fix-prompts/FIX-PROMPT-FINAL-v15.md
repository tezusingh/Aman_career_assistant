# career-ops-ui v1.14.0 → v1.15.0 · FINAL FIX-PROMPT for development

> Hand this whole file to Claude Code (or any AI coding CLI) working in
> `/Users/sergejemelanov/Projects/career-ops/web-ui/`. Each section is one PR.
> Land them in the order given. After each merge run `npm test`
> + `npm run test:e2e:full`.

**Source documents:**
- Live regression matrix: `qa/live-chrome/01-FULL-MATRIX-v14.md` (168/168 cells verified)
- Conformance audit: `qa/conformance-vs-docs/00-CONFORMANCE-REPORT.md`
- All 19 findings (F-001…F-019, G-001…G-013) detailed in `qa/fixes/`
- Reference docs: `https://career-ops.org/docs` + 4 guide pages

---

## What this release closes

| ID | Severity | One-line | Where it surfaces |
|---|---|---|---|
| **G-005** | Major (semantic) | Evaluate report blocks use A-G with diverged semantics (C=Risks, F=Verdict, G=Legitimacy); canonical is A-F (C=Strategy, E=Personalization, F=STAR stories) | `modes/oferta.md` (parent), 8 help bundles §9 |
| **G-006** | Minor | `#/tracker` columns end at PDF; no Legitimacy column despite `reports.js` rendering it on cards | `public/js/views/tracker.js`, `/api/tracker` |
| **G-007** | Major UX | No 1-click auto-pipeline; canonical Quick Start §7 promises "paste URL → full report + PDF + tracker row in 1-2 min" | new `/api/auto-pipeline` + button on `#/dashboard` / `#/pipeline` |
| **G-008** | Major UX | `modes/_profile.md` (canonical §Step-5: *most-edited file*) has no UI surface | new `#/config → Modes` tab + card on `#/profile` |
| **G-009** | Minor | profile.yml schema diverges (no `location`, no `narrative.headline`; legacy `target.comp_total_min_usd` vs canonical `compensation.target_range`) | `/api/profile` summarizer + UI |
| **G-010** | Minor | Help §5 missing `seniority_boost` and `search_queries` schema docs | 8 help bundles, `bin/start.sh` scaffold |
| **G-011** | Major | `#/batch` registered twice in sidebar; both go to legacy mode-prompt builder. v1.13.0 TSV SPA (`batch.js`, 8 KB) is unreachable | `public/js/views/sidebar.js`, router |
| **G-001 carryover** | Minor | `scan.noResults` i18n bundle still has "Run EN or RU scan" literal in 8 locales (UI subtitle is already fixed; the bundle string is dead code) | `public/js/lib/i18n.js:312` |
| **G-002 carryover** | Minor | `📄 Generate PDF` button missing on `#/interview-prep` (live result view) | `public/js/views/interview-prep.js` |
| **G-003** | Minor | `README.cn.md` should be `README.zh-CN.md` (consistency with rest of i18n surface) | git mv + sed |
| **G-004** | Minor (intentional) | `/api/stream/scan-en` + `scan-ru` kept as deprecated aliases | add deprecation headers, schedule v1.16 removal |

Plus PR-I (this session's deliverable): localized hero images per README locale.

---

## Build order

1. **PR-G** — quick carryover cleanups (G-001..G-004): removes the most visible bleed. ~30 minutes.
2. **PR-F** — docs-only updates for `seniority_boost` + `search_queries`. ~1 hour.
3. **PR-H** — dedupe sidebar + route `#/batch` to v1.13.0 TSV SPA. **Highest visibility** for the smallest amount of code (G-011). ~2 hours.
4. **PR-E** — accept canonical profile.yml schema (backward-compatible). ~3 hours.
5. **PR-D** — `modes/_profile.md` editor as new `#/config → Modes` tab. ~6 hours.
6. **PR-B** — Legitimacy column on `#/tracker`. ~2 hours.
7. **PR-A** — Block A-F realignment in `modes/oferta.md` + 8 help bundles. Coordinated with parent project. ~1 day.
8. **PR-C** — Auto-pipeline 1-click flow. Biggest UX win. ~2 days.
9. **PR-I** — Commit the 8 dashboard hero images. ~10 minutes (already prepped this session).

---

## PR-G · `chore: carryover cleanups` (G-001 / G-002 / G-003 / G-004)

### G-001 · Replace `scan.noResults` EN/RU literal in i18n bundle

`public/js/lib/i18n.js:312`:

```js
'scan.noResults': {
  en:      'No results. Run a scan above — results will appear here once it finishes.',
  ru:      'Нет результатов. Запустите скан выше — результаты появятся здесь после завершения.',
  es:      'Sin resultados. Ejecuta un escaneo arriba — los resultados aparecerán al terminar.',
  'pt-BR': 'Sem resultados. Execute uma varredura acima — os resultados aparecerão ao terminar.',
  ko:      '결과 없음. 위에서 스캔을 실행하세요 — 완료 시 여기에 표시됩니다.',
  ja:      '結果なし。上からスキャンを実行してください — 完了時に表示されます。',
  'zh-CN': '无结果。在上方运行扫描 — 完成后将显示在此处。',
  'zh-TW': '無結果。在上方執行掃描 — 完成後將顯示在此處。'
}
```

Run `scripts/check-no-enru-bleed.mjs` — must pass after.

### G-002 · Add `📄 Generate PDF` to `#/interview-prep`

Mirror the `#/deep` pattern — one PDF button on the result panel, wired to `/api/pdf/inline { markdown, filename: '<co>-<role>-interview.pdf' }`.

### G-003 · Rename `README.cn.md` → `README.zh-CN.md`

```bash
git mv README.cn.md README.zh-CN.md
sed -i.bak 's|README\.cn\.md|README.zh-CN.md|g' README.md docs/*.md
rm README.md.bak docs/*.bak 2>/dev/null
```

Update the language picker line in `README.md` line 6: `[简体中文](README.cn.md)` → `[简体中文](README.zh-CN.md)`.

### G-004 · Add Sunset / Deprecation headers to `/api/stream/scan-en` + `scan-ru`

```js
// server/lib/routes/scan.mjs
const SUNSET_HEADER = 'Wed, 01 Oct 2026 00:00:00 GMT';

app.get('/api/stream/scan-en', (req, res) => {
  console.warn('[deprecated] /api/stream/scan-en will be removed in v1.16.0 — use /api/stream/scan?source=ats');
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', SUNSET_HEADER);
  res.setHeader('Link', '</api/stream/scan?source=ats>; rel="successor-version"');
  // existing handler…
});
// mirror for /api/stream/scan-ru
```

---

## PR-F · `docs: seniority_boost + search_queries in help §5 + scaffold` (G-010)

Update §5 of each of 8 help bundles (`docs/help/<locale>.md`) with the `seniority_boost` paragraph + a `search_queries` example. Update `bin/start.sh` portals.yml scaffold to include `seniority_boost: ["Senior","Staff","Lead"]`.

See full content + i18n keys in `qa/conformance-vs-docs/FIX-PROMPT-v15.md` → "PR-F".

---

## PR-H · `fix(routing): dedupe sidebar; route #/batch to v1.13.0 TSV SPA` (G-011)

### Goal
Today `#/batch` is registered **twice** in the sidebar (under "Decision" ⇶ and "Application" ▥). Both entries link to `data-route="batch"` → the legacy mode-prompt builder. The v1.13.0 TSV SPA in `public/js/views/batch.js` (8 KB) + `server/lib/routes/batch.mjs` (4 endpoints) is unreachable.

### Changes

1. **`public/js/views/sidebar.js`** — single canonical sidebar registry. Remove the duplicate `/batch` entry under "Application" and the duplicate `/dashboard` entry.

2. **`public/js/router.js`** — route `/#/batch` to `BatchTsvView`. Keep the mode-prompt batch builder available at `/#/batch-prompt` for deep-linked bookmarks with a one-release deprecation banner.

```js
const ROUTES = {
  '/batch':        { view: BatchTsvView },                          // canonical (v1.13.0+)
  '/batch-prompt': { view: ModePromptView, mode: 'batch',
                     deprecation: 'Use /batch. Removed in v1.16.' }
};
```

3. **CI gate** — `scripts/check-sidebar-dedupe.mjs`:

```bash
node -e "const sidebar = require('./public/js/views/sidebar.js').SIDEBAR; const hrefs = sidebar.flatMap(g => g.items.map(i => i.route)); const dupes = hrefs.filter((h,i) => hrefs.indexOf(h) !== i); if (dupes.length) { console.error('duplicate sidebar routes:', dupes); process.exit(1); }"
```

### Tests
- `tests/sidebar-dedupe.test.mjs` — no `href` repeats.
- `tests/batch-tsv-spa.test.mjs` — `/#/batch` renders textarea + parallel select + min-score + dry-run + retry controls.

---

## PR-E · `feat(profile): accept canonical schema; add location + headline` (G-009)

See `qa/conformance-vs-docs/FIX-PROMPT-v15.md` → "PR-E" for the full migration shim that accepts both legacy `candidate.full_name` and canonical top-level `full_name`, plus adds `location` + `narrative.headline` to the `/api/profile` summary card.

---

## PR-D · `feat(profile): expose modes/_profile.md as a first-class editor` (G-008)

Add a new "Modes" tab to `#/config` alongside "API keys & runtime" and "Profile". Editor for the canonical `modes/_profile.md` file (per docs §Step-5 — the most-edited user file).

Server: new `GET /api/modes/profile` + `PUT /api/modes/profile` in `server/lib/routes/content.mjs`. Scaffold from `modes/_profile.template.md` on first read if missing. Atomic write. 256 KB cap. Sanitize via existing `stripDangerousMarkdown`.

Front-end: add tab to `#/config`, plus a "Career framing" card on `#/profile` that links to the new tab. Activity log records `modes_profile.save`.

See `qa/conformance-vs-docs/FIX-PROMPT-v15.md` → "PR-D" for full code, i18n keys, tests.

---

## PR-B · `feat(tracker): Legitimacy column + canonical batch result table` (G-006)

`public/js/views/tracker.js` — add Legitimacy column with badge tinting matching the existing report-card pattern (`reports.js:59`). Thread `r.legitimacy` through `/api/tracker` row JSON. i18n keys `track.col.legitimacy` × 8 locales.

---

## PR-A · `fix(evaluate): realign Block A-F with canonical career-ops.org rubric` (G-005)

### Coordinated with parent `santifer/career-ops`

**Parent commit** — rewrite `modes/oferta.md` to emit canonical A-F:
- A. Role Summary
- B. CV Match
- C. **Strategy** (was Risks; merge risks into A as bullets)
- D. Compensation
- E. **Personalization** (was Application Strategy)
- F. **STAR stories** (was Verdict; score moves to report header `score: N.N/5`)
- G is removed; legitimacy moves to header `legitimacy: High|Medium|Low`

**web-ui commit** — update `server/lib/prompts.mjs::SCAFFOLD_STRINGS` per-locale block names; update `docs/help/<locale>.md` §9 in all 8 bundles; update `public/js/views/evaluate.js` to render A-F only.

Migration note: reports written pre-v1.15 used A-G; the renderer must still display them as-is (graceful degrade — pre-v1.15 reports keep working).

---

## PR-C · `feat(auto-pipeline): 1-click "paste URL → full report + PDF + tracker"` (G-007)

### Biggest UX win

New `POST /api/auto-pipeline { url }` SSE stream that chains:

```
1. validate URL (isValidJobUrl)
2. fetch JD via SSRF-safe proxy
3. /api/evaluate { jd, save: true, lang }  →  report markdown + score + slug
4. /api/pdf/inline { markdown, filename: '<slug>.pdf' }  →  output/<slug>.pdf
5. /api/tracker { company, role, score, status:'Evaluated', url, reportSlug }
6. recordActivity('auto-pipeline.done', { url, slug, score })
```

Front-end: `✨ Auto-pipeline` button on `#/dashboard` (primary CTA) + on each unevaluated `#/pipeline` row + via Cmd+K when pasted text is a URL. Modal renders a 5-step SSE-log timeline. On `done` → redirect to `#/reports/<slug>`.

i18n keys: `dash.autoPipeline`, `auto.step.{validate,fetch,evaluate,pdf,tracker}`, `auto.done`, `auto.failed` × 8 locales.

Tests cover the 5-step success path, mid-stream failure (Anthropic 500), and DNS-rebind rejection at the SSRF proxy.

See `qa/conformance-vs-docs/FIX-PROMPT-v15.md` → "PR-C" for full implementation.

---

## PR-I · `docs: localized hero images in each README` (this task)

### Already applied this session

Each of 8 READMEs has had its hero image swapped from `./public/images/screen_vacancy_found.png` to a locale-specific `./images/dashboard-<locale>.png` with the localized alt text. The Playwright capture script is shipped at `scripts/capture-dashboard-screenshots.mjs`. The README inside `images/` documents the regeneration flow.

### Cleanup commands (run once on the developer machine)

```bash
cd /Users/sergejemelanov/Projects/career-ops/web-ui

# 1. Remove .bak files left over by the in-session sed pass (sandbox restrictions
#    prevented the QA agent from deleting them).
rm -f README.*.md.bak README.md.bak

# 2. Generate the 8 dashboard PNGs (parent needs Playwright + chromium installed).
#    The server must be running on 127.0.0.1:4317 for the capture to work.
node scripts/capture-dashboard-screenshots.mjs

# 3. Commit the new images + delete the old single screenshot.
git add images/ README*.md scripts/capture-dashboard-screenshots.mjs
git rm public/images/screen_vacancy_found.png
git commit -m 'docs: localized dashboard hero images per README locale (PR-I)'
```

### Files touched (verify before commit)

```bash
git diff --stat HEAD
# expected:
#   README.md            | 2 +-
#   README.ru.md         | 2 +-
#   README.es.md         | 2 +-
#   README.pt-BR.md      | 2 +-
#   README.ko-KR.md      | 2 +-
#   README.ja.md         | 2 +-
#   README.cn.md         | 2 +-       (or README.zh-CN.md after G-003)
#   README.zh-TW.md      | 2 +-
#   images/README.md     |  new file (1.5 KB)
#   images/dashboard-en.png       | new file (~200 KB after capture)
#   images/dashboard-ru.png       | new file
#   images/dashboard-es.png       | new file
#   images/dashboard-pt-BR.png    | new file
#   images/dashboard-ko-KR.png    | new file
#   images/dashboard-ja.png       | new file
#   images/dashboard-zh-CN.png    | new file
#   images/dashboard-zh-TW.png    | new file
#   scripts/capture-dashboard-screenshots.mjs | new file (2.9 KB)
```

### Optional follow-up

Add a GitHub Actions workflow that regenerates the screenshots on every PR that touches `public/css/app.css`, `public/js/views/dashboard.js`, or `public/js/lib/i18n.js`, and diffs the result. Sketch in `qa/conformance-vs-docs/FIX-PROMPT-v15.md` → "PR-I".

---

## Final acceptance before v1.15.0 tag

```bash
# Unit + integration + e2e
npm test
npm run test:coverage         # ≥ 80% line / branch  (baseline 93/83)
npm run test:e2e:full

# Structural CI gates
node scripts/portals-health-check.mjs                      # all portals reachable
node scripts/check-no-enru-bleed.mjs                       # no EN/RU literal anywhere
node scripts/check-no-en-bleed-on-non-en-locales.mjs       # no EN token on non-EN UI
node scripts/help-i18n-check.mjs                           # all 8 bundles = 16 H2
node scripts/canonical-schema-check.mjs                    # profile.yml canonical fields accepted
node scripts/block-letters-check.mjs                       # evaluate emits A-F, no G
node scripts/check-sidebar-dedupe.mjs                      # no duplicate sidebar routes

# Manual smoke (one-time per release)
1. Open #/dashboard → paste a real Anthropic URL into Cmd+K → ✨ Auto-pipeline
   → wait ~60-90 s → land on #/reports/<slug> with PDF auto-downloaded + tracker row.
2. Open #/config → Modes tab → edit modes/_profile.md → 💾 Save → reload → text persists.
3. Open #/reports/<any-fresh-slug> → confirm A-F block structure (no Block G).
4. Open #/tracker → confirm Legitimacy column visible with green/yellow/red badges.
5. Open #/scan → empty state → confirm "Run a scan above" copy (no "EN or RU").
6. Switch to ko → open #/help → confirm Korean body (no English fallback).
7. Switch to zh-CN → open #/scan → confirm no "Doctor / Quick scan" EN bleed.
8. Open #/batch → confirm TSV editor (not mode-prompt builder).
9. Open each of 8 READMEs on GitHub → confirm the hero image is localized.
```

Tag and ship as v1.15.0.

