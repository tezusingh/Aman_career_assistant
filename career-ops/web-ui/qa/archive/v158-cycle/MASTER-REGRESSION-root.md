# MASTER REGRESSION — career-ops-ui · WHOLE PROJECT (perennial)

> **The single umbrella prompt.** Paste verbatim to a QA agent (or
> run it yourself) to validate **the entire product, all
> functionality, all 8 locales** on any release. It orchestrates the
> four specialist perennial prompts and adds a consolidated
> end-to-end "everything" sweep + the full regression-class ledger so
> nothing already fixed silently comes back and nothing already
> triaged gets re-filed.
>
> Version-agnostic: read `package.json::version` first → that is the
> **version under test (`vX`)** everywhere below. Record the run in
> `qa/v158-regression/<YYYY-MM-DD>-MASTER-REGRESSION.md`.
>
> **Doctrine (non-negotiable).** Any check that needs a code change →
> ONE one-fix ship: bump + CHANGELOG ×8 (parity-gated) + a test +
> Playwright-verify + pre-commit AI-review to LGTM + CI-watch to
> green. **Never batch. Never `--no-verify`. HIGH → MEDIUM → LOW.**
> Pre-commit AI review is **advisory**; **`ci.yml` is the hard gate**.

---

## §0 — Run order (do not skip; each gates the next)

1. **`qa/REGRESSION-FINAL.md`** — §0 hard gate + §1–§11 + the
   exhaustive **§A matrix** (every page × every control × 8 locales ×
   every endpoint × invariants). *Proves nothing regressed.*
2. **`qa/FUNCTIONALITY-CHECK.md`** — incl. **§F-A** exhaustive
   functional matrix. *Proves it actually works, correctly & legibly.*
3. **`qa/UX-AUDIT-PROMPT.md`** — incl. **§UX-A** 8-locale UX matrix.
   *Judges whether it works well for the user the docs describe.*
4. **`qa/DESIGNER-EXPORT-PROMPT.md`** — design-system export +
   key-flow craft + state grid. *Captures reality + grades craft.*
5. **This file §1–§6** — the consolidated all-functionality sweep +
   regression-class ledger + sign-off.

A MASTER pass = all four green/triaged **and** §1–§6 below satisfied.

---

## §1 — Pre-flight (HARD GATE)

```bash
vX=$(node -p "require('./package.json').version")
npm ci && npm test                 # MUST: N/N pass (vX baseline; ≥905 @ v1.58.9)
npm run test:e2e                   # MUST: passed: N · failed: 0   (20)
npm run test:e2e:full              # MUST: 23/23 steps · 0 failed
npm run test:e2e:browser           # MUST: ≥61/61 @ v1.58.9 (smoke+full-cycle+forms)
node scripts/check-no-also-leftovers.mjs   # MUST: ✓
career-ops-ui doctor               # MUST: exit 0
```

Parity (all MUST agree at `vX`): `package.json` == `package-lock.json`
== `/api/health.version` == every `CHANGELOG*.md` top entry == README
×8 `release-vX` badge == README ×8 `tests-N` badge == CLAUDE.md
"currently vX" == `.claude/PROJECT-CONTEXT.md` repo-state + test
baseline. `git status` clean · HEAD tagged `vX` on `origin/main` ·
**CI + Release + AI-Review + Publish all `success` for `vX`** (a
`cancelled` CI is benign concurrency only if a newer commit's CI is
green; a `failure` is a stop-ship).

---

## §2 — Every surface (exhaustive inventory — sweep ALL, ALL 8 locales)

Locales: **en · es · pt-BR · ko · ja · ru · zh-CN · zh-TW**. Switch
via the sidebar picker; confirm choice persists (localStorage
`career-ops-ui:lang`), `<html lang>` updates, `document.title`
localizes per route.

**Routes (canonical):** `#/dashboard #/scan #/pipeline #/evaluate
#/deep #/cv #/tracker #/reports #/activity #/config #/profile
#/health #/help #/auto #/apply #/batch`.
**Mode slugs:** `#/project #/training #/followup #/contacto
#/interview-prep #/patterns #/batch-prompt`.
**Aliases:** `#/settings`→profile · `#/portals`→config (Regional
group) · `#/outreach`→contacto. **Unknown** `#/zzz` → 404 + working
"Back to Dashboard".

