# REGRESSION & CONFORMANCE — career-ops-ui v1.54.0 (FINAL)

> The single authoritative end-to-end QA progress prompt. Supersedes
> `REGRESSION-v1.29.2.md` + `DOCS-COVERAGE-v1.29.md` — it fuses the
> bottom-up (regressions in working code) and top-down (drift vs the 5
> canonical career-ops.org/docs guides) perspectives into one runnable
> script that validates the whole project after the P-31 program
> (WS0–WS10, v1.31→v1.54: parent-sync, field-form config, the 40-finding
> senior UX audit, the test-pyramid, canonical re-validation).
>
> **How to run:** walk §0→§10 in order. §0 gates everything. Every check
> names the exact route/command and the pass condition. Record findings
> in `qa/v54-regression/<YYYY-MM-DD>-REGRESSION.md`. A check that needs a
> code change → open it as a one-fix ship (bump + CHANGELOG ×8 + test +
> Playwright-verify + pre-commit AI-review to LGTM), never batch.

---

## §0 — Pre-flight (gates everything below)

```bash
npm ci && npm run test:ci          # MUST: 717/717 · ✓ no .also( · ✓ CHANGELOG parity all 8 @ 1.54.0
node tests/e2e.mjs                 # MUST: passed: N  failed: 0
node tests/e2e-comprehensive.mjs   # MUST: N/N steps passed · 0 failed
node --test tests/sh-files.test.mjs        # MUST: 10/10 (bin/*.sh + hook)
node scripts/check-changelog-parity.mjs    # MUST: all 8 locales at v1.54.0
node scripts/check-no-also-leftovers.mjs   # MUST: ✓
career-ops-ui doctor               # MUST: exit 0, all required green
```

- `package.json::version` == `1.54.0` == footer `/api/health.version`.
- `git status` clean; HEAD tag `v1.54.0` on `origin/main`; CI green.
- `.claude/settings.json` is gitignored (untracked) — no allowlist churn in git.

## §1 — Routes (all 17 SPA screens render, 0 console errors)

For each: navigate, assert `#content` has a single `<h1.page-title>`,
no console errors, no unhandled rejection. Routes:
`#/dashboard #/scan #/pipeline #/auto #/evaluate #/batch #/deep
#/apply #/tracker #/reports #/cv #/profile(+#/settings alias) #/config
#/health #/activity #/help` + the 7 `#/<mode>` pages + `#/portals`
(alias → `#/config`, must NOT 404).

## §2 — WS2 UX-audit a11y invariants (the 40 findings, regression-locked)

| # | Screen | Invariant |
|---|---|---|
| 1 | all | route change moves focus to the new view's `h1` (`router.focusNewView`) |
| 2 | #/portals | resolves to config (alias) — never the 404 view |
| 3 | #/config | `role=tablist`/`tab`/`tabpanel`, `aria-selected` synced, ←/→/Home/End nav |
| 4 / 9 | #/config raw, #/tracker fix | destructive write → focus-trapped `UI.confirm` (Cancel-default, Esc/backdrop/× = false); **no native `confirm()`** anywhere |
| 5 / 6 / 21 / 24 | #/scan | console `role=log aria-live=polite` + assertive status; Stop closes EventSource; `aria-busy` on run; persistent `role=alert` + Retry |
| 7 / 16 / 30 / 31 | scan/cv/deep/apply | every control has a programmatic name (`label[for]`↔`id` or `aria-labelledby`) |
| 8 / 22 | #/pipeline | per-row/preview delete via `UI.confirm`; preview `role=region aria-live`; fetch-fail = distinct `role=alert` |
| 10 / 11 / 25 / 26 | #/tracker | `th scope=col`; Date/Score/Status sortable buttons + `aria-sort`; localized destructive labels; first-run empty state ≠ no-match |
| 12 / 27 / 28 | #/help | single `<h1>`; labelled+filterable TOC; focus-on-anchor; back-to-top |
| 13 / 14 / 18 / 19 / 20 | #/auto, #/evaluate | run-button busy state; actionable+toasted HTTP fail; async Clipboard w/ real-failure toast; eval `role=status`; eval spinner-wrapped |
| 33–40 | dashboard/profile/health/reports/activity/batch/mode | LOW polish (icon consistency, labelled chips, i18n toasts, list semantics, keyboard cards, 500-cap notice, localized placeholders, relabel announce) |

