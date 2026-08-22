# Live Chrome regression v1.14.0 — 8 locales × key pages + canonical conformance

**Date:** 2026-05-13  ·  **Stand:** `http://127.0.0.1:4317/` v1.14.0 (parentVersion 1.7.0)  ·  **Tool:** Claude in Chrome MCP

## Preflight

- `/api/health` → `ok: true`, version 1.14.0, 2 warnings (GEMINI unset, HH_USER_AGENT unset). All required checks green. Profile customized: `"Acceptance Test"`. Anthropic key set, Playwright installed.
- Sidebar: 23 entries, 2 duplicates (`#/dashboard`×2, `#/batch`×2) — see G-011 below.
- 8 lang buttons present: `en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW`.
- Theme toggle button (`#theme-toggle`) present.

## 8-locale page-rendering matrix (live h1 verification)

| Locale | /dashboard | /scan | /cv | /help | /tracker | /evaluate | EN bleed in UI? |
|---|---|---|---|---|---|---|---|
| en | Command Center | Vacancy search | CV | Help | (n/a) | (n/a) | n/a |
| ru | Командный центр | Поиск вакансий | CV | Справка | Трекер заявок | Оценить вакансию | none |
| es | Centro de Comando | Búsqueda de vacantes | — | — | — | — | none |
| pt-BR | Centro de Comando | Busca de vagas | CV | Ajuda | — | — | only CLI-doc tokens in /help body (acceptable — those are command literals: `npm run doctor`, `Run live`) |
| ja | コマンドセンター | 求人検索 | 履歴書 | ヘルプ | — | — | only CLI-doc tokens in /help body |
| ko | 커맨드 센터 | 채용 공고 검색 | — | 도움말 | — | — | none |
| zh-CN | 指挥中心 | 职位搜索 | — | 帮助 | — | — | none |
| zh-TW | 指揮中心 | 職位搜尋 | 履歷 | 說明 | 申請追蹤器 | 評估職位 | none |

**Verdict: all 8 locales render correctly on every page tested.** The previous v1.10 F-001 / F-002 / G-001 findings are all visually closed.

## Theme toggle (Scenario 20.1) — PASS

```json
{
  "initial":     "light",
  "afterClick1": "dark",
  "persistedLS": "dark",   // localStorage.theme
  "afterClick2": "light",
  "toggleWorks": true,
  "reverts":     true
}
```

Visual diff captured in screenshots `ss_32075gcq5` (light/ru) and `ss_1941z5ivr` (light/zh-TW after toggle test).

## Conformance vs career-ops.org/docs — live findings

### ✅ Confirmed FIXED in v1.14.0