Per route × locale: one `<h1.page-title>` (or the deliberate `#/cv`
breadcrumb chip — by design), descriptive subtitle present (incl.
`#/reports` empty state), sidebar item highlighted (even via a direct
alias URL), **zero console errors / pageerror**, first-paint assets
`Cache-Control: no-store`, dark theme legible.

**Every interactive element** (global: sidebar nav, language picker,
theme toggle, global search ⌘K/Ctrl K, connection banner, modal,
toast; per-page: every button / input / select / tab / chip / SSE
console / paginator): keyboard-reachable, **visible focus ring**
(WCAG 2.4.7 — see RC-A1 ledger), `aria`/label wired, Enter/Space
activates, disabled & busy states honoured, double-submit guarded,
**both success AND failure produce a visible localized message** (no
silent failure), destructive parent-writes go through the
focus-trapped `UI.confirm()` with the same verb in title & body.

**Every API endpoint** (full list in `REGRESSION-FINAL §A.3` /
`FUNCTIONALITY-CHECK §F-A`): GET = side-effect-free, never writes
parent; mutations only on explicit user action, `withFileLock` where
they edit `applications.md`/`pipeline.md`; `lang` auto-injected by
api.js tolerated everywhere; `:name`/`:slug` traversal sanitized;
URL-fetch endpoints SSRF-gated (`isValidJobUrl` + `safeGet`); unknown
→ 404 JSON; no secret in any body/log.

---

## §3 — Regression-class ledger (these MUST stay fixed — re-verify, do NOT re-file)

