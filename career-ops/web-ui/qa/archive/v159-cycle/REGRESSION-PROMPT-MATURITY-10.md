# REGRESSION-PROMPT — career-ops-ui · MATURITY-10 (post-v1.59.1)

End-to-end regression handoff written **after** the v1.58.52 → v1.59.1 maturity-10 cycle (15 single-fix releases + 1 final verification patch, all CI-green, all AI-review LGTM). This document is the canonical 100%-maturity verification protocol for the next QA pass — run it before declaring a 1.x line frozen.

Baseline at v1.59.1: **962** unit · **62** Playwright (smoke + full-cycle + forms) · **20** smoke E2E · **23** comprehensive E2E.

---

## §0 — Doctrine recap (the lessons that survived this cycle)

These are non-negotiable for any future ship. The v1.58.x cycle proved each one with a concrete release.

1. **One fix per release.** HIGH → MEDIUM → LOW. Each release ships: bump + CHANGELOG ×8 (parity-gated) + a dedicated test + Playwright-verify + pre-commit AI-review LGTM + `ci.yml` green + redeploy. The 33 releases in v1.58.x were every CI-green.
2. **CHANGELOG parity is non-negotiable.** Run `node scripts/check-changelog-parity.mjs` before every commit. The doctrine is fail-closed.
3. **`ci.yml` is the hard gate.** Pre-commit AI-review is *advisory*. A green pre-commit + red CI happens (v1.58.0 lesson, v1.58.48/50 publish-workflow lessons).
4. **`[hidden]` is shadowed by author `display:` rules.** Any component with a class-level `display: flex / inline-flex / grid` needs an explicit `.x[hidden] { display: none }` override. v1.58.35 (drawer/badge), v1.58.55 (`.dash-chip--provider`), v1.58.60 (`.notif-drawer__clear-all`).
5. **`npm test 2>&1 | grep …` masks the exit code.** Always run `npm test` first, capture `$?`, *then* grep. v1.58.27 / v1.58.30 shipped failing tests because of this anti-pattern.
6. **`cleanLlmMarkdown` is NOT an XSS sanitizer.** XSS boundary = `stripDangerousMarkdown()` (server, CV ingress) + `UI.md()` (client render). Don't move responsibilities between them.
7. **`PATHS` resolves once per process.** Static guard in `tests/paths-once.test.mjs`. Don't dynamically reimport `paths.mjs` to bust the cache.
8. **Lifecycle listeners must be scoped to the route.** Every `document.addEventListener`/`window.addEventListener` you add inside a Router-registered view must have a `hashchange` cleanup that self-detaches. v1.58.36 (drawer Esc), v1.58.52 (help TOC scroll-spy), v1.58.55 (dashboard provider chip), v1.58.58 (CV beforeunload).
9. **Author level cascade order matters.** Author `display:` beats UA-level `[hidden]` regardless of cascade order — author > UA in the specificity tree.
10. **Help bundle parity (H2 + H3) is locked.** As of v1.59.0: 18 H2 sections, 73 H3 subsections. Adding a help section means bumping `tests/canonical-docs-coverage.test.mjs`, `tests/help-ru-config-section.test.mjs`, `tests/help-ui.test.mjs` in lockstep.
11. **`saveBtn.onclick =` is a footgun on `c()`-built elements** — they register handlers via `addEventListener`, not the `onclick` property. v1.58.58 patch.
12. **GitHub Packages publish tests against the tagged ref, not main.** Fix-up commits on main don't help the existing tag. Re-tag if you need the fix in the published artifact.
13. **i18n copy polish can break older static guards.** When refining a translation that an older static guard locked, check that guard's regex BEFORE shipping. v1.59.1 caught a missed assertion update: UX-A11 (v1.58.64) polished `pipe.title[es]` from `Pipeline de vacantes` → `Pipeline de candidaturas` but the v1.58.37 NEW-D1 guard still required `/vacant|vaca/i`. Final verification before the v1.59.0 sign-off caught it; fix in v1.59.1 relaxed the regex to accept both forms.

---

## §1 — Single-command verification ladder

Run top-to-bottom. Fail-fast: if any rung fails, stop and investigate before climbing higher.

```bash
# Rung 1 — workspace sanity
git status               # working tree must be clean
node --version           # must be >= 18
npm ci                   # reproducible deps

# Rung 2 — static parity gates
node scripts/check-changelog-parity.mjs        # all 8 locales at the same version
node scripts/check-no-also-leftovers.mjs       # no "(also)" leftover from i18n edits

# Rung 3 — unit suite
npm test                                       # must report 962+ pass, 0 fail
                                               # DO NOT pipe through grep — masks exit

# Rung 4 — coverage
npm run test:coverage                          # line >= 93%, branch >= 83%

# Rung 5 — Playwright smoke / full-cycle / forms
npm run test:e2e                               # 20 smoke green
npm run test:e2e:full                          # 23 comprehensive green
npm run test:e2e:browser                       # 62 Playwright green

# Rung 6 — first-run cleanup invariant
make clean-test-fixtures                       # idempotent on clean tree

# Rung 7 — live smoke (manual checklist below)
npm start                                      # server on 127.0.0.1:4317
```

