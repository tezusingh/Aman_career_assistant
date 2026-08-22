# FIX-PROMPT — v1.58.x (external QA-report sweep)

**Scope:** career-ops-ui v1.57.2 → v1.58.1. Driven by an external
QA report (32 findings) + an AI-review i18n blocker + the
"raw `<tool_call>` JSON in research output" user report.

This document records **what changed and why**, the **triage
decisions** (fixed vs by-design vs parent-owned vs backlog), and
links to the detailed regression plan in `REGRESSION-FINAL.md`.

---

## 1. Fixed (code bugs)

| ID | Area | Fix | File(s) |
|----|------|-----|---------|
| BUG-001 (Crit) | `#/followup` | Optional *Last contact* now validated client-side as ISO `YYYY-MM-DD`; generic `spec.pattern`/`patternMsgKey` added to the mode-page form factory; `validate()` enforces it only when the field is non-empty. | `public/js/views/mode-page.js`, i18n `followup.lastErr` ×8 |
| BUG-003 (Maj) | `#/help` (all 8 locales) | `UI.md()` blockquote replacement now runs `inline()` per line → `**bold**` / `` `code` `` / `*italic*` / `[links]` render inside `>` quotes. Safe-by-construction (content already HTML-escaped before `inline()`; same path as headings/lists). | `public/js/api.js` |
| BUG-004 (Maj) | routing | `#/outreach` → `#/contacto` alias (canonical slug stays `contacto` = parent mode filename). | `public/js/router.js` |
| BUG-005 (Maj) | `#/pipeline` | Duplicate add → `pipe.dup` info toast ("Already in the queue — skipped") using the server's existing `deduped:true`. | `public/js/views/pipeline.js`, i18n `pipe.dup` ×8 |
| BUG-006 (Maj) | `/api/pipeline` | Humanized, sentence-cased invalid-URL message. **Kept** the `(POST /api/pipeline · HTTP 400)` where/why context — that is an explicit product requirement, not a regression. | `server/lib/routes/pipeline.mjs` |
| BUG-007/008 | `#/health` doctor/verify | New `UI.dismissToast()`; progress toast cleared before the result modal; modal title reuses the localized button label (casing matches). | `public/js/api.js`, `public/js/views/health.js` |
| BUG-010 | `#/reports` | Empty-state now renders the descriptive `page-subtitle` like every other page. | `public/js/views/reports.js`, i18n `rep.subtitle` ×8 |
| BUG-002 / UX-032 | Health / prompts | `checkProfileCustomized()` allow-list expanded to flag synthetic/QA names (`Acceptance Test`, `Real Person`, `QA`, `Sample User`, `Placeholder`, `Example User`, …). Exact `^(…)$`/i anchored → a real name merely *containing* "test" is never false-flagged. **Parent `config/profile.yml` / `cv.md` are NOT touched** (hard rule #1) — only the code heuristic. | `server/lib/store.mjs` |
| I18N-012/013 | RU | `deep.title`, `deep.subtitle` ("smart questions" → "умные вопросы"), `dash.quick.deepCta` actually translated. | `public/js/lib/i18n-dict.js` |

### Feature: clean, formatted research output

`server/lib/llm-output.mjs::cleanLlmMarkdown()` strips agent/tool
scaffolding the model sometimes echoes into prose:
`<tool_call>{…}</tool_call>`, `<tool_response>`, `<tool_use>`,
`<function_call>`, `<function_results>`, `<thinking>`, and the
`[TOOL_CALL]…[/TOOL_CALL]` bracket variants; also a dangling
unterminated trailing tag (stream cut mid-call). Pure + idempotent;
collapses the blank-line craters. Applied at **every** chokepoint:

- `server/lib/anthropic.mjs` (runAnthropic return)
- `server/lib/openai.mjs` (runOpenAICompatible → OpenAI/Qwen/OpenRouter)
- `server/lib/routes/llm.mjs` Gemini-subprocess result
- `GET /api/interview-prep/:name` (so briefs **already saved** with
  leaked scaffolding render clean too)

The SPA already renders these via the XSS-safe `UI.md()`, so the net
effect is a properly formatted document on `#/deep` and Saved research.

### AI-review (rule 3 — i18n)

- Client-owned network-error sentence localized via `I18n.t()`:
  new keys `api.netError` / `api.netHint` ×8 locales. The trailing
  `(METHOD /path · HTTP NNN)` stays literal — a language-neutral
  diagnostic token (HTTP verbs/paths/status are never localized).
- **Documented decision:** server-emitted `validateConfig` `details`
  are intentionally English diagnostics — the same class as every
  other server error in the codebase (`invalid url`, HTTP statuses,
  runner stderr). The server has no UI-locale binding at message
  construction; the SPA surfaces diagnostics verbatim and localizes
  its own chrome. Comment block added at `env-config.mjs::validateConfig`.

---

## 2. Triaged — NOT changed (with rationale)

| ID | Why not changed |
|----|------|
| BUG-009 (`#/cv` H1 is a quiet breadcrumb chip) | **By design.** Single-`<h1>` WCAG 1.3.1 decision (F-V54-A / G-015 lineage). cv.md's own H1 is demoted h1→h2 so the page keeps exactly one H1. Changing the chrome H1 size risks an a11y regression for zero functional gain. |
| BUG-002 *data*, UX-022 (`Acceptance Test` profile, real `cv.md`, stale `portals.yml` 404s) | **Parent-owned.** Hard rule #1 forbids this repo editing the parent career-ops project. These are the user's/QA env's files. Code-side detection hardened instead (BUG-002/UX-032). The data cleanup + `portals.yml` pruning is the user's. |
| I18N-011 (help-bundle TOC untranslated for items 3,4,6–12) | **CLOSED v1.58.2.** Each affected `## N. <Title>` heading in es/pt-BR/ko/ja/ru/zh-CN/zh-TW localized to the exact sidebar `nav.*` term (TOC is built from these headings → now matches the sidebar). Section number + `(#/route …)` preserved; EN canonical unchanged. |
| I18N-014..019, UX-020/021/023/024/025/026/027/028/029/030/031 | Real but minor/cosmetic. Tracked backlog. Deferred to keep this change set reviewable. |

---

## 3. Realizations / engineering notes (for future maintainers)

- **`PATHS` resolves once per process.** `server/lib/paths.mjs` fixes
  the project root at module load. A test that needs a *different*
  parent root must set `CAREER_OPS_ROOT` **before** the first
  `server/*` import and cannot switch roots mid-process. `node --test`
  isolates per *file* (separate child process) — so each test file
  may pick its own root in `before()`, but multi-root within one file
  is infeasible. Path/IO-coupled helpers like `checkProfileCustomized`
  are therefore guarded **statically** (assert the source contract)
  rather than via fragile cache-bust dynamic imports. (This is what
  bit v1.58.0: a cache-bust import test passed locally, failed CI on
  all Node versions → fixed in v1.58.1 with a static guard.)
- **Pre-commit AI review is advisory; `ci.yml` is the hard gate.**
  v1.58.0 shipped with a green pre-commit but CI red (the test above).
  Always re-confirm CI/Publish conclusions after a tag push; the
  GitHub Release is created by `GITHUB_TOKEN` and does NOT trigger
  `publish-package.yml` (manual `workflow_dispatch` per the
  established pattern).
- **Do not run write-side API calls against the live server on the
  real parent.** Smoke only GET endpoints; write paths go through
  CI-isolated tests with `CAREER_OPS_ROOT=mktemp`.
- **Server diagnostics stay English by policy; the SPA localizes its
  own chrome.** Don't "fix" a server English string by adding one-off
  i18n — it'd be inconsistent with every other server error.

---

## 4. Test deltas

- New `tests/qa-report-fixes.test.mjs` (10) — static guards for
  BUG-001/003/004/005/006/010 + i18n parity + I18N-012/013 + the
  `store.mjs` allow-list (exact-anchored, no false positives).
- New `tests/llm-output.test.mjs` (5) — `cleanLlmMarkdown` strip /
  variants / dangling / idempotency / "doesn't eat real code blocks".
- Updated `tests/url-validation.test.mjs` + `tests/config-validation-detail.test.mjs`
  assertions for the new messages; `tests/e2e-comprehensive.mjs`
  is now date-aware (fills ISO-date-shaped fields validly).
- Totals: 881 → **896** unit · Playwright **58/58** · smoke **20/20**
  · comprehensive **23/23**. v1.58.1 = test-only fix over v1.58.0.

See `REGRESSION-FINAL.md` for the detailed manual + automated plan.

---

## 5. v1.58.3 — deep-regression follow-up (R-2 / C-1 / C-2)

Driven by `career-ops_deep-regression-v1.58.2.md` + `career-ops_qa-regression-v1.58.2.md`.

| ID | Verdict | Detail |
|----|---------|--------|
| **R-2 / FIX-C1 (stripper)** | **CLOSED v1.58.3** | `cleanLlmMarkdown` now removes ANY standalone scaffold token (open *or* close, balanced or not) — the orphan `</tool_response>`/`</thinking>` with no opener that survived v1.58.0/.2 — plus Anthropic tool XML (`<invoke>`/`<parameter>`/`antml:*`) and fenced ```tool_* blocks. Pure+idempotent; real `<https://…>` autolinks & code spans preserved. `tests/llm-output.test.mjs` 5→8. |
| **FIX-C1 (saver/prompt layers)** | **Partly out of scope** | The prompt-layer (`modes/deep.md` final-form enforcement) is **parent-owned** — hard rule #1 forbids this repo editing it; route a request to `santifer/career-ops` instead. The saver-layer "reject thin brief" guard is deferred (risk of false-rejecting a legit short brief); the stripper resolves the visible symptom. |
| **FIX-C2 / M-3 (`<html lang>`)** | **NOT REPRODUCIBLE — code already correct** | `public/js/lib/i18n.js` sets `document.documentElement.lang` in `setLang()` (L75) **and** at boot (L83), and `detect()` reads `navigator.language` with `localStorage` persistence. The QA "stuck on en" was a stale `career-ops-ui:lang` / pre-redeploy build artifact. Locked with a static contract guard in `qa-report-fixes.test.mjs`. |

### Queued as subsequent one-fix ships (project doctrine — NEVER batched)

HIGH→LOW, each its own bump + CHANGELOG ×8 + test + Playwright-verify
+ AI-review LGTM + CI-watch:

- **M-1** focus-ring invisible (`:focus-visible` global) — WCAG 2.4.7.
- **M-2** lingering "Running …" toast on `sync-check`/`verify` (same
  pattern as the fixed doctor; centralize `modal.show`→dismiss-progress).
- **M-4** Saved-research card title↔date glued (`gap`).
- **M-5/M-6** Tracker confirm-modal English operator word; CLI-modal
  localized header wrapper (stdout stays EN by design).
- **M-7** `Estimated cost` ignores `LLM_PROVIDER` (read active provider).
- **M-8** Apply checklist → real interactive checkboxes + persistence.
- **M-9** Dashboard `Refresh` → feedback toast with counters.
- **I-1..I-6** search aria-label, `today` rel-time, Help-TOC items
  2/5/13/14 (no `nav.*` counterpart), RU `cadence`/`follow-up`/`smart
  questions`, footer ⌘K platform hint.
- **U-1..U-15** CV H1, emoji-wrap H1, frozen date placeholder,
  endpoint-in-toast `<details>`, dashboard CTA dedupe, ASCII divider,
  prompt-block collapse, queue-chip spacing, disable Tracker actions
  at 0 rows, LEGITIMACY tooltip, Help filter truncation, toast
  journal, H1↔subtitle spacing, CV dirty-state.
- Housekeeping: a `clean-test-fixtures` target for the leaked
  `data/pipeline.md` / `reports/software-engineer-general.md` test
  artifacts (parent-owned data — user action, not a code path).
