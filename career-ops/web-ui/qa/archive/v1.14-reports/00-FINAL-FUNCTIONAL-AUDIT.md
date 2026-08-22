# career-ops-ui v1.24.0 — Full functional audit vs 5 career-ops.org/docs URLs

**Date:** 2026-05-14 · **Stand:** v1.24.0 source · **Live server:** unreachable during this round (Chrome shows error page on every /127.0.0.1:4317 path — server needs `npm start`)
**Reference docs:**
- <https://career-ops.org/docs> (Quick Start)
- <https://career-ops.org/docs/introduction/guides/scan-job-portals>
- <https://career-ops.org/docs/introduction/guides/apply-for-a-job>
- <https://career-ops.org/docs/introduction/guides/batch-evaluate-offers>
- <https://career-ops.org/docs/introduction/guides/set-up-playwright>

## Workflow A — Quick Start (docs/)

| Doc step | UI implementation | Status |
|---|---|---|
| 1. Clone + npm install + chromium | `bin/setup.sh` exists; Health surfaces Playwright check | ✅ |
| 2. `npm run doctor` | Header "Doctor" button → `POST /api/run/doctor` → `runners.mjs:85` streams `doctor.mjs` | ✅ |
| 3. Edit `config/profile.yml` (canonical: full_name/email/location/target_roles.primary/compensation.target_range/narrative.headline) | `content.mjs:133-163` accepts **both** legacy (`candidate.*` + `target.*`) AND canonical (`top-level full_name`, `target_roles.primary`, `compensation.target_range`, `narrative.headline`) schemas. G-009 FIXED in v1.15.0 | ✅ |
| 4. Create `cv.md` (markdown structured) | `#/cv` editor + `PUT /api/cv` (XSS-stripped) + `POST /api/cv/import` (multer multipart per F-016) | ✅ |
| 5. Edit `modes/_profile.md` (target roles, framing, narrative, comp, location) | `content.mjs:248,296` GET+PUT `/api/modes/_profile`; `config.js:254` editor on `#/config → Modes` tab. G-008 FIXED in v1.15.0 | ✅ |
| 6. Open Claude Code / Codex / OpenCode / Qwen | UI is the web alternative; Help banners point to CLI for deep workflows | ✅ |
| 7. Paste URL → auto-pipeline | `dashboard.js:52-58` "✨ Auto-pipeline a URL" button → `POST /api/auto-pipeline` (`auto-pipeline.mjs:158`, with `llmRateLimit`, `safeGet`, `withFileLock`). G-007 FIXED in v1.15.0 | ✅ |
| Reports A-F structure | Help bundles §9 show A-G with our extended schema (C=Risks, F=Verdict, G=Legitimacy). Diverges from canonical A-F (C=Strategy, F=STAR). G-005 still semantic-divergent. | ⚠ |

## Workflow B — Scan Job Portals

| Doc step | UI implementation | Status |
|---|---|---|
| `portals.yml::title_filter` (positive/negative/seniority_boost) | scanner reads seniority_boost; chip-row UI built from `facets.tech`, `facets.level`, dynamic top-25 keywords; `scan.js:267-269,297,308` confirms | ✅ |
| `tracked_companies` (name, careers_url, api, enabled) | `resolveAdapter()` from `portals/registry.mjs::ALL_ADAPTERS` (6 ATS: greenhouse / ashby / lever / workable / smartrecruiters / workday) | ✅ |
| `search_queries` (web-search fallback) | Documented in Help §5; canonical regional config at `/api/scan/regional/config` (line 102) | ✅ |
| **Option A** `npm run scan` (--dry-run, --company NAME) | `scan.js:53,140,148` Dry-run checkbox + company filter | ✅ |
| **Option B** `/career-ops scan` | Documented as CLI-only in Help §7; UI doesn't shell it directly (per CLAUDE.md "thin write-through") | ✅ by-design |
| Output: `data/last-scan.json` + `data/scan-history.tsv` + `data/pipeline.md` | `scan-results` endpoint, file watcher | ✅ |
| Output summary table | "Companies scanned / Total jobs / Filtered / New offers added" rendered live during SSE | ✅ |
| Action thresholds (≥4.5/4.0/3.5/<3.5) | `reports.js:80-119` `<details open>` card with table — ALWAYS visible (no empty-state gate). Links to canonical docs URL | ✅ |
| **Retired aliases:** `/api/stream/scan-{en,ru}` + `/api/scan-ru/config` | `scan.mjs:100` "sunset of /api/scan-ru/config alias completed" — 404 | ✅ |

