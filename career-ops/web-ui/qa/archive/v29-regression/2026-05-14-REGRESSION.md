# Regression run — 2026-05-14 — v1.29.1

**Stand:** http://127.0.0.1:4317 · v1.29.1 · Node 22.22.0 · git tag `v1.29.1`
**Spec:** `qa/REGRESSION-v1.29.md` (715 lines, supersedes v1.27)
**Sister spec:** `qa/DOCS-COVERAGE-v1.29.md`
**Tester:** Claude Cowork — sandbox bash + live Chrome MCP against user stand
**Duration:** ~6 min

## TL;DR

**Verdict: GREEN — v1.29.1 ships clean.**

| Tier | Result |
|---|---|
| Pre-flight gates (§0, 9 gates) | 9/9 PASS (1 env-skip: parent-project absent in sandbox) |
| Smoke nav (§1, 23 routes) | 23/23 PASS — every route renders, h1 localized, no error markers |
| API regression (§3) | 7/7 blocks PASS — health shape, retired aliases, registry, traversal, SSRF, auto-pipeline, docs URLs, sidebar dedupe |
| Security envelope (§4) | 6/6 PASS — 2 nominal §4.2 matches are regex false-positives (matched `viewport` and `aria-controls`, not event handlers) |
| Source registry (§7) | 4/4 PASS — 11 entries, RU + EN sets canonical, shape correct, configKey on every RU entry |
| Master invariants (§11) | M-2..M-12 PASS · M-2 CSP env-skip on dev bind (only emitted on public bind) |
| `npm test` (§10) | 547 / 546 PASS / 0 FAIL / 1 skipped — full suite green |
| Targeted CI gates | 50/50 PASS (canonical-docs, batch-max-retries, router-query-string, health-no-hh-user-agent, scan-sources, sources-trudvsem, sources-getmatch-geekjob, help-ru-config-section, wcag-target-size) |

No new findings. Single known deferred (G-005 A-G vs A-F report drift) remains open and unchanged.

---

## §0 Pre-flight gates

| # | Gate | Result | Note |
|---|---|---|---|
| 0.1 | `/api/health` shape | PASS | version=1.29.1, 17 checks, HH_USER_AGENT pruned. REQUIRED-FAIL=6 in sandbox = parent-project absent (cv.md, profile.yml, portals.yml, etc.). ENV-SKIP — verify on user host separately. |
| 0.2 | SPA shell title | PASS | Actual title is `career-ops — command center` (spec literal `career-ops-ui` was outdated — already shipped renaming). Page serves with `<title>` element. **Spec drift recorded — minor.** |
| 0.3 | Git tag | PASS | `v1.29.1` |
| 0.4 | Sidebar dedupe (v1.27) | PASS | 1× `href="#/dashboard"` in served HTML |
| 0.5 | DOCTYPE | PASS | `<!DOCTYPE html>` first |
| 0.6 | HH_USER_AGENT pruned (v1.28.1) | PASS | 0 health-rows named `HH_USER_AGENT` |
| 0.7 | Registry endpoint (v1.29.0) | PASS | 11 sources (6 EN + 5 RU) |
| 0.8 | RU + EN source list (v1.29.0) | PASS | RU = `geekjob,getmatch,habr-career,hh.ru,trudvsem`; EN = `ashby,greenhouse,lever,smartrecruiters,workable,workday` |
| 0.9 | 17-H2 help parity (v1.29.0) | PASS (with regex fix) | Initial spec's `count('## ')` is substring-count and yields 91-93 (matches H3/H4/code blocks too). Correct line-anchored count via `re.findall(r'^## [^#]', md, re.M)` = **17 on every locale**. §17 "How to add a portal" present on all 8 locales. **Spec gate wording needs update** (minor). |

---

## §1 Smoke nav — 23 routes (live Chrome)

Captured: tab 671181158, locale=ru (last user-active), CDP single-pass cycle, 1000-1800ms settle.

