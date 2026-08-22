# career-ops-ui v1.24.0 — Regression report (scenarios 24-31)

**Date:** 2026-05-14 · **Stand build:** v1.24.0 (verified via `package.json`)
**Verification surface:** source-code + workspace files (Chrome offline this round; visual sub-tests pending)

## Scenario-by-scenario matrix

| # | Scenario | Source PASS | Visual sub-tests pending |
|---|---|---|---|
| 24 | Auto-pipeline SSE (v1.16.0) | ✅ `routes/auto-pipeline.mjs:158` registers `POST /api/auto-pipeline` with `llmRateLimit` middleware. Uses `safeGet` + `withFileLock`. | 24.2 live SSE stream + 24.4 activity log entry |
| 25 | WCAG 2.2 AA (v1.18.0) | ✅ Skip link `index.html:23`; `#content tabindex="-1"` line 141; `document.documentElement.lang` set dynamically in `i18n.js:75`; `.btn` 44px + `.btn-sm` 32px in `app.css:391, 431` | 25.2 focus-visible outline; 25.3 measured button heights |
| 26 | Contrast + HH_USER_AGENT (v1.19.0) | ✅ Badge `*-text` variants `app.css:586-589`; `config.js:71` comment "HH_USER_AGENT removed from the UI per user direction" | 26.1/26.2 axe-contrast check on light + dark |
| 27 | Per-component a11y + alias retired (v1.20.0) | ✅ `scan.mjs:100` "sunset of /api/scan-ru/config alias completed"; `/api/scan/regional/config` is canonical; `.chip` 28px, `.nav-item`/`.tab-btn` 44px in CSS; `aria-describedby` in batch.js / mode-page.js / config.js / evaluate.js | 27.3 live DOM measurements; 27.4 all controls have label/aria-label; 27.5 all aria-describedby IDs resolve |
| 28 | DNS-rebind TOCTOU (v1.21.0 B-1) | ✅ `safe-fetch.mjs::safeGet` exported line 156; `pipeline.mjs:19` + `auto-pipeline.mjs:42` import `safeGet`; **zero** raw `globalThis.fetch` calls in SSRF paths; comments document the TOCTOU fix | 28.2 live private-host rejection via `/api/pipeline/preview` |
| 29 | Path-traversal hardening (v1.21.0 H-4) | ✅ `sanitizePathName` exported `security.mjs:116`; **0** broken regex copies in `server/`; imported by 6 routes: `jds`, `runners`, `llm`, `reports`, `content` (each calls before file IO) | 29.2 live `..pdf`/`....md` returns 400/404 |
| 30 | LLM rate-limit (v1.21.0 H-5) | ✅ `rate-limit.mjs` middleware with sliding window, 10 req/60s default, env override `LLM_RATE_LIMIT="N/Ws"`. Used in `auto-pipeline.mjs` + `llm.mjs`. No-op on loopback, active only when `isPubliclyExposed() === true` | 30.2/30.3 live `HOST=0.0.0.0` 429 trigger |
| 31 | career-ops.org/docs alignment (v1.22.0+) | ✅ 40/40 coverage cells filled (see matrix below) | 31.1-31.5 visual UI parity checks |

### Scenario 31 — canonical URL coverage matrix (live grep)

| URL | en | es | pt-BR | ko-KR | ja | ru | zh-CN | zh-TW | Sum |
|---|---|---|---|---|---|---|---|---|---|
| what-is-career-ops | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 32 |
| scan-job-portals | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 40 |
| apply-for-a-job | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 |
| batch-evaluate-offers | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 40 |
| set-up-playwright | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 |
| **Per-locale total** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **20** | **160** |

40 / 40 coverage cells. PASS.

### Help-bundle size growth (v1.24.0 vs. v1.22)

| Locale | Lines (v1.24.0) | Spec target |
|---|---|---|
| en | 1269 | 1113 → 1269 ✅ |
| es | 1341 | 1184–1344 ✅ |
| pt-BR | 1344 | 1184–1344 ✅ |
| ko-KR | 1273 | 1184–1344 ✅ |
| ja | 1310 | 1184–1344 ✅ |
| ru | 1319 | 1184–1344 ✅ |
| zh-CN | 1184 | 1184–1344 ✅ |
| zh-TW | 1198 | 1184–1344 ✅ |

All 8 within target. PASS.

### File-lock H-6 (concurrency) — bonus verified

`withFileLock` from `server/lib/file-lock.mjs` wraps every RMW on `data/applications.md` and `data/pipeline.md`:

- `auto-pipeline.mjs:304` — `await withFileLock(PATHS.applications, …)`
- `pipeline.mjs:41 + :118` — both add and remove guarded
- `tracker.mjs:47` — adds guarded

Concurrent POSTs to `/api/tracker` no longer race-lose rows. PASS (source-level).

## Status against my earlier (pre-v1.24) findings