Each row has a dedicated `tests/*.test.mjs` (static guarantee) + was
Playwright-verified at ship. Re-run the test, then spot-check live.

## §3 — i18n / 8-locale parity

- `node --test tests/i18n-coverage.test.mjs` — every `t()` key resolves in all 8 locales.
- All 8 help bundles: **17 H2 / 70 H3** (`tests/help-ru-config-section.test.mjs` H2+H3 gates).
- All 8 CHANGELOG locales at `1.54.0` (parity gate).
- Rotate the lang switcher through all 8 (`en es pt-BR ko ja ru zh-CN zh-TW`): titles localize, persists across reload, no key leaks.

## §4 — Security envelope (must NOT regress)

- CSP excludes `'unsafe-inline'`/`'unsafe-eval'`; `frame-ancestors 'none'`; X-CTO/X-Frame/Referrer set (`server/index.mjs`).
- `isValidJobUrl` SSRF sweep (loopback/RFC1918/IMDS/CGNAT/IPv6-ULA/`file://`) on `/api/pipeline` + `/api/pipeline/preview`.
- `stripDangerousMarkdown` entity-aware XSS sweep on `PUT /api/cv`.
- Parent project is read-only except the documented explicit-action writes.
- No secret/`.env`/PII in git history (verified clean); `.env.example` placeholders only.

## §5 — Streaming / SSE

- `🌐 Scan` (`source=both`) emits ATS `done(final:false)` then RU terminal `done` — RU phase not dropped (`tests/scan-stream-multi-phase.test.mjs`).
- Stop button aborts an in-flight scan EventSource; poll cancelled on hashchange.
- `#/auto` SSE stepper: per-step events, manual-mode fallback with no key, HTTP-fail surfaced + toasted. **Stepper is pre-rendered as `<ol class="auto-stepper">` on mount with 5 pending steps (`validate / fetch / evaluate / save_report / append_tracker`).** State transitions via `stepState[]` array on `event` arrival.

## §6 — CLI / shell surface (WS8 + WS9)

- `career-ops-ui setup|init|doctor|run|open|help` — `help` exits 0 + no shell-source leak; unknown verb exits 2.
- `init` writes parent `.env` via the validated `env-config` path; key entry echo-suppressed (raw-mode); `--provider/--*-key/--yes` non-interactive.
- `LLM_PROVIDER` (auto|claude|gemini) honored by evaluate/deep/mode/auto.
- `setup`/`run` autostart raises the browser tab; `NO_OPEN=1` disables.
- `.githooks/pre-commit` runs the deterministic floor + fail-soft AI layer; never `--no-verify`.

## §7 — Canonical-docs conformance (top-down)

`node --test tests/canonical-docs-coverage.test.mjs` (7/7) maps every
claim in the 5 guides to its SPA surface:

- [what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops) — model-agnostic, 0–5 rubric, local-only.
- [Quick Start](https://career-ops.org/docs) — clone + `npm install` + `npx playwright install chromium`; `npm run doctor`; `config/profile.yml` from `.example.yml`; `cv.md`; `modes/_profile.md` from `.template.md`; AI assistants: Claude Code / Codex / OpenCode / Qwen CLI; auto-pipeline workflow (reads JD → reads CV → scores 0.0–5.0 → writes report → generates PDF → tracker row).
- [scan-job-portals](https://career-ops.org/docs/introduction/guides/scan-job-portals) — ATS + RU sources, `portals.yml` with 3 sections (`title_filter`/`tracked_companies`/`search_queries`); `npm run scan [--dry-run] [--company X]`; `/career-ops scan` browser path; output: companies-scanned/total-jobs/filtered-by-title/duplicates/new-offers + `data/pipeline.md` + `data/scan-history.tsv`.
- [apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job) — score thresholds (≥4.5 apply, 4.0–4.4 apply/contacto, 3.5–3.9 deep, <3.5 skip), apply checklist with never-auto-submit warning.
- [batch-evaluate-offers](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers) — `#/batch` flags incl. `--model`/`--start-from` + parallel/min-score/dry-run/retry/max-retries.
- [set-up-playwright](https://career-ops.org/docs/introduction/guides/set-up-playwright) — Generate-PDF / liveness streams.

Help §1–§17 mirror these 1:1; the coverage test fails if a guide claim
has no SPA surface.

### §7-a — Cross-checked docs↔SPA mapping (verified 2026-05-18)

| Docs claim | SPA / code surface | Verified |
|---|---|---|
| `npm run scan` + `--dry-run` + `--company X` | `/api/stream/scan?source=ats\|regional\|both[&dryRun=1][&company=Acme]` + `scan.js` `companySelect` dropdown + `dryRunCheckbox` | PASS (server/lib/routes/scan.mjs L79, public/js/views/scan.js L127/L235) |
| Auto-pipeline 5 stages (read JD → read CV → score → report → PDF → tracker) | `views/auto.js::STEPS` = `[validate, fetch, evaluate, save_report, append_tracker]` pre-rendered as `<ol class="auto-stepper">` on mount | PASS |
| Score thresholds with action mapping | `views/reports.js` score-thresholds card + i18n keys `rep.thr45/thr40/thr35/thrLow` | PASS |
| Report blocks A-F: A=summary, B=CV-match, C=strategy, D=comp, E=personalization, F=interview STAR | `prompts.mjs` + parent `modes/oferta.md` (renderer is schema-tolerant — also accepts legacy A-G) | PASS (G-005 cross-repo drift documented) |
| AI assistants: Claude Code / Codex / OpenCode / Qwen CLI | help §intro + `README*.md` × 8 locales | PASS |
| `portals.yml` 3 sections (`title_filter`/`tracked_companies`/`search_queries`) | server reads via `js-yaml`; help §5 documents structure × 8 locales | PASS |
| `npm run doctor` | `bin/career-ops-ui.sh doctor` + `/api/health` checks | PASS |
| Per-batch table after scan: `Companies scanned`, `Total jobs found`, `Filtered by title`, `Duplicates`, `New offers added` | `en-scanner.mjs` + `ru-scanner.mjs` emit `counts: { raw, removedTitle, removedNeg, dup, fresh, skipped }` | PASS (semantic equivalent — slightly different keys; help §5 explains mapping) |

## §8 — Parent-sync

`git -C .. log` delta classified in
`.planning/.../PARENT-PARITY.md`: every parent v1.7.1→1.8.0 user-facing
change is surfaced (batch `--model`/`--start-from`), CLI-only by design,
or docs-only. No open GAP.

## §9 — Open backlog

| ID | Severity | Title | Target |
|---|---|---|---|
| G-005 | Minor (cross-repo) | `oferta.md` report blocks A-G vs canonical A-F | coordinated parent commit |

**Single open item, unchanged since v1.27.** Ready-to-apply plan:
**[`G-005-closure-kit.md`](./G-005-closure-kit.md)** — Step 1 a parent
`santifer/career-ops` `modes/oferta.md` A-F rewrite, Step 2 a one-line
web-ui `prompts.mjs` follow-up (help §9 ×8 already canonical A-F since
v1.15.0), Step 3 a lock test. Renderer is schema-tolerant (graceful
degrade), so this is nomenclature drift, not a functional break.
Everything else from the v1.10 baseline (31 prior findings) + the 40
WS2 UX-audit findings is shipped and regression-locked by a test.

### §9-a — Findings opened by the 2026-05-18 senior/UI-Architect run

These are tracked separately as MEDIUM a11y deficiencies surfaced after
all §0–§8 gates went green. Each ships as a one-fix shipping (v1.54.1 →
v1.54.2 → v1.54.3). Patches + tests + i18n keys are in
`qa/v54-regression/FIX-PROMPT-v54-FINAL.md`.

| ID | Severity | Screen | Title |
|---|---|---|---|
| F-V54-A | MEDIUM | `#/cv` | Markdown preview injects second `<h1>` (user CV's `# Name`) — competes with page-title h1; WCAG 1.3.1 + 2.4.6 |
| F-V54-B | MEDIUM | `#/pipeline` | 1385 per-row `✕` buttons rely on `title=` for accessible name — replace with explicit `aria-label`; WCAG 4.1.2 |
| F-V54-C | MEDIUM | `#/batch` | TSV `<textarea id="batch-tsv">` lacks `aria-label` / `<label for=>`; WCAG 1.3.1 + 4.1.2 |

---

## §10 — Senior / UI-Architect / UX-Researcher observations (advisory, non-blocking)

These observations come from a senior/UI-architect/researcher review of
the live SPA after every §1–§9 regression gate is green. None violate
the spec; none are tracked as findings (vs §9-a, which are real a11y
bugs). They are documented here so the team can decide which become
roadmap items and which stay "acknowledged tech debt." Re-evaluate each
on every release — promote to a numbered FINDING if user-visible
behavior degrades.

| ID | Screen / concern | Observation | Suggested follow-up | Status |
|---|---|---|---|---|
| **S-1** | `#/dashboard` header density | 30 click-eligible nodes on one screen (5 header CTAs + 8 status-bucket cards + 5 recent-apps rows + theme/menu/lang). Visual hierarchy unclear — every node reads as primary. | UX-research: which are P0 vs P1 vs P2? Group by frequency; demote rarely-used to a `⋯` overflow or progressive disclosure. | OPEN |
| **S-2** | `#/pipeline` DOM scale | 2778 DOM buttons for 1385 rows (▶ + ✕ per row). Smooth today but unsustainable as pipelines grow to 5–10k entries (memory + scroll-jank risk). | Virtualize the list — render only the visible viewport rows. Reference: `react-window`-style pattern (vanilla JS equivalent). Trigger threshold: > 1000 rows. | OPEN |
| **S-3** | `#/scan` filter density | 8 inputs + 13 buttons on a single screen (free-text / Source / Remote-Hybrid-Onsite / Stack chips / Dynamic chips / Active Companies / Company filter). High cognitive load on first encounter. | UX-research: which 3 filters get used >80% of the time? Keep those primary; collapse the rest behind "Advanced filters" disclosure. | OPEN |
| **S-4** | `#/auto` stepper visibility | ~~Stepper is runtime-only~~ — **WITHDRAWN 2026-05-18.** Source audit confirms stepper IS pre-rendered as `<ol class="auto-stepper">` on mount with 5 pending steps. Initial probe missed the actual class (`.auto-stepper` vs spec-test selector `.stepper`). No action needed. | n/a | WITHDRAWN (false alarm) |
| **S-5** | `#/cv` visual hierarchy | After F-V54-A fixes the semantic h1 duplicate, the visual side still shows two near-equal lines ("CV" page-title + user's CV name). They compete visually. | Designer-level: shrink page-title to a chip / breadcrumb above the preview card. Let the user's CV "own" the visual space — the page-title is meta-information. | OPEN (paired with F-V54-A) |
| **S-6** | `#/tracker` scale | 25/page client-side pagination over `data/applications.md`. Fine today but won't scale past ~1000 applications (full-file fetch every navigation). | Move to server-side pagination + filter (already proven on scan results endpoint). Hold until application count crosses ~500 to avoid premature optimization. | OPEN |
| **S-7** | `#/help` back-to-top selector | The "↑ Наверх" button works in live (verified) but lives outside the `.back-to-top` / `[data-back-to-top]` selector convention the spec §2 #28 test is written against. Test will flake if anyone tightens the selector. | Add `class="back-to-top"` (or `data-back-to-top="true"`) to the existing button. One-line CSS-no-op fix. | OPEN (easy win) |
| **W-001** | Deploy hygiene | No version-stamped query string on `<script>` / `<link>` in `public/index.html`. After deploy, browsers may serve cached old `api.js` / `router.js` for hours → stale-cache 404 reports on query-string routes. Observed live during v1.29.2 regression. | Add `?v=<package.version>` to every `<script src>` and `<link href>` in `public/index.html`. `package.json::version` is already injected for the footer; mirror that injection at the asset URLs. Alternatively: `Cache-Control: no-store` on `/public/js/*` in `server/index.mjs`. | OPEN |

### How to use §10

- Each S-* / W-* item is **acknowledged tech debt**, not a regression. Don't fail a release on these.
- On every release, briefly re-scan §10. If user-visible behavior degraded (e.g., S-2 scrolls choppy now), promote the item to a numbered FINDING in §9 and open a one-fix ship.
- New senior observations join here. Items that get fixed migrate out (record the version that closed them).
- WITHDRAWN entries stay as a paper trail so future reviewers don't re-raise the same false alarm.

---

## Exit criteria (this spec passes when)

`test:ci` 717/717 · e2e + e2e-comprehensive + sh-files green ·
8-locale H2/H3/CHANGELOG parity · canonical-docs-coverage 7/7 ·
all §2 a11y invariants hold live · security §4 unbroken · only G-005
open. At that point the SPA is correct, accessible, documented in 8
languages, and conformant with the canonical docs end-to-end.

§9-a (F-V54-A/B/C) and §10 (S-1..S-7, W-001) are **NOT exit-gating** —
they inform the next planning cycle. The release is ship-worthy with
them open; they ship as one-fix v1.54.1 / v1.54.2 / v1.54.3 follow-ups.