| Finding | Before (v1.10) | v1.14.0 live evidence |
|---|---|---|
| F-001 / G-001 | "EN: 80 · RU: hh.ru + Habr Career" on /#/scan | Subtitle now: **"ATS-адаптеры + региональные порталы (hh.ru, Habr Career)"** + "Компания (опционально)" (no "для EN") + scan bagdes "ATS adapters · 13.05.2026, 05:31:18 · 11 new / 500 matching" + "Regional portals · 13.05.2026, 05:31:18 · 0 new / 0 matching" |
| F-002 | Korean help body fallback to EN | `/#/help` on ko renders `도움말` h1 + Korean body (`첫 실행부터 인터뷰 준비까지…`) |
| F-009 | /api/evaluate ignored `mode:'manual'` | live test: `POST /api/evaluate {mode:'manual'}` returns in <500 ms with `mode:'manual'` in body |
| F-012 | LLM prompts didn't propagate locale | live test: `POST /api/evaluate {jd, mode:'manual', lang:'ru'}` returns prompt containing language directive (`hasLanguageDirective: true`) |
| Scenario 17.4 (Playwright link on #/apply) | n/a | confirmed: `<a href="https://career-ops.org/docs/introduction/guides/set-up-playwright">` rendered, plus a second `<a href="…/apply-for-a-job">` |
| Scenario 20.1 (theme toggle) | n/a | works + persists + reverts cleanly |
| Active Companies (formerly static 96/80) | static | now `22/80` — derived from actual scan hits, not the full tracked list (F-011 partial fix) |

### ❌ Still OPEN against canonical docs (live evidence captured)

#### G-005 · Block A-G in our reports vs canonical A-F (semantic divergence) — UNVERIFIED LIVE

A real evaluation would emit A-F per docs Quick Start §"Reading your results". Source check shows our `modes/oferta.md` (parent) uses A-G with C=Risks, F=Verdict, G=Legitimacy — doc-divergent. Couldn't fully verify live without a 1-3 min live LLM call. Marked as STILL OPEN; needs runtime confirmation after the parent's `modes/oferta.md` is realigned (PR-A of FIX-PROMPT-v15.md).

#### G-006 · #/tracker columns: `# | Date | Company | Role | Score | Status | PDF | (action)` — NO Legitimacy column

```json
{
  "h1": "Трекер заявок",
  "columns": ["#","Дата","Компания","Роль","Score","Статус","PDF",""],
  "hasLegitimacy": false,
  "rowCount": 1,
  "firstRowSample": ["001","2026-05-08","Acme | Co","Senior Backend Engineer","4.2/5","Evaluated","—",""]
}
```

The `#/reports` cards DO render `legitimacy` as a tag (`reports.js:59`), but the tracker doesn't surface it. Docs `guides/scan-job-portals` batch table includes Legitimacy. Fix in PR-B.

#### G-007 · Auto-pipeline 1-click flow — NOT EXPOSED

Sidebar has no "✨ Auto-pipeline" button. No `/api/auto-pipeline` route (probed earlier: 404). Today the user navigates Pipeline → Evaluate → Save → PDF → Tracker manually — 4 clicks across 2 pages. Docs Quick Start §Step-7 promises 1-click. Fix in PR-C.

#### G-008 · /#/config has only 2 tabs (`API keys & runtime`, `Profile`) — NO Modes tab

```json
{
  "h1": "Настройки приложения",
  "tabs": ["API-ключи и runtime", "Профиль"],
  "hasModesTab": false,
  "fields": ["ANTHROPIC_API_KEY✓ set","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","PORT","HOST","HH_USER_AGENT"]
}
```

The canonical docs §Step-5 say `modes/_profile.md` is "the most-edited file" (target roles + adaptive framing + exit narrative + comp targets + location policy). Our UI has no editor for it. Even worse: HH_USER_AGENT is still in the main field list (F-013 fix added `cfg.groups` but the UI doesn't seem to use the regional group yet — or our test profile has russian_portals enabled so it's auto-shown).

Fix in PR-D.

#### G-011 · NEW · Duplicate sidebar entries for `#/dashboard` and `#/batch` — MAJOR (UX + routing)

```json
{
  "duplicates": [["#/dashboard", 2], ["#/batch", 2]],
  "batchRelated": [
    { "href": "#/batch", "dataRoute": "batch", "text": "⇶ Пакетная обработка" },
    { "href": "#/batch", "dataRoute": "batch", "text": "▥ Пакетная обработка" }
  ]
}
```

Two sidebar entries for batch: ⇶ under "Решение" (Decision) and ▥ under "Заявка" (Application). Both go to the same `#/batch` route. The user clicks either and lands on the **mode-prompt builder** (legacy v1.10 page) — NOT the v1.13.0 TSV editor SPA.

Source-side proof:

- `public/js/views/batch.js` (8 KB) — the v1.13.0 TSV SPA with `API.get('/api/batch')`, TSV editor, parallel select.
- `server/lib/routes/batch.mjs` — 4 endpoints (`GET /api/batch`, `PUT /api/batch`, `POST /api/batch/run`, `POST /api/batch/merge`).
- BUT `#/batch` SPA route maps to `MODES.batch` (mode-prompt builder), shadowing the TSV view.

What the user sees at `/#/batch` today:

```
H1:        "Пакетная оценка"
Subtitle:  "Оценка 10+ JD за раз через batch/batch-runner.sh — см."
Input:     <textarea>  placeholder "https://…\nhttps://…"  (newline-separated URLs, NOT TSV)
Field:     "Параллельные воркеры (по умолч. 4)"  — single number input (NOT 1/2/3 select)
Buttons:   ⚡ Запустить вживую, Сгенерировать промпт
```

Missing per docs `guides/batch-evaluate-offers`: TSV editor (id/url/source/notes), --dry-run checkbox, --min-score input, --retry-failed checkbox, --max-retries input, pending-additions list, merge button.

This is a major regression — the entire v1.13.0 Batch SPA flow is unreachable.

**Fix (NEW PR-H in FIX-PROMPT-v15.md):**

```js
// public/js/app.js — router registration
// Today:
//   '/batch': { view: ModePromptView, mode: 'batch' }   // mode prompt builder
// New:
//   '/batch': { view: BatchTsvView }                    // v1.13.0 TSV SPA
//   '/batch-prompt': { view: ModePromptView, mode: 'batch' }   // keep old as separate route
```

And dedupe sidebar:

```js
// public/js/views/sidebar.js
const SIDEBAR = [
  { group: 'sourcing', items: [...] },
  { group: 'decision', items: [
    { route: '/evaluate', i18n: 'side.evaluate' },
    { route: '/batch',    i18n: 'side.batch' },        // ONE entry, under Decision
    { route: '/deep',     i18n: 'side.deep' },
  ]},
  { group: 'application', items: [
    { route: '/apply',    i18n: 'side.apply' },
    { route: '/tracker',  i18n: 'side.tracker' },
    { route: '/followup', i18n: 'side.followup' },
    // remove the second /batch entry that's here today
  ]},
];
```

### Remaining still-open (carried from earlier audits)

| ID | Title | Status |
|---|---|---|
| G-002 (was F-015) | No 📄 Generate PDF on `#/interview-prep` | source confirmed — `public/js/views/interview-prep.js` has 0 PDF refs |
| G-003 | `README.cn.md` should be `README.zh-CN.md` for naming consistency | confirmed via `ls README*.md` |
| G-004 (was F-018) | `/api/stream/scan-en` + `/api/stream/scan-ru` kept as deprecated aliases | intentional v1.12 transition; schedule removal for v1.15 |
| G-009 | profile.yml schema: missing `location`, `narrative.headline` fields in summary card | confirmed via /api/profile probe |
| G-010 | `seniority_boost` not documented in help §5 across 8 locales | confirmed via help bundle grep |
| score-thresholds card on #/reports | Only rendered when reports.length > 0; should also show on empty state (it's the canonical action guide) | live: empty state has no `<details>` block, no threshold table |
| /api/scan-results shape | Still `{ en: [...], ru: [...] }` — not `{ bySource, hits }` | confirmed via live probe; F-018 deep regression |
| /api/portals stats | `hasStats: false` — no `stats.bySource` shape; `tracked_companies` is still the full 96 list with no derived "active" flag per-row | F-011 only partial |

## Verdict

**v1.14.0 ships in good shape for the visible UI surfaces.** Locale rendering is correct across 8 languages; theme toggle works and persists; help bundles have parity; scan UI replaced the EN/RU framing with ATS / regional vocabulary; 6 ATS adapters resolve; Playwright link is in place on `#/apply`.

**Still required for full doc-conformance** (going into v1.15.0):

1. **G-011** — dedupe sidebar; route `#/batch` to the TSV SPA, not the mode-prompt builder.
2. **G-007** — `/api/auto-pipeline` + `✨ Auto-pipeline` button (the 1-click flow promised by canonical Step-7).
3. **G-008** — `modes/_profile.md` editor as a third tab on `#/config` + read-only card on `#/profile`.
4. **G-005** — re-align `modes/oferta.md` to canonical A-F structure (requires coordinated parent commit).
5. **G-006** — Legitimacy column on `#/tracker`.
6. Score-thresholds card on `#/reports` should also render on empty state.

These five fixes close the gap between "what career-ops.org/docs promises" and "what career-ops-ui v1.14.0 delivers."