| ID | Filed in | Status at v1.24.0 |
|---|---|---|
| F-001..F-019 (v1.10.x findings) | session-1 | All FIXED or intentionally deprecated (see `qa/live-chrome/01-FULL-MATRIX-v14.md`) |
| G-001 (scan.noResults EN/RU literal) | conformance round | FIXED — UI subtitle is locale-agnostic, i18n bundle bleed string also replaced per spec |
| G-005 (Block A-F vs A-G) | conformance round | UNVERIFIED LIVE — needs live evaluate call |
| G-006 (Legitimacy column) | conformance round | UNKNOWN at v1.24.0 — not on the changelog feature list, needs Chrome to confirm |
| G-007 (auto-pipeline) | conformance round | **FIXED in v1.16.0** — `POST /api/auto-pipeline` is live |
| G-008 (modes/_profile.md editor) | conformance round | UNKNOWN at v1.24.0 — not on the changelog feature list, needs Chrome |
| G-009 (profile schema location, headline) | conformance round | UNKNOWN — pending |
| G-010 (seniority_boost docs) | conformance round | UNKNOWN — pending |
| G-011 (sidebar dup #/batch + #/dashboard, batch SPA missing) | live-chrome round | **PARTIALLY FIXED** — v1.17.0 removed legacy `#/batch-prompt`, but duplicate sidebar entry status needs Chrome to confirm |

## What's left for Chrome (when reconnected)

1. **24.2** — SSE stream from `POST /api/auto-pipeline { url }` emits the 5 documented stages (validate / fetch / evaluate / save-report / tracker) within 90 s
2. **25.1** — Tab on a fresh page → first focusable is the skip link, visible, Enter focuses `#content`
3. **25.2** — Visible focus outline on every tabbed element
4. **25.3** — measure `.btn` and `.btn-sm` heights via getBoundingClientRect (≥ 44 / ≥ 32)
5. **26.1 / 26.2** — axe-style contrast check on score pills + badges in both themes
6. **27.3 / 27.4 / 27.5** — DOM-level measurements + form-label association + aria-describedby ID resolution
7. **28.2** — `/api/pipeline/preview?url=https://localhost/x` → 400
8. **29.2** — `/api/jds/..pdf` → 400, `/api/reports/....md` → 400
9. **30.2 / 30.3** — server restart with `HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s`, 4th request hits 429 with Retry-After header
10. **31.1-31.5 visual** — UI parity with docs (score-thresholds card visible on #/reports, single 🌐 Scan button, #/apply with Playwright link, #/batch TSV editor + 4 controls, graceful PDF failure)
11. **G-006 / G-008 / G-009 / G-010 / G-011** carryover live verification
12. **8-locale × 21-route h1 sweep** on v1.24.0 (last done on v1.14.0 — sanity that v1.15→v1.24 didn't regress)

## Reproduction commands (for the Chrome session)

```bash
# After Chrome reconnects, run via Claude in Chrome:
# 1. health check
fetch('/api/health').then(r=>r.json()).then(h=>h.version)  // expect "1.24.0"

# 2. auto-pipeline endpoint exists
fetch('/api/auto-pipeline', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({url:'https://job-boards.greenhouse.io/anthropic/jobs/x'})}).then(r=>r.status)

# 3. retired aliases (all 404)
Promise.all([
  '/api/stream/scan-en','/api/stream/scan-ru','/api/scan-ru/config'
].map(p=>fetch(p).then(r=>[p, r.status])))

# 4. canonical regional config (200)
fetch('/api/scan/regional/config').then(r=>r.status)

# 5. Sidebar dedupe (G-011 status check at v1.24.0)
new Set(Array.from(document.querySelectorAll('aside a')).map(a=>a.href)).size
  === document.querySelectorAll('aside a').length  // true if no duplicates
```

## Verdict

**v1.24.0 ships a substantial security + a11y + i18n hardening pass.** All 8 new structural scenarios (24-31) pass source-level checks:

- v1.16.0 auto-pipeline closes G-007 (the biggest UX gap I filed earlier)
- v1.18.0 + v1.20.0 close every WCAG 2.2 AA criterion I would have raised
- v1.19.0 contrast + HH_USER_AGENT removal closes F-013 + matches docs voice
- v1.21.0 B-1 / H-4 / H-5 / H-6 close the four security findings I would have escalated if not already filed (DNS-rebind, path-traversal, LLM credit drain, RMW races)
- v1.22.0+ help-bundle refresh closes the canonical-docs coverage gap (every URL × 8 locales = 160 cells filled)

**Outstanding from earlier audits:** G-005 (Block A-F structure), G-006 (Legitimacy column), G-008 (modes/_profile.md editor), G-009 (canonical profile schema), G-010 (seniority_boost docs), and G-011 (sidebar duplicates) need a Chrome session to confirm whether they were addressed in v1.15-v1.24 silently or remain open.

**No release blockers identified** from source analysis. Run the Chrome sub-tests above to lock the verdict in.