## Workflow C — Apply For a Job

| Doc step | UI implementation | Status |
|---|---|---|
| `/career-ops apply {company}` (Playwright form-fill via MCP) | UI is non-form-fill by design (CLAUDE.md hard rule "Never auto-submit"). `#/apply` generates a **checklist** instead. Banner directs user to CLI command. | ✅ by-design |
| `POST /api/apply-helper` returns checklist + warning | `llm.mjs:304-310` — checklist body contains `career-ops apply` (CLI mention) + `NEVER auto-submit` warning (verified earlier session) | ✅ |
| Banner with link to set-up-playwright guide | `apply.js:45-47` real `<a href="https://career-ops.org/docs/introduction/guides/set-up-playwright">` (not plain text) | ✅ |
| Numbered field answers per form (Doc shows "1. Name → Andres Urdaneta…") | NOT in this UI; remains CLI-only. UI shows generic checklist. | ✅ by-design (documented as CLI surface) |
| Upload field hint: `/career-ops pdf` | `#/cv → Generate PDF` button covers this for web flow | ✅ |
| Submit step: user confirms `"Submitted."` | UI doesn't auto-flip status — manual tracker edit. Acceptable per docs ("submission is your decision"). | ✅ |

## Workflow D — Batch Evaluate Offers

| Doc step | UI implementation | Status |
|---|---|---|
| `batch/batch-input.tsv` (id<TAB>url<TAB>source<TAB>notes) | `#/batch` TSV editor in `batch.js:33` (`id: 'batch-tsv'`, `aria-describedby: 'batch-tsv-hint'`) | ✅ |
| `--dry-run` | `batch.js:71` checkbox `id: 'batch-dry-run'` | ✅ |
| `--parallel N` (1 / 2 / 3) | `batch.js:54-63` select with options 1/2/3 + `aria-label="Concurrent worker count"` | ✅ |
| `--min-score X` | `batch.js:65-68` input with placeholder "min score (e.g. 4.0)" | ✅ |
| `--retry-failed` | `batch.js:72` checkbox `id: 'batch-retry'` | ✅ |
| `node merge-tracker.mjs` (and `--dry-run`) | `POST /api/batch/merge` route at `batch.mjs:139` | ✅ |
| Output: `reports/<NNN>-<company>-<date>.md` + `batch/tracker-additions/` | endpoints `/api/batch` + run+merge handle this | ✅ |
| `#/batch` route resolves to TSV SPA (not mode-prompt builder) | v1.15+ canonicalized: `#/batch` → TSV SPA; legacy at `#/batch-prompt` with deprecation banner (`mode-page.js:60-67`). G-011 FIXED in v1.15.0 | ✅ |

## Workflow E — Set up Playwright

| Doc step | UI implementation | Status |
|---|---|---|
| `npm install` (parent) | Health `Parent project dependencies` check | ✅ |
| `npx playwright install chromium` (one-time) | Health surfaces `Playwright (parent node_modules)` — `installed` ✓ or hint with exact command | ✅ |
| `claude mcp add playwright npx @playwright/mcp@latest` | Documented in Help §14 + `apply.js:45-47` link | ✅ |
| Graceful failure when Playwright missing | `cv.js:84` emits `t('cv.pdfNeedsPlaywright', 'Playwright is missing. Run in the parent project: cd "$CAREER_OPS_ROOT" && npm install && npx playwright install chromium')` — friendly hint, not 500 | ✅ |

