# REGRESSION & CONFORMANCE — career-ops-ui v1.54.9 (post-cycle)

> The single authoritative end-to-end QA progress prompt for the
> **v1.54.1 → v1.54.9 hardening cycle**. Supersedes
> `REGRESSION-v1.54.md` — it carries forward every P-31 invariant
> (WS0–WS11) and adds the nine ships landed after the v1.54.0 final:
> the 3 MEDIUM regression findings, the two user-requested config
> features, the Modes canonical-schema field-form, deploy-hygiene,
> and the LLM-key routing fix.
>
> **How to run:** walk §0 → §11 in order. §0 gates everything. Each
> check names the exact route/command and the pass condition. Record
> findings in `qa/v54-regression/<YYYY-MM-DD>-REGRESSION.md`. A check
> that needs a code change → open it as a one-fix ship (bump +
> CHANGELOG ×8 + test + Playwright-verify + pre-commit AI-review to
> LGTM, CI-watch to green), never batch.

---

## §0 — Pre-flight (gates everything below)

```bash
npm ci && npm run test:ci          # MUST: 747/747 · ✓ no .also( · ✓ CHANGELOG parity all 8 @ 1.54.9
node tests/e2e.mjs                 # MUST: passed: N  failed: 0
node tests/e2e-comprehensive.mjs   # MUST: N/N steps passed · 0 failed
npm run test:e2e:browser           # MUST: 32/32 (no post-teardown "Error: aborted")
node --test tests/sh-files.test.mjs        # MUST: green (bin/*.sh + hook)
node scripts/check-changelog-parity.mjs    # MUST: all 8 locales at v1.54.9
node scripts/check-no-also-leftovers.mjs   # MUST: ✓
career-ops-ui doctor               # MUST: exit 0, all required green
```

- `package.json::version` == `1.54.9` == footer `/api/health.version`.
- `git status` clean; HEAD tags `v1.54.1`…`v1.54.9` on `origin/main`; CI green on the latest.
- `.claude/settings.json` is gitignored (untracked).
- README ×8 badges read `release-v1.54.9` / `tests-747%20passed`;
  `docs/architecture/TESTING.md` totals == `v1.54.9 / 747 / 97 files`.

## §1 — Routes (all 17 SPA screens render, 0 console errors)

Unchanged from REGRESSION-v1.54.md §1 — re-run it verbatim. Every
route: single `<h1.page-title>`, no console error, no unhandled
rejection. `#/portals` → `#/config` alias (never 404).

## §2 — WS2 UX-audit a11y invariants (40 findings, regression-locked)

Re-run REGRESSION-v1.54.md §2 verbatim — every row still has its
dedicated `tests/*.test.mjs` static guarantee. No invariant from the
P-31 audit may regress.

## §3 — F-V54-A · `#/cv` single `<h1>` (v1.54.1)

- `#/cv`: exactly **one** `<h1>` (the page title `CV`). A CV body
  `# Name` renders as `<h2>` (heading-shift via `cvMd()`); h6 →
  `role="heading" aria-level="7"`. Every preview-injection point
  (initial, file-import, live editor) uses `cvMd`, never raw `UI.md`.
- Test: `tests/cv-single-h1.test.mjs` (4). Live: `#/cv` page-h1 == 1.

## §4 — USER-REQ-1 · OpenAI/Codex model selector (v1.54.2)

- `#/config` → API-keys tab: an `OPENAI_MODEL` `<select>`
  (`gpt-5-codex` default; 6 options) sits after `OPENAI_API_KEY`,
  mirroring the Anthropic/Gemini model fields.
- `env-config.mjs`: `OPENAI_MODEL` ∈ `KNOWN_KEYS` (after
  `OPENAI_API_KEY`) and `KEY_GROUPS.core`, **NOT** in `SECRET_KEYS`
  (model id ≠ credential — never masked).
- Test: `tests/openai-model-selector.test.mjs` (4). i18n
  `config.openaiModel(+Hint)` × 8.

## §5 — USER-REQ-2 · Modes canonical-schema field-form (v1.54.3 + v1.54.8)

- `#/config` → Modes tab renders the **5 canonical fields in
  documented order** — Target Roles / Adaptive Framing / Comp Targets
  (repeatable labelled line-inputs), Exit Narrative / Location Policy
  (labelled prose textareas) — **even on an empty / stub / non-schema
  `modes/_profile.md`** (no more "no sections — use raw editor").
- Each field shows a description sourced from career-ops.org Quick
  Start §Step-5, wired via `aria-describedby`.
- Heading-variant tolerant: `## Your Target Roles` ≡ `## Target Roles`.
- Save is tagged: existing-schema → non-destructive `{ sections }`
  merge (preamble + untouched + custom sections byte-stable);
  missing-schema → confirm-gated `{ markdown }` full rebuild
  (preamble preserved, custom sections verbatim). Non-canonical and
  non-list-shaped sections fall back to a labelled verbatim textarea.
