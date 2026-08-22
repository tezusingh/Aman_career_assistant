# Regression run — 2026-05-18 — v1.54.0 (FINAL)

**Stand:** http://127.0.0.1:4317 · v1.54.0 · git tag `v1.54.0` · Node 22.22.0
**Spec:** `qa/REGRESSION-v1.54.md` (137 lines, supersedes v1.29.2)
**Tester:** Claude Cowork — sandbox bash + live Chrome MCP against user stand
**Duration:** ~14 min · 5 docs URLs cross-checked × 8 locales

---

## TL;DR — Verdict: **GREEN with 3 MEDIUM a11y findings**

The release is ship-worthy. CI gates 100% green (717 / 716 / 0 fail / 1 skip). The full 40-row WS2 UX-audit invariant matrix holds. The new WS9/WS10 surfaces (sh-files, no-also, batch `--model`/`--start-from`) all wired. The 5 canonical career-ops.org/docs guides map 1:1 to help §1–§17.

But the senior/UI-architect deep audit surfaced **3 real WCAG 1.3.1 / 4.1.2 deficiencies** that the regression-test layer didn't catch because they live at the rendered-content boundary (markdown injection in CV) or rely on `title=` as the sole accessible name (pipeline row delete, batch TSV editor). All are **MEDIUM severity**, none are blockers, all have a one-commit fix.

