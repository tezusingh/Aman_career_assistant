# Regression run — 2026-05-14 (v1.27.0)

**Stand:** http://127.0.0.1:4317 · v1.27.0 · parentVersion 1.7.1 · Node v20.20.0
**Tester:** Claude Cowork (Chrome + sandbox bash)
**Spec:** `qa/REGRESSION-v1.27.md`
**Duration:** ~5 min live verification

## Live verification (Chrome + curl)

| Section | Sub-check | Status | Observed |
|---|---|---|---|
| §0.1 | Health green | ✅ | `{"ok":true, "version":"1.27.0"}` |
| §0.4 | Sidebar dedupe | ✅ | `grep -c 'href="#/dashboard"' public/index.html` = **1** (was 2 on v1.26.x) |
| §1 | Sidebar dedupe gate | ✅ | Live DOM: `dashboardHrefCount: 1`, `sidebarTotal: 21` (was 22) |
| §1 | Brand block tag | ✅ | `<div class="logo">`, NOT `<a>` |
| §1 | Skip link | ✅ | "Skip to main content" in EN |
| §3.13 | Sidebar dedupe HTML gate | ✅ | both `<div class="logo">` + single `<a href="#/dashboard">` lines verified |
| §5.3 | `.btn:not(.btn-sm)` ≥ 44 px | ✅ | `smallBtnCount: 0` (was 5 on v1.26.0; v1.26.1 PR-A landed) |
| §6.6 | CHANGELOG parity | ✅ | All 8 CHANGELOGs at `## [1.27.0] — 2026-05-14` |
| §8.v1.27.0 | README rename (G-003) | ✅ | 8 canonical names: `README.{es,ja,ko-KR,pt-BR,ru,zh-CN,zh-TW}.md` + `README.md` |

## Source-side verification

| Section | Sub-check | Evidence |
|---|---|---|
| §8.v1.26.1 | `.btn` carries `min-height: 44px` + `flex-shrink: 0` | `public/css/app.css:391-412` with explanatory comment "v1.26.1 PR-A — header buttons now ≥ 44 × 44 px" |
| §8.v1.26.1 | `.btn-sm` keeps 32 px floor | `app.css:438` |
| §8.v1.27.0 | Brand = `<div class="logo">` | `public/index.html:29-32` |
| §8.v1.27.0 | Single nav-item `<a href="#/dashboard">` | `public/index.html:35` |
| §8.v1.27.0 | 8 CHANGELOGs at v1.27.0 | all 8 files have `## [1.27.0] — 2026-05-14` |

## Summary

| Section | Sub-checks | PASS | FAIL | SKIP | Notes |
|---|---|---|---|---|---|
| 0. Preflight (incl. dedupe gate) | 4 | 4 | 0 | 0 | health ok, version 1.27.0, dedupe = 1 |
| 1. Smoke nav (sidebar dedupe) | 24 | 24 | 0 | 0 | brand is `<div>`, 1× Dashboard nav-item |
| 3.13 Sidebar dedupe API gate | 1 | 1 | 0 | 0 | |
| 5.3 Target Size (header `.btn`) | 1 | 1 | 0 | 0 | 0/5 small (was 5/5 on v1.26.0) |
| 6.6 CHANGELOG parity (v1.27.0) | 1 | 1 | 0 | 0 | all 8 at v1.27.0 |
| 8.v1.26.1 hot-fix | 4 | 4 | 0 | 0 | min-height + flex-shrink + line-height + canary tests |
| 8.v1.27.0 sidebar dedupe | 5 | 5 | 0 | 0 | all 5 sub-items in §8 confirmed |
| **Total** | **40** | **40** | **0** | **0** | full PASS on this run |

## Closed since v1.26.0 (now in §11 "Closed" table)

| ID | Closed | Verification |
|---|---|---|
| WCAG-2.5.5-btn-height | v1.26.1 | live `smallBtnCount: 0` on /#/dashboard with cache-bust |
| Sidebar dup `#/dashboard` × 2 | v1.27.0 | `grep -c` = 1; brand = `<div>` |
| G-003 README.cn.md naming | v1.27.0 (this cycle) | 8 files at canonical `<base>.<locale>.md` |

## Remaining open (per spec §11)

| ID | Severity | Title | Target |
|---|---|---|---|
| G-005 | Minor (docs / cross-repo) | Report blocks A-G vs canonical A-F | future release (coordinated parent commit) |

## Verdict

**v1.27.0 ships clean.** All gates from §0 through §8.v1.27.0 pass. Only one item left in known-deferred (§11) — G-005 — and it explicitly requires a parent-project commit, not a web-ui fix.

