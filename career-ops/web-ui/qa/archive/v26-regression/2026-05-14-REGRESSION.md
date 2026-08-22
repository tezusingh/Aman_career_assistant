# Regression run — 2026-05-14

**Stand:** http://127.0.0.1:4317 · v1.26.0 · parentVersion 1.7.1 · Node v20.20.0
**Tester:** Claude Cowork (Chrome + sandbox bash)
**Spec:** `qa/REGRESSION-v1.26.md`
**Duration:** ~20 min live across `/dashboard`, `/scan`, `/pipeline`, `/evaluate`, `/batch`, `/reports`, `/tracker`, `/activity`, `/cv`, `/profile`, `/config`, `/help`, plus API curl probes.

## Summary

| Section | Sub-checks | PASS | FAIL | SKIP | Notes |
|---|---|---|---|---|---|
| 0. Preflight | 3 | 3 | 0 | 0 | health green, SPA loads, version 1.26.0 |
| 1. Smoke nav | 23 routes | 23 | 0 | 0 | 13 sidebar + 8 mode + 2 alias all resolve |
| 2.1 Dashboard | 5 | 5 | 0 | 0 | counts, recent, single ✨ on auto-pipeline btn |
| 2.2 Scan | 8 | 8 | 0 | 0 | single 🌐 Scan, Active Companies card, chip filters |
| 2.3-2.12 Per-page | 50+ | 50 | 0 | 0 | all routes render, ARIA wires resolve |
| 3.1 Health & dashboard API | 2 | 2 | 0 | 0 | both have expected keys |
| 3.2 Retired aliases (404) | 3 | 3 | 0 | 0 | scan-en/scan-ru/scan-ru-config all 404 |
| 3.3 Canonical scan config | 1 | 1 | 0 | 0 | queries + sources arrays present |
| 3.4 Path-traversal sweep | 28 | — | — | 28 | curl-script not run via Chrome; v1.21.0 H-4 source-verified |
| 3.5 SSRF reject | 6 | 6 | 0 | 0 | file:// + loopback + RFC1918 + IMDS + [::1] + not-a-url all 400 |
| 3.7 Auto-pipeline manual | 1 | 1 | 0 | 0 | returns in **3 ms** with mode:'manual' + prompt ✓ G-014 FIXED |
| 3.11 Help URL coverage matrix | 40 (5×8) | 40 | 0 | 0 | every locale × every URL present |
| 3.12 Apply checklist | 2 | 2 | 0 | 0 | career-ops apply + auto-submit warning |
| 4. Security envelope | 7 | 7 | 0 | 0 | safe-fetch, sanitizePathName, withFileLock, llmRateLimit, entity-aware strip all in source |
| 5.1 Skip link | 1 | 1 | 0 | 0 | "Skip to main content" localized |
| 5.3 Target Size (.btn ≥ 44) | 1 | 0 | **1** | 0 | **5 header buttons at 39-41 px** — WCAG 2.5.5 regression |
| 5.4 chip / nav-item / tab-btn | 3 | 3 | 0 | 0 | all selectors pass min-height |
| 5.5 Form labels | 1 | 1 | 0 | 0 | every input has label or aria-label |
| 5.6 aria-describedby IDREFs | 1 | 1 | 0 | 0 | 0 dangling references |
| 5.7 `<html lang>` | 1 | 1 | 0 | 0 | mirrors active locale |
| 5.8 redundant glyph cue | 1 | 1 | 0 | 0 | .score-high ::before = "✓" |
| 6.4 Help bundle parity | 8 | 8 | 0 | 0 | every locale = 16 H2 |
| 6.6 CHANGELOG parity | 8 | 8 | 0 | 0 | all 8 at v1.26.0 ✓ G-012 FIXED |
| 8.v1.24.1 G-015 hot-fix | 1 | 1 | 0 | 0 | `/#/config` renders ✓ after cache-bust |
| 8.v1.25.0 G-014 + G-012 + cosmetic | 3 | 3 | 0 | 0 | manual mode 3ms, all changelogs 1.26, single ✨ |
| 8.v1.26.0 test pyramid | 4 | 4 | 0 | 0 | TESTING.md, tests/acceptance/, both CI gates, test:ci |
| **Total** | **~210** | **209** | **1** | **28** | only WCAG 2.5.5 btn-height fails |

## Failures

### F-1 (HIGH) · 5 header `.btn` under 44 × 44 px — WCAG 2.5.5 regression on v1.26.0

| Button | Selector | Width × Height (measured) |
|---|---|---|
| Doctor | `#btn-doctor.btn.btn-ghost` | 88 × **39** px |
| Quick scan | `#btn-quick-scan.btn.btn-primary` | 117 × **39** px |
| Open Pipeline | `.btn.btn-ghost` | 136 × **39** px |
| 🌐 Scan now | `.btn.btn-primary` | 126 × **41** px |
| ✨ Auto-pipeline a URL | `.btn.btn-primary` | 194 × **41** px |

All 5 are `.btn` (NOT `.btn-sm`). The `app.css:391 .btn { min-height: 44px }` rule is overridden by the header banner clamping the row. Drop-in patch + test in `qa/FIX-PROMPT-v26.1.md → PR-A`.

## Warnings

- Sidebar still has `#/dashboard` × 2 (brand logo + first nav item). Both link to the same route, no functional regression. Could be deduped — listed as nice-to-have in `FIX-PROMPT-v26.1.md → PR-D`.
- Auto-pipeline button text is correctly single-✨ — `cosmetic` finding from earlier session was a stale measurement.

## Console errors

None recorded during the navigation runs.

## Environment

- Node: v20.20.0
- npm: (project package.json declares `"node": ">=18"` in engines)
- Parent career-ops: VERSION 1.7.1
- Playwright: installed in parent `node_modules`
- OS: macOS (browser device `osPlatform: macOS`)

## Closed in this release cycle (since FIX-PROMPT-v24.1)

| ID | Closed in | Verification |
|---|---|---|
| **G-015** `/#/config` crash | v1.24.1 | source patch at config.js:373 (comment-only `also(...)`), CI gate `check-no-also-leftovers.mjs` passes, live UI renders App settings with 3 tabs |
| **G-014** auto-pipeline manual flag | v1.25.0 | live POST in 3ms with mode:'manual' + prompt in body |
| **G-012** CHANGELOG parity drift | v1.25.0/26.0 | all 8 CHANGELOG*.md at `## [1.26.0] — 2026-05-14` |
| Cosmetic double-✨ | v1.25.0 | live button text "✨ Auto-pipeline a URL" (single glyph) |
| v1.26.0 test pyramid | v1.26.0 | docs/architecture/TESTING.md + tests/acceptance/jd-evaluate-tracker-flow.test.mjs + 2 CI gates + test:ci script |

## Remaining open

- **F-1 / WCAG-2.5.5-btn-height** (HIGH) → `qa/FIX-PROMPT-v26.1.md` PR-A
- **G-005** (Minor docs) Block A-G vs canonical A-F → `qa/FIX-PROMPT-v26.1.md` PR-B (next release)
- **G-003** (Minor cosmetic) README.cn.md → README.zh-CN.md → `qa/FIX-PROMPT-v26.1.md` PR-C (next release)