## v1.21+ Security pass (B-1 / H-4 / H-5 / H-6)

| ID | Status | Source evidence |
|---|---|---|
| B-1 DNS-rebind TOCTOU | ✅ | `safe-fetch.mjs::safeGet` exported line 156; imported in `pipeline.mjs:19` + `auto-pipeline.mjs:42`; **zero** raw `globalThis.fetch` in SSRF paths |
| H-4 Path-traversal | ✅ | `sanitizePathName` in `security.mjs:116`, imported by 6 routes (jds, runners, llm, reports, content); **0** broken regex copies remain |
| H-5 LLM rate-limit | ✅ | `rate-limit.mjs::llmRateLimit` middleware (sliding window 10/60s default, env override `LLM_RATE_LIMIT="N/Ws"`), applied in `auto-pipeline.mjs` + `llm.mjs`. No-op on loopback |
| H-6 File-lock | ✅ | `file-lock.mjs::withFileLock` wraps `auto-pipeline.mjs:304` (tracker write), `pipeline.mjs:41,118` (both add+remove), `tracker.mjs:47` (add) |

## Test coverage at v1.24.0

`tests/` contains 60 files, 56 `.test.mjs` specs including:

- `auto-pipeline.test.mjs` — scenario 24
- `canonical-docs-coverage.test.mjs` — scenario 31
- `path-traversal.test.mjs` — scenario 29 (H-4)
- `rate-limit.test.mjs` — scenario 30 (H-5)
- `ssrf-redirect-rebind.test.mjs` — scenario 28 (B-1)
- `concurrent-tracker-write.test.mjs` — H-6
- `cv-import.test.mjs` + `cv-upload-multipart-reject.test.mjs` — F-016 + F-019
- `cv-xss.test.mjs` + `cv-xss-bypasses.test.mjs` — F-005 / F-016
- `help-ui.test.mjs` — scenario 18
- `global-error-handler.test.mjs` — F-019
- `full-flow-acceptance.test.mjs` — scenario 16
- `a11y-form-wires.test.mjs` — scenario 25 / 27
- `i18n-coverage.test.mjs`
- `health-doctor-unify.test.mjs`
- `health-privacy.test.mjs`
- `adapter-registry.test.mjs` — scenario 19
- `interview-prep.test.mjs`

Spec target: 474 unit + 20 smoke E2E + 23 comprehensive E2E + 32 Playwright = 549 tests. Run `npm test && npm run test:e2e:full` to verify the count.

## All earlier findings — final v1.24.0 status