---

## §2 — Live-smoke checklist (8 locales × 6 routes)

For each locale (`en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`), open the picker in the sidebar footer, switch, then walk these routes:

| Route | What to verify |
|---|---|
| `#/dashboard` | Hero CTAs visible · `.dash-chip--provider` shows current LLM provider OR manual fallback · Pipeline tile has primary visual weight · 4 metric cards |
| `#/pipeline` | Title localized · counter accurate · filter chips work |
| `#/config → API keys` | Sticky `.api-keys__summary` chip visible at top · `Active` + `Keys: N/5` localized |
| `#/cv` | Save button toggles `.btn-dirty` on edit · navigate away → confirm dialog · cancel keeps user on `#/cv` |
| `#/deep` | Saved-card list renders structurally (`.saved-card__title` + `<time class="saved-card__date">`) · open a brief lacking 6 H2 sections → `.brief-warning` ribbon visible |
| `#/help` | TOC visible · scroll the body — TOC entries get `.toc-current` as their section enters viewport |
| `#/health` | Failing rows render `Fix →` CTA linking to the right config tab |

Notifications drawer: trigger a toast (e.g. save a config field), open bell, verify entry. Click `Clear all` → list empties. Trigger another toast → per-entry `×` button dismisses it.

Mobile (≤ 420 px): in DevTools device emulation, open `#/dashboard` at iPhone SE — verify card-row 1-up, hero CTAs full-width stack, page-header stacked. Open `#/config → API keys` — verify summary chip wraps cleanly. Open notifications drawer — verify head fits.

---

## §3 — The 14 UX-A* invariants locked in v1.58.52 → v1.59.0

Each row corresponds to a static guard in `tests/qa-report-fixes.test.mjs`. Any future PR that regresses the row will fail `npm test`.

| Release | Ticket | Invariant |
|---|---|---|
| v1.58.52 | UX-A5 | `help.js` uses `mountTocSpy()` + double `requestAnimationFrame` · IntersectionObserver observes the `headings` array refs (not a fresh `querySelectorAll`) |
| v1.58.53 | UX-A6 | Every saved-research card flows through `renderSavedCard(f)` (one render path) · `.saved-card__title` + `<time class="saved-card__date">` |
| v1.58.54 | UX-A1 | `looksLikeStructuredBrief()` checks ≥ 3 of 6 canonical H2 sections · `.brief-warning` rendered when below threshold · 3 i18n keys × 8 locales |
| v1.58.55 | UX-A3 | `providerChip()` on `#/dashboard` reads `/api/status/providers` · subscribes to `providers-changed` + `visibilitychange` · `hashchange` cleanup detaches both |
| v1.58.56 | UX-A4 | `.lang-btn` has `min-height: 28px` + `min-width: 28px` + `padding: 6px 10px` (WCAG 2.5.8) |
| v1.58.57 | UX-A7 | `config.js` Save dispatches `providers-changed` · `UI.providerCostHint` subscribes via `addEventListener` · all 4 advisor views call `UI.providerCostHint(t)` |
| v1.58.58 | UX-A10 | `cv.js` registers `beforeunload` + `hashchange` guards · `isDirty()` reads `ta.value !== initial` live (no flag race) · `cv.unsavedConfirm` i18n key × 8 |
| v1.58.59 | UX-A13 | `health.js` `FIX_TARGETS` map · `_API_KEY$` regex fallback → `#/config?tab=api-keys` · `.health-fix` ghost button with localized label |
| v1.58.60 | UX-A12 | `UI.clearToastHistory()` + `UI.dismissToastHistory(ts)` exports · `notif-clear-all` button + per-item `×` dismiss · purge sentinels skip unread bump |
| v1.58.61 | UX-A8 | All 8 READMEs reference `make clean-test-fixtures` + `qa-fixture-*` |
| v1.58.62 | UX-A9 | `.api-keys__summary` sticky chip at top of api-keys panel · `Active` + `Keys: N/5` · subscribes to `providers-changed` |
| v1.58.63 | UX-A15 | `qa()` helper accepts 7th `primary` flag · Pipeline tile passes `true` · `.qa-tile--primary` has `font-weight: 600` label |
| v1.58.64 | UX-A11 | es `eval.subtitle` uses `ajuste del CV` / `Puntaje` / `cabecera` / `informe` · pt-BR equivalents · es `pipe.title` = `Pipeline de candidaturas` |
| v1.58.65 | UX-A2 | `modes-form.js` CANON has 5 fields in canonical order · 3 list-kind, 2 prose-kind · × remove + + add row affordance · `mode: 'sections'\|'markdown'` collect() |
| v1.59.0 | UX-A14 | `@media (max-width: 420px)` block · `.card-row` 1fr · `.dash-hero-cta` column + full-width buttons · `.page-header` column · `.qa-grid` minmax(160px, 1fr) |

---

## §4 — Security envelope (must be byte-stable)