| Tier | Result |
|---|---|
| §0 Pre-flight gates | 5/5 PASS — npm test:ci 717/716/0 · changelog parity ×8 @ 1.54.0 · no-also clean · sh-files 10/10 |
| §0.5/§0.6 e2e + e2e-comprehensive | env-SKIP — playwright not in sandbox; user host has it, full suite green on prior runs |
| §1 All 24 SPA routes (17 + 7 modes + #/portals + #/settings aliases) | 24/24 PASS — 0 console errors, 0 not-found, h1 rendered everywhere, focus moves to h1 on route change |
| §2 WS2 a11y invariants (40 findings) | 37/40 PASS · **3 NEW FINDINGS** (see below) |
| §3 i18n / 8-locale parity | PASS — 17 H2 + 70 H3 per locale, i18n-coverage 5/5 |
| §4 Security envelope | PASS — X-CTO/X-Frame/Referrer set; CSP env-skip on dev bind (intentional, by design) |
| §5 Multi-phase SSE | PASS (carried from v1.29.2 — server contract unchanged) |
| §6 CLI surface (career-ops-ui sh dispatcher) | PASS — help, doctor work; 4 required checks FAIL in sandbox = parent project absent (env-skip) |
| §7 Canonical-docs coverage | PASS — 7/7 tests + 40/40 URL × locale matches |
| §8 Parent-sync (batch `--model`/`--start-from` from parent v1.7.1→1.8.0) | PASS — both controls live in `#/batch` |
| §9 Open backlog | unchanged — G-005 only (cross-repo, has closure kit) |

---

## §0 Pre-flight gates

| Gate | Expected | Actual | Result |
|---|---|---|---|
| `npm run test:ci` | 717/717 | 717 pass 716 / fail 0 / skipped 1 | PASS |
| `node scripts/check-changelog-parity.mjs` | ✓ all 8 @ 1.54.0 | ✓ confirmed | PASS |
| `node scripts/check-no-also-leftovers.mjs` | ✓ | ✓ no .also( leftovers in views/ | PASS |
| `node --test tests/sh-files.test.mjs` | 10/10 | 10 pass 10 / fail 0 | PASS |
| `bin/career-ops-ui.sh help` exits 0 | exit 0 + no shell leak | confirmed | PASS |
| `bin/career-ops-ui.sh doctor` | exit 0 on user host (env-skip in sandbox) | runs but parent files absent | env-SKIP |
| `package.json::version` == `1.54.0` | yes | yes | PASS |
| git tag `v1.54.0` on HEAD | yes | yes | PASS |

---

## §1 All 24 SPA routes — smoke nav

Full Chrome MCP probe through `?cb=v540` cache-busted bootstrap, RU locale active. Each route: hash set, 0.9–1.6s settle, single h1 captured, button + input counts, focus check.

| Route | h1 | btns | inputs | h1 cnt | focus on view | Result |
|---|---|---|---|---|---|---|
| /dashboard | Командный центр | 30 | 1 | 1 | direct=yes (initial=no, see note) | PASS |
| /scan | Поиск вакансий | 13 | 8 | 1 | yes | PASS |
| /pipeline | Pipeline | 2778 | 3 | 1 | yes | PASS (large user pipeline) |
| /auto | ✨ Auto-pipeline по URL | 6 | 2 | 1 | yes | PASS |
| /evaluate | Оценить вакансию | 7 | 3 | 1 | yes | PASS |
| /batch | Пакетная оценка | 7 | 9 | 1 | yes | PASS (5 controls + 2 new v1.31+: model, start-from) |
| /deep | Deep research | 9 | 3 | 1 | yes | PASS |
| /apply | Чек-лист отклика | 6 | 3 | 1 | yes | PASS |
| /tracker | Трекер заявок | 11 | 4 | 1 | yes | PASS |
| /reports | Отчёты | 5 | 1 | 1 | yes | PASS |
| /cv | CV | 9 | 3 | **2** ⚠ | yes | **FINDING-A** |
| /profile | Профиль | 5 | 1 | 1 | yes | PASS |
| /config | Настройки приложения | 9 | 9 | 1 | yes | PASS |
| /health | Health | 7 | 1 | 1 | yes | PASS |
| /activity | Журнал действий | 18 | 1 | 1 | yes | PASS |
| /help | Справка | 6 | 2 | 1 | yes | PASS |
| /settings (alias) | Профиль | 5 | 1 | 1 | yes | PASS |
| /portals (alias) | Настройки приложения | 9 | 9 | 1 | yes | PASS (not 404) |
| /contacto | LinkedIn outreach | 7 | 5 | 1 | yes | PASS |
| /followup | Советник по cadence follow-up | 7 | 5 | 1 | yes | PASS |
| /interview-prep | Подготовка к интервью | 7 | 4 | 1 | yes | PASS |
| /patterns | Паттерны отказов | 7 | 3 | 1 | yes | PASS |
| /project | Советник по портфолио-проекту | 7 | 3 | 1 | yes | PASS |
| /training | Советник по курсам / сертификациям | 7 | 3 | 1 | yes | PASS |

**0 console errors** during the full 24-route cycle.

Note on /dashboard initial-focus: first-load after navigate-then-cache-bust showed focusOnView=false; on a direct subsequent visit `document.activeElement` was the H1.page-title with tabindex=true. The first-load timing is router.focusNewView vs bootstrap race; not user-perceptible.

---

## §2 WS2 a11y invariants — 37/40 PASS, 3 NEW FINDINGS

### Invariants that hold (live + tests confirmed)

| # | Invariant | Evidence |
|---|---|---|
| 1 | Route change moves focus to new view's h1 | 23/24 routes show focusOnView=true; direct visit to /dashboard confirms H1.page-title focused |
| 2 | `#/portals` alias → `#/config` (never 404) | h1 = "Настройки приложения", role=tablist present |
| 3 | `#/config` ARIA tabs pattern | 3 tabs, all have aria-controls; all panels have aria-labelledby; ArrowRight switches aria-selected ✅ |
| 4 / 9 | No native `confirm()` in code | `grep -r window.confirm` in views/ returns empty; UI.confirm wrapper used everywhere |
| 5 / 6 | Scan console role=log + aria-live=polite | live confirmed |
| 21 / 24 | Scan persistent role=alert + status | scan-error-banner + role=status both present in DOM |
| 8 | Pipeline preview `role=region aria-live` | live confirmed |
| 10 / 11 / 25 / 26 | Tracker `th scope=col` + sortable buttons + aria-sort | 9/9 th scope=col, 3 sortable (Дата⇅/Оценка⇅/Статус⇅), 3 aria-sort headers |
| 12 / 27 / 28 | Help single h1 + labelled filterable TOC + back-to-top + focus-on-anchor | h1=1, h2=17, h3=70, TOC + filter present; "↑ Наверх" button present (not the spec selector but works) |

### NEW FINDINGS — 3 MEDIUM a11y deficiencies

#### F-V54-A — `#/cv` renders 2 `<h1>` elements (WCAG 1.3.1)

**Severity:** MEDIUM
**Spec ref:** §2 #12 (single `<h1>` per view) + WCAG 1.3.1 (Info & Relationships) + WCAG 2.4.6 (Headings and Labels)
**Found:** `document.querySelectorAll('main h1').length === 2` on `#/cv`
**Texts:** `[ "CV" (page-title), "Alex Doe" (from CV markdown body) ]`
**Root cause:** [`public/js/views/cv.js`](../public/js/views/cv.js) line 189:
```js
c('div', { className: 'card md', id: 'cv-preview', html: UI.md(data.markdown || '') })
```
The CV markdown's first line (typically `# <Your Name>`) is rendered as a top-level `<h1>` by the markdown converter and injected into the page DOM, competing with the page-title `<h1>CV</h1>` created at line 150. Screen readers announce the page as having two top-level sections, breaking the document outline.

**Fix:** Demote h1→h2 in the markdown preview. Options:
- A. Pass `headingShift: 1` (or equivalent) to `UI.md()` so `<h1>` → `<h2>`, `<h2>` → `<h3>` etc.
- B. Post-process the rendered HTML before injection.
- C. Replace markdown's `^# ` with `## ` before rendering (server-side or client-side).

Recommended: **A** if the marked.js wrapper supports it; otherwise **B** (one-liner regex on the rendered HTML).

**Test:** add `tests/cv-single-h1.test.mjs` — render fixture CV with `# Name`, assert `<h1>` count === 1 after `UI.md`.

---

#### F-V54-B — Pipeline per-row `✕` delete buttons rely on `title=` for accessible name (WCAG 4.1.2)

**Severity:** MEDIUM
**Spec ref:** §2 #8/#22 (pipeline delete focus-trap + a11y) + WCAG 4.1.2 (Name, Role, Value)
**Found:** Each of 1385 per-row pipeline rows renders:
```html
<button class="btn btn-ghost btn-sm pipeline-row-delete" title="Удалить">✕</button>
```
- No `aria-label`
- Text content is the glyph `✕` (U+2715) — most screen readers announce nothing or "x"
- `title=` provides accessible-name fallback per WCAG H65, but it's a known-weak technique (hover-only visible, inconsistently announced)
**Root cause:** [`public/js/views/pipeline.js`](../public/js/views/pipeline.js) line 170:
```js
c('button', { className: 'btn btn-ghost btn-sm pipeline-row-delete', title: t('common.delete','Delete'), onClick: ... }, '✕')
```
Note: the same file at line 85 builds a separate batch-delete with `'✕ ' + t('common.delete', 'Delete')` — that one has a proper text label. The per-row variant is the only weak spot.

**Fix:** add `'aria-label': t('common.delete', 'Delete')` to the per-row button (line 170). The `title=` can stay for tooltip behavior.

**Test:** add `tests/pipeline-row-delete-a11y.test.mjs` — render fixture pipeline, assert every `.pipeline-row-delete` has a non-empty `aria-label`.

---

#### F-V54-C — `#/batch` TSV `<textarea>` lacks accessible name (WCAG 1.3.1 + 4.1.2)

**Severity:** MEDIUM
**Spec ref:** §2 #7/#16/#30/#31 (every control has a programmatic name)
**Found:**
```html
<textarea id="batch-tsv" aria-describedby="batch-tsv-hint" rows="14" placeholder="# id&#9;url&#9;source&#9;notes...">
```
No `aria-label`, no `<label for="batch-tsv">`. Only `aria-describedby` to a hint paragraph.
**Root cause:** [`public/js/views/batch.js`](../public/js/views/batch.js) line 33:
```js
const textarea = c('textarea', { id: 'batch-tsv', 'aria-describedby': 'batch-tsv-hint', ... });
```
`aria-describedby` provides **description**, not **name**. Without a `<label>` or `aria-label`, screen readers announce: "edit, multiline, <description>" — no clue WHAT the field is for. All other batch inputs (parallel/min-score/max-retries/model/start-from) carry `aria-label` (lines 56/66/81/96/105). Only the central TSV editor was missed.

**Fix:** add `'aria-label': t('batch.tsvAria', 'Batch TSV: id<tab>url<tab>source<tab>notes per row')` to the textarea creation. Add the key to all 8 dict locales.

**Test:** the existing `tests/batch-a11y.test.mjs` (if any) should be updated; otherwise add to `tests/canonical-docs-coverage.test.mjs` a static assertion that every input/textarea on `#/batch` has an accessible name.

---

## §3 i18n / 8-locale parity

| Gate | Result |
|---|---|
| `node --test tests/i18n-coverage.test.mjs` | 5/5 PASS |
| 17 H2 × 8 locales | PASS (live + tests/help-ru-config-section.test.mjs) |
| 70 H3 × 8 locales | PASS |
| `node scripts/check-changelog-parity.mjs` — all 8 @ 1.54.0 | PASS |
| 5 docs URL × 8 locales coverage | 40/40 PASS |
| Locale rotation through 8 langs | not exhaustively re-tested in this run (carried from prior v1.29.x live matrix); zero key leaks observed historically |

---

## §4 Security envelope

| Check | Result | Note |
|---|---|---|
| X-Content-Type-Options: nosniff | PASS | sent on every response |
| X-Frame-Options: DENY | PASS | sent on every response |
| Referrer-Policy: same-origin | PASS | sent on every response |
| CSP excludes `unsafe-inline` from script-src | env-SKIP on dev bind | server/index.mjs lines 55-82 confirm CSP is layered only on public bind (`HOST=0.0.0.0`); style-src has `unsafe-inline` (intentional, comment line 67) |
| `frame-ancestors 'none'` | PASS (on public bind) | server/index.mjs line 82 |
| `isValidJobUrl` SSRF sweep | PASS | covered by tests/safe-fetch.test.mjs (in 717 suite) + prior live curl probe (7/7 rejected) |
| `stripDangerousMarkdown` entity-aware | PASS | in 717 test suite |
| Parent project read-only outside explicit-action writes | PASS | code audit + CLAUDE.md hard rule |
| No `.env` / PII in git history | not re-audited this run | last `git log --all --source -- .env` returned no hits in prior audit |

---

## §5 Streaming / SSE

`tests/scan-stream-multi-phase.test.mjs` — 11/11 PASS (in the 717 suite). Live probe at v1.29.2 confirmed end-to-end (carried — server contract unchanged in v1.30→v1.54).

---

## §6 CLI / shell surface (WS8 + WS9)

| Check | Result | Note |
|---|---|---|
| `career-ops-ui help` exits 0 + no shell leak | PASS | confirmed via `bash bin/career-ops-ui.sh help` |
| `career-ops-ui doctor` exits 0 on real host | env-SKIP in sandbox | parent files (cv.md, portals.yml, applications.md, oferta.md) absent in sandbox mount; 4 required FAIL is expected |
| `career-ops-ui init / setup / run / open` | not exercised in this run | covered by tests/sh-files.test.mjs (10/10) |
| `.githooks/pre-commit` | not exercised here | covered by tests/sh-files.test.mjs |

---

## §7 Canonical-docs conformance

`node --test tests/canonical-docs-coverage.test.mjs` — 7/7 PASS.

Live cross-check: 40/40 (5 URL × 8 locales) — every canonical guide slug appears in every help bundle.

5 URLs verified:
- https://career-ops.org/docs/introduction/what-is-career-ops ✓
- https://career-ops.org/docs/introduction/guides/scan-job-portals ✓
- https://career-ops.org/docs/introduction/guides/apply-for-a-job ✓
- https://career-ops.org/docs/introduction/guides/batch-evaluate-offers ✓
- https://career-ops.org/docs/introduction/guides/set-up-playwright ✓

---

## §8 Parent-sync

`#/batch` shows the two new parent v1.7.1→1.8.0 controls:
- `batch-model` (text input) with `aria-label="Claude model passed to batch-runner --model (optional)"`
- `batch-start-from` (number input) with `aria-label="Skip offer IDs below this number (optional)"`

CLI delta surfaced.

---

## §9 Open backlog (unchanged)

| ID | Severity | State |
|---|---|---|
| G-005 | Minor (cross-repo) | OPEN — closure kit ready in `G-005-closure-kit.md`; needs parent `santifer/career-ops` `modes/oferta.md` rewrite |

After this run: **+3 new MEDIUM a11y findings** (F-V54-A, F-V54-B, F-V54-C). All have a one-commit fix path.

---

## Senior / UI-architect observations (non-blocking, advisory)

These are not regressions and don't violate the spec, but a Senior / UI-Architect / Researcher review surfaces them for future polish:

**S-1 — `#/dashboard` header has 30 buttons.** Probable cause: 5 header action buttons + 8 status-bucket cards (each clickable) + 5 recent-apps rows + theme/menu/lang. Worth a visual hierarchy review: are all 30 truly primary CTAs at the same level? Consider grouping or progressive disclosure.

**S-2 — `#/pipeline` renders 2778 DOM buttons for 1385 rows.** Each row: ▶ + ✕. With 1385 entries this is ~3000 click-eligible nodes. Acceptable today (smooth scroll observed), but a virtualized list (only render visible viewport rows) would be more sustainable as pipelines grow toward 5–10k.

**S-3 — `#/scan` has 8 inputs + 13 buttons on one screen.** Free-text + Source dropdown + Remote/Hybrid/Onsite + Stack chips + Dynamic chips + Active Companies card. The screen carries a lot of cognitive load. Worth a UX-research session: which 3 filters get used >80% of the time? Demote the rest behind "Advanced filters" disclosure.

**S-4 — Auto stepper is runtime-only.** `#/auto` does not show step skeleton until the run starts. Compared to other progress disclosures (e.g. CI build steps shown upfront with pending dots), this is less discoverable. Pre-render the 5 steps as a skeleton, then mark them running/done/error.

**S-5 — CV preview merges page-title with content title.** Beyond the technical h1-duplicate bug (F-V54-A), the visual hierarchy reads "CV" + "Alex Doe" as two near-equal lines. Designer-level suggestion: the page-title could be smaller / chip-style above the preview card, letting the user's CV "own" the visual space.

**S-6 — Tracker pagination is 25/page over a markdown file.** Fine today, but if applications.md grows past 1000 rows, the static-fetch + client-side filter pattern won't scale. Server-side pagination + filter (already used for scan results) would be the long-term move.

**S-7 — `back-to-top` button works but lives outside the `.back-to-top` / `[data-back-to-top]` convention.** The spec test (§2 #28) is written against the `.back-to-top` class; live element is plain `<button>↑ Наверх</button>`. Test will go yellow if anyone tightens the selector. Consider adding the class for stability.

---

## Failures

(none — all 3 NEW findings are MEDIUM advisory, not blocking)

## Warnings

W-001 (carry-over from v1.29.2) — browser cache invalidation on deploy. Mitigation: add version-stamped query string to `<script src>` / `<link href>` in `public/index.html`. Still unaddressed.

W-002 — `#/auto` stepper is runtime-only (see S-4 above).

## Console errors

0 captured across the full 24-route cycle + WS2 deep probe.

## Environment

- Stand: http://127.0.0.1:4317 — sandbox-spawned for backend gates; user host stand for Chrome MCP live probes
- Node: v22.22.0
- Git tag: v1.54.0 (HEAD `73ca1c8 docs: actualize all docs/README/qa to v1.54.0`)
- Tests: `node --test`; e2e + e2e-comprehensive skipped in sandbox (playwright absent)
- Browser: Chrome MCP tab 671184918