- Raw full-file editor remains the confirm-gated **Advanced**
  disclosure (WS2 #4 destructive-save gate intact).
- Test: `tests/modes-form.test.mjs` (7). Live (isolated
  `CAREER_OPS_ROOT` stub fixture): stub → 5 fields + descriptions →
  fill → confirm → all 5 canonical sections persisted; 0 console
  errors. i18n: 5 `config.modesDesc*` + `config.modesFormRebuildBody`
  + the v1.54.3 label/control keys × 8.

## §6 — F-V54-B · `#/pipeline` row-action accessible names (v1.54.4)

- Every per-row `▶` (evaluate) and `✕` (delete) button has an
  `aria-label` disambiguated by a compact URL via `shortUrl()`
  (`host` + `…/` + last 2 path segments; trailing-slice fallback).
  No two rows announce identically.
- Test: `tests/pipeline-row-action-names.test.mjs` (4). Live: each
  row's name unique (e.g. "Delete: hh.ru/…/vacancy/12345").

## §7 — F-V54-C · `#/batch` TSV accessible name (v1.54.5)

- The `#/batch` TSV `<textarea>` has an `aria-label` via
  `batch.tsvAria` (not just the `aria-describedby` hint) — a
  description is not a name.
- Test: `tests/batch-tsv-accessible-name.test.mjs` (2). i18n
  `batch.tsvAria` × 8.

## §8 — S-7 + W-001 · selector hygiene & deploy cache (v1.54.6 / v1.54.7)

- **S-7:** `#/help` back-to-top button class list includes the
  canonical `back-to-top` (alongside `help-back-top`);
  `document.querySelector('.back-to-top')` resolves it. CSS-no-op.
- **W-001:** `GET` of any `.js` / `.mjs` / `.css` / static
  `index.html` **and** the SPA catch-all shell returns
  `Cache-Control: no-store`. Non-code assets keep default caching.
  Security headers (CSP/nosniff/frame-deny/referrer) unchanged —
  `tests/security-headers.test.mjs` (8) still green.
- Tests: `tests/help-nav-a11y.test.mjs` #12 (selector assertion),
  `tests/asset-cache-control.test.mjs` (4).

## §9 — v1.54.9 · LLM key routing honours the live parent `.env`

- With `ANTHROPIC_API_KEY` only in the parent `.env` (NOT in the
  server's boot-time `process.env`) and no/invalid `GEMINI_API_KEY`:
  `#/evaluate` (run live) MUST route to **Anthropic**, not error
  *"Gemini API key not valid"*.
- `effectiveEnv(key, envFilePath)`: non-empty `process.env` wins,
  else the current parent `.env`. `hasAnthropicKey()` /
  `hasGeminiKey()` / `runAnthropic` (key + model) all resolve through
  it — detection matches the key actually sent; no restart needed
  after a `.env` / `POST /api/config` change. Keys never logged
  (REVIEW-B4 canary green).
- Tests: `tests/anthropic.test.mjs` (12, CI-isolated, +2 bug-repro),
  `tests/env-config.test.mjs` `effectiveEnv` (+3, 100% of the branch).

## §10 — CI / test-harness integrity

- `tests/playwright-smoke.mjs` auto-pipeline SSE test cancels the
  reader + aborts the fetch in `finally`; the `after` hook
  force-closes lingering sockets (`server.closeAllConnections()`).
  No post-teardown "Error: aborted" on the Playwright e2e job.
- All 4 CI jobs green on the latest `origin/main` commit
  (Unit+integration node 18/20/22 + Playwright e2e).

## §11 — Docs / context conformance (top-down vs career-ops.org)

- Help bundles ×8: §"App settings & API keys" describes the Modes
  **field-form** (not raw markdown) and the OpenAI/Codex model
  selector. 17 H2 / 70 H3 parity gate green
  (`tests/help-ru-config-section.test.mjs`).
- README ×8 badges + `docs/architecture/TESTING.md` totals at
  v1.54.9 / 747 / 97.
- `CLAUDE.md` (14 route modules, version 1.54.9) and
  `.claude/PROJECT-CONTEXT.md` (repo-state + test baseline v1.54.9 /
  747) reflect reality.
- Spot-check each in-scope screen against the matching
  career-ops.org/docs page (Quick Start, What-is, Scan, Apply,
  Batch, Playwright + the Reference nav: Modes, auto-pipeline,
  pipeline, oferta(s), contacto, deep, interview-prep, pdf, training,
  project, tracker, patterns, followup, Portals). Any divergence in
  documented behaviour → a one-fix ship.

---

### Exit criteria

§0 gates green · §1–§11 every MUST satisfied · `git status` clean ·
all `v1.54.1…v1.54.9` tags on `origin/main` with the latest CI green ·
no open MEDIUM/HIGH finding. New findings → one-fix ships
(HIGH→MEDIUM→LOW), each bump + CHANGELOG ×8 + test + Playwright-verify
+ AI-review LGTM + CI-watch.