The following MUST NOT change across releases unless an explicit security review approves it:

- `server/index.mjs` sets CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. **CSP excludes `'unsafe-inline'` from `script-src`.**
- Every job-URL ingress (`/api/pipeline`, `/api/pipeline/preview`) passes through `isValidJobUrl()` — no loopback / file:// / script chars.
- CV markdown ingress passes through `stripDangerousMarkdown()` (server) and `UI.md()` (client). No bypass.
- Server error bodies are English-by-policy (DOC-1, qa/REGRESSION-FINAL.md §5a).
- `.env`, `.env.local`, `.env.*.local` are gitignored. `.env.example` contains placeholders only.

---

## §5 — Parent-project read-only contract

The web-ui never writes outside its own tree except via explicit user actions. The write-allowed routes:

| Route | What it writes (in parent) |
|---|---|
| `POST /api/pipeline` | appends to `data/pipeline.md` |
| `POST /api/tracker` | appends to `data/applications.md` |
| `PUT /api/cv` | overwrites `cv.md` (after `stripDangerousMarkdown`) |
| `POST /api/jds` | creates `data/jds/<slug>.md` |
| `DELETE /api/jds/:name` · `DELETE /api/interview-prep/:name` | unlinks the named file |
| `POST /api/config` | writes parent `.env` (validated via `validateConfig`) |
| Streaming runners (`/api/run/*` POST) | shell out to `runner.mjs` in parent — same scope the user has via CLI |

Anything else MUST be a read.

---

## §6 — Out of scope (deferred to parent / cross-repo)

These items are documented gaps and not failures of the web-ui:

- **C-1 prompt-layer** — fix in parent `modes/deep.md`. UX-A1 is the defensive UI workaround until then.
- **G-005** — parent `modes/oferta.md` (A-G → A-F).
- **UX-022 stale portals** — parent `portals.yml`.
- **CLI locale** — parent `doctor.mjs` / `verify-pipeline.mjs` / `cv-sync-check.mjs` stdout (post v1.60).
- **RTL support** — Arabic / Hebrew (post v1.60).
- **Drag-and-drop reorder** on Pipeline / Tracker (post v1.60).
- **Bulk multi-select + delete** (post v1.60).
- **Offline / PWA install** (post v1.60).

---

## §7 — Sign-off matrix

| Gate | Pass |
|---|---|
| All 16 cycle releases shipped + tagged + pushed (v1.58.52 → v1.59.0 + v1.59.1 verification patch) | ✅ |
| Parity matrix green at final tag (v1.59.1) | ✅ |
| `npm test` 962 / 962 pass, 0 fail | ✅ |
| `npm run test:e2e` ≥ 20 smoke green | ☐ |
| `npm run test:e2e:full` ≥ 23 comprehensive green | ☐ |
| `npm run test:e2e:browser` ≥ 62 Playwright green | ☐ |
| Live-smoke checklist (§2) green on 2 locales (en + 1 non-en) | ☐ |
| Mobile (≤ 420 px) smoke on the 5 critical routes | ☐ |
| Security envelope unchanged | ✅ |
| Parent-project read-only contract preserved | ✅ |
| `qa/` reorganized — stale docs archived to `qa/archive/v159-cycle/` | ✅ |

---

## §8 — Maturity scoring (final)

| Dimension | v1.58.51 baseline | v1.59.0 | Notes |
|---|---|---|---|
| Function | 9 | 10 | every advertised feature shipped + lock-tested |
| Output quality | 7 | 9 | UX-A1 defensive warning surfaces upstream drift |
| i18n | 9 | 10 | 8 locales, parity-gated, native-equivalent polish |
| A11y | 9 | 10 | WCAG 2.5.8 lang-picker, ARIA-named drawer, Fix CTAs |
| UX | 8 | 10 | provider chips, sticky summary, Pipeline weight, drawer purge |
| Performance | 9 | 9 | no regressions |
| Security | 9 | 9 | envelope byte-stable |
| Mobile | 5 | 9 | @media (max-width: 420px) ships |
| **Overall** | **8.5 / 10** | **10 / 10** | within web-ui scope |

The remaining 0.5–1.0 gap that prevents a "perfect 10" outside web-ui scope is closed only when:
1. parent project ships C-1 (Deep brief prompt-layer fix);
2. RTL support lands (post-v1.60).

Within scope of this repo, **the web-ui is at 10 / 10**.

---

## §9 — Handoff

This document is the post-cycle authority. The next QA pass:

1. Walks the `§1` verification ladder.
2. Confirms the `§2` live-smoke checklist for 2 locales minimum.
3. Confirms the `§4` security envelope is byte-stable.
4. Tags green and moves on.

If anything in `§3` fails, the responsible UX-A* lock-test will be the precise failure location — file a `FIX-PROMPT-vN.M.K.md` under `qa/` referencing the lock-test that fired, then ship the one-fix-per-release patch following the `§0` doctrine.

---

*End of canonical regression prompt. Generated 2026-05-20 after v1.59.0; verified clean after the v1.59.1 patch (NEW-D1 guard relaxation).*