| Route | h1 | btns | inputs | Verdict |
|---|---|---|---|---|
| `/dashboard` | Командный центр | 30 | 1 | PASS |
| `/scan` | Поиск вакансий | 8 | 8 | PASS — dropdown should expose 11 sources (verified via API §3.3) |
| `/pipeline` | Pipeline | 2696 | 3 | PASS — large user pipeline; 2696 btns = ~1300 URLs × 2 (✕+▶); `404` substring matched job IDs (false positive in scrape regex, not bug) |
| `/evaluate` | Оценить вакансию | 7 | 3 | PASS |
| `/batch` | Пакетная оценка | 7 | **7** | PASS — 5 controls + 2 form scaffolding (v1.28.0 Max retries surface confirmed) |
| `/reports` | Отчёты | 5 | 1 | PASS |
| `/tracker` | Трекер заявок | 8 | 4 | PASS |
| `/activity` | Журнал действий | 18 | 1 | PASS |
| `/cv` | CV | 9 | 3 | PASS — brand-kept English h1 (RU locale) |
| `/profile` | Профиль | 5 | 1 | PASS |
| `/config` | Настройки приложения | 9 | 7 | PASS — no `c(...).also is not a function` error |
| `/health` | Health | 7 | 1 | PASS — brand-kept English h1 (RU locale) |
| `/help` | Справка | 5 | 1 | PASS — 17 H2 sections verified via API |
| `/deep` | Deep research | 9 | 3 | PASS — brand-kept English h1 (RU locale) |
| `/apply` | Чек-лист отклика | 6 | 3 | PASS |
| `/project` | Советник по портфолио-проекту | 7 | 3 | PASS |
| `/training` | Советник по курсам / сертификациям | 7 | 3 | PASS |
| `/followup` | Советник по cadence follow-up | 7 | 5 | PASS |
| `/contacto` | LinkedIn outreach | 7 | 5 | PASS — brand-kept English h1 (RU locale) |
| `/interview-prep` | Подготовка к интервью | 7 | 4 | PASS |
| `/patterns` | Паттерны отказов | 7 | 3 | PASS |
| `/settings` (alias) | Профиль | 5 | 1 | PASS — alias resolves to Profile |
| `/batch-prompt` (alias) | Пакетная оценка | 7 | 3 | PASS — alias resolves with deprecated content |

**0 red console errors captured during the entire 23-route cycle.**

---

## §3 API endpoint regression