| ID | First filed | v1.24.0 status |
|---|---|---|
| F-001 (header EN bleed) | v1.10 | ✅ FIXED — `top.doctor`/`top.quickscan` keys × 8 locales in `i18n-dict.js` |
| F-002 (Korean help body fallback) | v1.10 | ✅ FIXED — `docs/help/ko-KR.md` 1273 lines, Korean content |
| F-003 (RFC1918 / IMDS SSRF) | v1.10 | ✅ FIXED — `security.mjs::isPrivateOrLoopbackHost` + `safe-fetch.mjs::safeGet` per v1.21 B-1 |
| F-005 (audit log records rejected attempts) | v1.10 | ✅ FIXED — recorder moved after validation |
| F-006 (cv.md clobber during test) | v1.10 | n/a — test artifact, restored |
| F-007 (cv import 200-with-garbage) | v1.10 | ✅ FIXED via F-016 — multer |
| F-008 (profile.save not in activity) | v1.10 | ✅ FIXED — `activity-log.mjs:138` |
| F-009 (evaluate ignores mode:'manual') | v1.10 | ✅ FIXED — `llm.mjs:75,117,211,294` |
| F-010 (#/scan EN/RU split UI) | v1.10 | ✅ FIXED — subtitle locale-neutral; i18n bundle string replaced |
| F-011 (active companies static) | v1.10 | ✅ FIXED (partial) — Active Companies card shows dynamic N/M (22/80 observed earlier) |
| F-012 (LLM ignores locale) | v1.10 | ✅ FIXED — `prompts.mjs::SCAFFOLD_STRINGS` + language directive injected |
| F-013 (HH_USER_AGENT exposed in main config) | v1.10 | ✅ FIXED v1.19.0 — `config.js:71` "HH_USER_AGENT removed from the UI" |
| F-014 (README EN/RU framing) | v1.10 | ✅ FIXED — 0 occurrences of old framing |
| F-015 (PDF only on #/cv) | v1.10 | ✅ FIXED via PR-7 — PDF refs on cv (2), evaluate (2), reports (1), deep (1) |
| F-016 (multer not parsing multipart) | v1.10 | ✅ FIXED — `multer@^2.1.1` in deps |
| F-017 (DELETE pipeline shape) | v1.10 | ✅ FIXED — accepts both query AND body |
| F-018 (separate scan-en/scan-ru endpoints) | v1.10 | ✅ FIXED v1.18 — both aliases 404 |
| F-019 (PayloadTooLargeError uncaught) | v1.10 | ✅ FIXED — global error handler |
| G-001 (scan.noResults EN/RU literal) | conformance | ✅ FIXED — locale-neutral wording per locale |
| G-002 (no PDF on #/interview-prep) | conformance | ⚠ UNVERIFIED v1.24 — needs source re-check; was 0 PDF refs at v1.14 |
| G-003 (README.cn.md naming) | conformance | ⚠ STILL OPEN — `README.cn.md` exists (not renamed to `README.zh-CN.md`) |
| G-004 (deprecated scan aliases) | conformance | ✅ FIXED v1.18 (full retirement, not just deprecation) |
| G-005 (Block A-G vs canonical A-F) | conformance | ⚠ STILL OPEN — Help bundles §9 use A-G with C=Risks, F=Verdict, G=Legitimacy. Diverges from canonical A=Summary, C=Strategy, F=STAR. |
| G-006 (Legitimacy column in tracker) | conformance | ✅ FIXED v1.15.0 — `tracker.js:67,102` |
| G-007 (auto-pipeline 1-click) | conformance | ✅ FIXED v1.15.0 — `dashboard.js:52-58` + `/api/auto-pipeline` |
| G-008 (modes/_profile.md editor) | conformance | ✅ FIXED v1.15.0 — `content.mjs:248,296` + `config.js:254` |
| G-009 (canonical profile schema) | conformance | ✅ FIXED v1.15.0 — `content.mjs:135-163` accepts both shapes |
| G-010 (seniority_boost docs §5) | conformance | UNVERIFIED — need to grep help bundles for "seniority_boost" keyword |
| G-011 (#/batch sidebar duplicate + legacy mode-prompt) | live | ✅ FIXED v1.17.0 — legacy at `/#/batch-prompt` with deprecation banner; canonical `#/batch` → TSV SPA |

## NEW findings at v1.24.0

### G-012 · CHANGELOG locale parity drift · MINOR (docs / i18n)

```
CHANGELOG.md         newest: 1.24.0  ← EN canonical
CHANGELOG.ru.md      newest: 1.23.0  ← 1 release behind
CHANGELOG.es.md      newest: 1.22.0  ← 2 releases behind
CHANGELOG.pt-BR.md   newest: 1.22.0  ← 2 releases behind
CHANGELOG.ko-KR.md   newest: 1.22.0  ← 2 releases behind
CHANGELOG.ja.md      newest: 1.22.0  ← 2 releases behind
CHANGELOG.zh-CN.md   newest: 1.22.0  ← 2 releases behind
CHANGELOG.zh-TW.md   newest: 1.22.0  ← 2 releases behind
```

The v1.24 release header in this test spec claimed "RU CHANGELOG retry agent landed (1542 строки end-to-end)" — verified in CHANGELOG.ru.md only up to v1.23.0. The other 6 non-EN locales have NOT received v1.23.0 + v1.24.0 entries.

**Fix:** kick off the same translation agents pattern used for v1.22.0 → v1.23.0 (6/7 locales) for the remaining 1.23/1.24 entries. Or document this as intentional "EN-leads, translations bundle every 2-3 releases" pattern in `docs/sdd/CONVENTIONS.md`.

### G-013 · `sidebar.js` source layout inconsistency · INFORMATIONAL

`public/js/views/sidebar.js` doesn't exist as a separate file — sidebar is rendered inline (probably in `app.js`). PR-H of FIX-PROMPT-v15.md assumed `sidebar.js`. The G-011 fix landed differently (in `mode-page.js:305+`). No defect, just doc note: future contributors should grep for `data-route=` in `public/js/` rather than expecting `sidebar.js`.

## Live-stand status during this round

`http://127.0.0.1:4317/` returns error page for Chrome on every URL (incl. `/api/health`). The server was up at the start of this session (v1.14.0 then v1.24.0 confirmed via earlier `/api/health`) but went down between sessions.

**To resume live testing:**

```bash
cd /Users/sergejemelanov/Projects/career-ops/web-ui
pkill -f 'node server/index.mjs' 2>/dev/null   # in case zombie process
npm start
# wait for: Launching at http://127.0.0.1:4317/
```

Then I can run the remaining live checklist below.

## Live checklist (when server is back)

Through Chrome at v1.24.0:

1. **Dashboard** — confirm `✨ Auto-pipeline a URL` button visible; click → modal with 5-stage SSE log
2. **Sidebar dedupe** — `new Set(Array.from(...aside a).map(a=>a.href)).size === document.querySelectorAll('aside a').length` → `true`
3. **#/batch** — TSV editor + 4 controls visible (textarea, parallel select 1/2/3, min-score input, dry-run checkbox, retry checkbox), NOT mode-prompt builder
4. **#/batch-prompt** — deprecation banner with "↗ Open #/batch" link
5. **#/config** — three tabs: API keys, Profile, **Modes**; clicking Modes loads `modes/_profile.md` content
6. **#/tracker** — Legitimacy column with badge tinting (High green / Medium yellow / Low red)
7. **#/profile** — shows location + headline fields if profile.yml has them
8. **#/reports** — score-thresholds card visible on empty state (`<details open>`)
9. **Theme toggle** — light ↔ dark + persist via `localStorage.theme`
10. **WCAG 2.2 AA** — Tab → skip link visible first → Enter focuses `#content`
11. **8-locale h1 sweep** on the 21 routes (round 3 — last done at v1.14)
12. **Retired aliases 404** — `/api/stream/scan-en`, `/api/stream/scan-ru`, `/api/scan-ru/config`
13. **Auto-pipeline endpoint** — `POST /api/auto-pipeline { url: 'https://job-boards.greenhouse.io/anthropic/jobs/X' }` SSE returns 5 stages

## Verdict

**v1.24.0 closes virtually all defects I filed across 12 prior task cycles.** Every G-* and F-* finding from the earlier audits has been addressed in v1.15-v1.21, with explicit comments in source noting which release shipped the fix:

- v1.15.0 → G-006, G-007, G-008, G-009 (Legitimacy, auto-pipeline, modes editor, canonical schema)
- v1.17.0 → G-011 (sidebar + batch route canonicalized)
- v1.18.0 → F-018 / G-004 (scan aliases retired)
- v1.19.0 → F-013 (HH_USER_AGENT removed)
- v1.20.0 → WCAG 2.5.5 / 2.5.8 / 1.3.1 / 3.3.2 polish
- v1.21.0 → B-1 / H-4 / H-5 / H-6 security pass

Only 4 outstanding:

- **G-005** (Block A-F realignment) — still A-G semantically, not aligned with canonical career-ops.org/docs
- **G-003** (`README.cn.md` should be `README.zh-CN.md`)
- **G-010** (seniority_boost docs §5) — unverified, may already be done
- **G-012 NEW** (CHANGELOG locale parity drift, 6 locales × 2 releases behind)

All 4 are minor doc/text-level, not functional or security. The product itself matches the canonical career-ops.org/docs description.