| ID | Class | Expected behaviour @ vX |
|----|-------|--------------------------|
| BUG-001 | `#/followup` | Optional *Last contact* — junk blocked client-side, localized ISO error, no network/credit; empty allowed; valid ISO proceeds. |
| BUG-003 | `#/help` ×8 | `**bold**`/`` `code` ``/links render **inside `>` blockquotes** (no literal `**`). |
| BUG-004 | routing | `#/outreach` → contacto; `#/contacto` still canonical. |
| BUG-005 | `#/pipeline` | Duplicate add → "Already in the queue — skipped" info toast; queue count unchanged. |
| BUG-006 | `/api/pipeline` | Humanized sentence-cased invalid-URL msg; `(POST /api/pipeline · HTTP 400)` context kept **by design**. |
| BUG-007/008 | `#/health` | Progress toast dismissed before result modal; modal title == localized button label. |
| BUG-010 | `#/reports` | Empty state has the descriptive page-subtitle. |
| BUG-002/UX-032 | Health | Test-fixture names (`Acceptance Test`, `Real Person`, `QA`, …) → "not customized"; a real name containing "test" is NOT false-flagged; parent files untouched. |
| I18N-011 | `#/help` TOC | Headings 3/4/6–12 localized to the exact sidebar `nav.*` term in all 7 non-EN locales (TOC ↔ sidebar match). |
| I18N-012/013 | RU | `deep.title` / `deep.subtitle` / `dash.quick.deepCta` translated (no "smart questions"/"Deep research" EN leak). |
| v1.57.x | `#/config` | Keys pasted with whitespace/newline save (trimmed); per-field what/where/why errors; secrets never echoed; SPA-injected `lang` does NOT 400; PORT/HOST defaults 4317/127.0.0.1; OpenRouter provider + live model dropdown (CSP-safe, fallback). |
| R-2/FIX-C1 | `#/deep` + Saved research | Brief renders clean — NO `<tool_call>`/`</tool_response>`/`<thinking>`/`<invoke>` (orphan **or** paired), incl. older saved files (cleaned on serve); real `<https://…>`/code preserved. |
| FIX-C2 | global | `<html lang>` updates on switch + boot; `navigator.language` auto-detect; localStorage persist. (Code already correct — verify, don't rewrite.) |
| AI-review §3 | errors | Client net-error localized (`api.netError`/`api.netHint`); server `details` English-by-policy (consistent w/ all server errors). |

Any of these failing = **stop-ship Critical/Major**, one-fix ship.

---

## §4 — Open / deferred (record only — do NOT treat as new findings)

Tracked in `qa/v158-regression/FIX-PROMPT-v158.md §5`, shipped one
fix per release per doctrine (HIGH→LOW), **never batched**:

- **By-design:** BUG-009 (`#/cv` single-`<h1>` breadcrumb — WCAG
  1.3.1); BUG-006 endpoint-in-toast (explicit product req).
- **Parent-owned (hard rule #1 — not this repo):** the `Acceptance
  Test` profile data + `cv.md` + stale `portals.yml` 404s;
  FIX-C1 prompt-layer (`modes/deep.md` final-form enforcement).
- **Queued one-fix ships:** M-1 focus-ring (WCAG 2.4.7), M-2
  sync-check/verify lingering toast, M-4 saved-card title↔date gap,
  M-5/M-6 Tracker/CLI-modal localized chrome, M-7 cost line vs
  `LLM_PROVIDER`, M-8 interactive Apply checklist, M-9 Dashboard
  Refresh feedback, I-1..I-6 (search aria-label, `today` rel-time,
  Help-TOC items 2/5/13/14 w/o `nav.*` counterpart, RU
  `cadence`/`follow-up`, footer ⌘K platform hint), U-1..U-15
  (CV H1, emoji-wrap, frozen date placeholder, CTA dedupe, ASCII
  divider, prompt-block collapse, queue-chip spacing, Tracker
  actions-at-0-rows, LEGITIMACY tooltip, Help-filter truncation,
  toast journal, H1↔subtitle spacing, CV dirty-state).
- **Cross-repo:** G-005 (A-G→A-F, blocked on parent
  `santifer/career-ops :: modes/oferta.md`).

If you observe one of the above: note it as **KNOWN**, cite the
ledger, do **not** open a new finding.

---

## §5 — Security & invariants (must hold every release)

- CSP excludes `'unsafe-inline'`/`'unsafe-eval'`,
  `frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`;
  `X-Frame-Options: DENY`; `Referrer-Policy` set.
- `isValidJobUrl` + `safeGet` reject loopback / `file:` /
  `javascript:` / script-char / DNS-rebind on every URL-fetch path
  (`/api/pipeline`, `/api/pipeline/preview`, `/api/auto-pipeline`).
- `UI.md()` escape-first is the XSS boundary; `stripDangerousMarkdown`
  is the CV ingress; `cleanLlmMarkdown` is a declutter step, **NOT** a
  sanitizer.
- Parent career-ops files written **only** on explicit user
  POST/PUT/DELETE — never from a read path, never at rest. `.env`
  never committed; secrets never logged/echoed.
- 8-locale i18n parity (`tests/i18n-coverage.test.mjs`) + a11y form
  wires (`tests/a11y-form-wires.test.mjs`) green.
- `PATHS` resolves once per process — path-coupled helpers guarded
  statically (not cache-bust dynamic import).

Spot-check (must all reject 400, security envelope intact):
`+ Add` → `javascript:alert(1)`, `https://example.com/<script>`,
`http://localhost/x`, `not-a-url`; `#/evaluate` → `<script>` (< 50).

---

## §6 — Exit criteria & sign-off

| Gate | Pass criterion | ☐ |
|------|----------------|---|
| §1 pre-flight | all commands green; full parity at `vX` | ☐ |
| `qa/REGRESSION-FINAL.md` (incl. §A) | every MUST satisfied, 8 locales | ☐ |
| `qa/FUNCTIONALITY-CHECK.md` (incl. §F-A) | every item PASS (PARTIAL triaged, 0 FAIL) | ☐ |
| `qa/UX-AUDIT-PROMPT.md` (incl. §UX-A) | no Blocker/High; findings filed per doctrine | ☐ |
| `qa/DESIGNER-EXPORT-PROMPT.md` | export produced; no Blocker | ☐ |
| §2 every surface × 8 locales | clean (no console err, localized, focusable) | ☐ |
| §3 regression-class ledger | every row re-verified PASS | ☐ |
| §4 open/deferred | only KNOWN items; none re-filed | ☐ |
| §5 security & invariants | unchanged / all reject | ☐ |
| Pipelines | CI + Release + AI-Review + Publish `success` @ `vX`; tag on `origin/main`; `git status` clean | ☐ |

**MASTER PASS** ⇔ every box ticked. Any new finding → a single
one-fix ship (bump + CHANGELOG ×8 + test + Playwright-verify +
AI-review LGTM + CI-watch), HIGH→MEDIUM→LOW, each fully shipped
before the next. Record the dated run file under
`qa/v158-regression/`.

---

*Umbrella over REGRESSION-FINAL · FUNCTIONALITY-CHECK ·
UX-AUDIT-PROMPT · DESIGNER-EXPORT-PROMPT. Version-agnostic; always
validates the current `HEAD`.*