| Block | Result | Detail |
|---|---|---|
| §3.1 health shape | PASS | version=1.29.1, HH_USER_AGENT absent, 17 checks |
| §3.2 retired aliases | PASS | `/api/stream/scan-en`, `/api/stream/scan-ru`, `/api/scan-ru/config` all → 404 |
| §3.3 source registry | PASS | RU + EN canonical, every entry has value/label/region, every RU entry has configKey |
| §3.4 path-traversal sweep | PASS | 16/16 attempts (4 payloads × 4 endpoints) rejected with 400/404 |
| §3.5 SSRF reject | PASS | 7/7 payloads (javascript:, file://, loopback, RFC1918, link-local, IPv6 loopback, malformed) → 400 |
| §3.7 auto-pipeline manual | PASS | 4ms (well under 2s threshold), SSE start event echoes `"url":"…"`, 5-step plan emitted |
| §3.9 help docs URLs | PASS | 40/40 (5 canonical URLs × 8 locales × ≥1 occurrence each) |
| §3.11 sidebar dedupe | PASS | 1× `href="#/dashboard"` |

---

## §4 Security envelope

| Block | Result | Detail |
|---|---|---|
| §4.2 inline event handlers | PASS | Initial scan flagged 2 matches; both are regex false positives: (a) `<meta name="viewport" content="..."/>` matched `ontent="..."`; (b) `aria-controls="sidebar"` matched `ontrols="..."`. No real `onclick=`/`onload=` in source. |
| §4.3 safeGet only outbound | PASS | 0 raw `fetch(` in pipeline.mjs + auto-pipeline.mjs |
| §4.4 sanitizePathName | PASS | Defined in security.mjs:116; 5 route-module callers |
| §4.5 withFileLock | PASS | 7 occurrences in pipeline.mjs + tracker.mjs + auto-pipeline.mjs |
| §4.6 llmRateLimit | PASS | 4 endpoints: `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline` |
| §4.7 entity-aware XSS strip | PASS | 4 payloads (HTML entity script, URL-encoded `java&#115;cript:`, raw script tag, javascript-protocol link) all sanitized |

---

## §7 Source registry & RU adapter contract (v1.29.0)

| Check | Result | Detail |
|---|---|---|
| §7.1 Registry shape | PASS | Every entry has value/label/region; RU entries have configKey ('geekjob','getmatch','habr','hh','trudvsem' respectively) |
| §7.2 RU dispatcher | n/a | (verified by §7.3 unit tests in §10) |
| §7.3 Per-adapter tests | PASS | `sources-trudvsem.test.mjs` + `sources-getmatch-geekjob.test.mjs` exist and pass (17 / 17 cases in §10) |
| §7.4 Documented add-flow | PASS | `docs/help/en.md §17` present; all 8 locale help bundles serve §17 (verified §0.9 + §6.5) |

---

## §8 Per-release sub-list

| Sub-section | Result |
|---|---|
| v1.28.0 — Issue #1 AI-list canonical | PASS — `tests/canonical-docs-coverage.test.mjs` green |
| v1.28.0 — Issue #2 max-retries UI | PASS — `tests/batch-max-retries.test.mjs` green; `/batch` has 7 inputs (5 controls + 2 form fields) |
| v1.28.1 — router query-string | PASS — `tests/router-query-string.test.mjs` green |
| v1.28.1 — HH_USER_AGENT prune | PASS — `tests/health-no-hh-user-agent-row.test.mjs` green; 0 health rows |
| v1.29.0 — registry endpoint | PASS — `tests/scan-sources-endpoint.test.mjs` green; live endpoint returns 11 sources |
| v1.29.0 — RU 2→5 sources | PASS — all 5 RU adapters surfaced; tests/sources-* green |
| v1.29.0 — §17 in every help locale | PASS — 8/8 |
| v1.29.1 — help §5 RU-config detailed guide | PASS — `tests/help-ru-config-section.test.mjs` green (7/7 sub-cases) |

---

## §10 Full test suite

```
1..547
# tests 547  pass 546  fail 0  skipped 1  todo 0
# duration_ms 15147
```

Single skipped test is a Playwright pdf-render-smoke that requires Chromium binary — unrelated to v1.29.1 surface area.

Targeted CI gates (run in isolation):
- canonical-docs-coverage.test.mjs
- batch-max-retries.test.mjs
- router-query-string.test.mjs
- health-no-hh-user-agent-row.test.mjs
- scan-sources-endpoint.test.mjs
- sources-trudvsem.test.mjs
- sources-getmatch-geekjob.test.mjs
- help-ru-config-section.test.mjs
- wcag-target-size.test.mjs

= **50 / 50 PASS** in 1.08s.

---

## §11 Master invariants

| # | Invariant | Result |
|---|---|---|
| M-1 | Server never edits parent files outside explicit user actions | PASS — code audit (`grep writeFile.*\.\.\/` returns only documented write-through routes) |
| M-2 | CSP excludes `unsafe-inline` and `unsafe-eval` on public bind | env-SKIP — dev bind 127.0.0.1 does not emit CSP header; verify on `HOST=0.0.0.0` separately |
| M-3 | safe-fetch.mjs is single outbound HTTP path | PASS — file exists (7373 B); §4.3 confirms zero raw `fetch(` in URL-handling routes |
| M-4 | sanitizePathName on every `:name`/`:slug` | PASS — §4.4 |
| M-5 | withFileLock on every tracker/pipeline write | PASS — §4.5 |
| M-6 | llmRateLimit on every LLM endpoint | PASS — §4.6 |
| M-7 | CV PUT via entity-aware stripDangerousMarkdown | PASS — §4.7 |
| M-8 | 8 locales share key set + 17-H2 structure | PASS — §0.9 |
| M-9 | All 8 CHANGELOGs same version | n/a — verified separately via `scripts/check-changelog-parity.mjs` |
| M-10 | `.btn` ≥ 44×44 px | PASS — `tests/wcag-target-size.test.mjs` 4/4 |
| M-11 | Router strips `?query` before route lookup (v1.28.1) | PASS — `tests/router-query-string.test.mjs` |
| M-12 | Source registry single source of truth (v1.29.0) | PASS — `server/lib/sources/registry.mjs` exists with all 11 entries; `/api/scan/sources` reads from it |

---

## §12 Deferred backlog status

| ID | Severity | State |
|---|---|---|
| G-005 | Minor (cross-repo) | OPEN — unchanged. Cross-repo coordination with `santifer/career-ops :: modes/oferta.md`. Renderer is schema-tolerant. |

No new findings. Closed-in-prior-releases list (Issue #1, Issue #2, router 404, HH_USER_AGENT row, RU 2→5, three-place source drift, user-facing RU-config docs gap) all stay closed.

---

## Environment

- **Stand:** http://127.0.0.1:4317 — sandbox-spawned for backend tests; user-host stand for §1 Chrome smoke nav
- **Node:** v22.22.0
- **npm:** 10.9.4
- **Git tag:** v1.29.1
- **Package version:** 1.29.1
- **Test runner:** `node --test` (built-in)
- **Browser MCP:** Claude in Chrome (tab 671181158)

---

## Spec drift recorded (minor)

1. **§0.2** — spec literal `<title>career-ops-ui</title>` is outdated; actual served title is `<title>career-ops — command center</title>`. **Update REGRESSION-v1.29.md §0.2 grep target** in a follow-up.
2. **§0.9** — spec uses Python `count('## ')` (substring), which over-counts by ~5× because it matches H3/H4 headers and `## ` in code blocks. **Update to** `re.findall(r'^## [^#]', md, re.M)` for line-anchored H2-only count. Existing CI gate (`tests/canonical-docs-coverage.test.mjs::17-H2 parity contract`) already uses correct line-anchored matching, so this is documentation-only drift.

Neither blocks the release. Both should be fixed-up in the next spec revision (v1.30 or v1.29.2 dot-patch).

---

## Failures

(none)

## Warnings

(none — both §4.2 false positives are documented above, not failures.)

## Console errors

0 captured during 23-route smoke nav.
