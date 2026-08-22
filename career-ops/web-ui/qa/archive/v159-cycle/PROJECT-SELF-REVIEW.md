# career-ops-ui · Project self-review

**As-of:** 2026-05-19, v1.58.51 in production
**Lens:** senior QA + senior UX-designer hybrid, judged against `https://career-ops.org/docs` as the canonical product intent.
**Compiled from:** the entire regression-cycle history across this engagement.

---

## 1. Product positioning (in one paragraph)

career-ops-ui is the **headless visual layer** on top of the career-ops CLI pipeline — a markdown-first, AI-CLI-agnostic job-search system that turns "I have a job URL" into "I have an A–F rubric-scored report and a tailored interview plan" in ~1–2 minutes. The web UI exists to lower the barrier to first use (no need to memorize slash commands) while leaving the source of truth — `cv.md`, `data/applications.md`, `modes/_profile.md`, `reports/*.md` — on the user's disk in plain markdown. It runs on any **one** of Anthropic / Gemini / OpenAI / Qwen / OpenRouter API keys (the "OR" model), with the actual LLM call routed by `LLM_PROVIDER` ∈ `{auto, claude, gemini, openai, qwen, openrouter}`.

That positioning is **honest** — the UI does deliver it, in v1.58.51.

---

## 2. Where the product genuinely shines

### 2.1 — The notifications drawer (v1.58.34/35)

A reference-quality implementation. Bell button with unread badge, slide-in `<aside role="dialog">`, hidden-at-boot with explicit `[hidden] { display: none }` override (the `[hidden]` cascade lesson from v1.58.35), keyboard contract (Esc / × / re-click bell), every toast journalled with timestamp + technical postfix, `aria-expanded` and `aria-controls` correctly wired on the bell, Playwright 7-step contract guarding it. This is the kind of small-surface, big-trust UI that distinguishes credible engineering.

### 2.2 — Apply checklist interactive (M-8 v1.58.13)

The page is named "Apply checklist" — and it actually IS a checklist now: 9 real `<input type="checkbox">` items, per-URL `localStorage[applyChecklist:<host>/<path>]` persistence, Copy-unchecked + Reset buttons, with the `{company}-{role}` placeholders substituted from the parsed URL (UX-D-D v1.58.46). The promise matches the delivery.

### 2.3 — Followup ISO validation (BUG-001)

Junk-date input is blocked client-side with zero network call, a localized error toast, and the example date in the locale's calendar format (`ГГГГ-ММ-ДД` for ru, `YYYY-MM-DD` for en). This is best-in-class form-validation hygiene — fast feedback, no wasted LLM credit, localized example.

### 2.4 — Security envelope (NEW-1 v1.58.4 + NEW-2 v1.58.7)

Full CSP on every response (`/`, `/api/*`) with `frame-ancestors 'none'`, no `'unsafe-eval'`, no `'unsafe-inline'` for `script-src`. URL validation rejects loopback / `file:` / `javascript:` / `<script>` / `<%...%>` / `${T}` / `{{T}}` template syntaxes. Zero CSP violations across a 25-route × 4-locale Playwright sweep.

### 2.5 — i18n cycle discipline

8 locales (`en/es/pt-BR/ko/ja/ru/zh-CN/zh-TW`), tests/i18n-coverage.test.mjs as gate, `tests/i18n-no-latin-leaks.test.mjs` as negative-match guard, `<html lang>` updates on switch with autodetect from `navigator.languages`, `document.title` localizes per route. The recent NEW-D1 closure (`Pipeline` H1 → `Воронка вакансий` on ru, `Pipeline de vacantes` on es) shows the cycle works.

### 2.6 — A11y as UX

The `:focus-visible` ring (M-1 v1.58.9) — brand-red `outline: rgb(255,56,92) solid 2px`, only on keyboard focus, not on programmatic `.focus()`. The Tracker `LEGITIMACY Ⓘ` info chip (U-11 v1.58.31) — `tabindex="0"`, localized `title`+`aria-label`, keyboard reachable. Skip-link, Tab-order audit, label-input wiring, alt text — all in place. Not just WCAG box-ticking; it actually feels right under keyboard navigation.

### 2.7 — Trust signals throughout

The `Health` page is honest about the fixture profile (`Profile customized · OPTIONAL · still on template / test fixture ("Acceptance Test")`). The Dashboard now surfaces this as a `.hero-banner.hero-banner--warning` (UX-D-B v1.58.48). Cost lines use `cost.varies` for OpenRouter (M-7 v1.58.12). Confirm-gated destructive actions. Masked secret fields. No silent failures.

---

## 3. Where the product still has rough edges (open backlog)

### 3.1 — Cross-repo, blocked on parent

- **C-1 prompt-layer (Critical-cross-repo):** the Deep research saved brief, the centerpiece of the `#/deep` flow, still renders as model meta-narration instead of the structured 6-section brief the docs promise. The web-ui's `cleanLlmMarkdown` strips orphan tags, but the **structure** is set by `modes/deep.md` in the parent CLI repo. Until the parent's prompt enforces a final-form output, the web-ui can only do **defensive UX** (warning banner if the saved file lacks 3+ H2 headings — proposed in FIX-PROMPT-FINAL-EXHAUSTIVE §4).
- **G-005:** A-G → A-F header migration in parent `modes/oferta.md`. Renderer is schema-tolerant.
- **UX-022:** stale portals in parent `portals.yml` (`Clarity AI` / `Forto` / `Hugging Face` lever/workable 404s).
- **CLI-locale:** `career-ops doctor` / `verify-pipeline.mjs` / `cv-sync-check.mjs` stdout is English on every locale. Modal **chrome** localizes (v1.58.6); CLI stdout localization is parent-CLI work.

### 3.2 — Newly identified in v1.58.51 verification

- **NEW-K1 (Medium):** Help TOC scroll-spy not firing. 18 H2s with ids, 18 TOC links, but `.toc-current` never applied after scroll. Possible IntersectionObserver lifecycle race after route navigation. Fix queued at v1.58.52.
- **NEW-M4-r1 (Minor):** dynamically-created saved-research cards (after Run live) use old text-concatenation render path instead of the structural `<span>` + `<time>` template from v1.58.11. Fixture cards render correctly. Fix queued at v1.58.53.

### 3.3 — Deferred to v1.59 / future cycles

- **Mobile (≤ 420 px) deep audit** — never performed. CSS responsive rules in place, but no end-to-end mobile pass.
- **Drag-and-drop reordering** on `#/pipeline` / `#/tracker`.
- **Bulk multi-select + delete** on the same.
- **RTL** (Arabic / Hebrew) — `dir` already wired, but full audit pending.
- **CLI-locale** as above.

---

## 4. Architectural and engineering hygiene

### 4.1 — One-fix-per-release doctrine

This codebase has shipped **47+ single-fix releases** in cycles v1.55.1 → v1.58.51, every one bumping CHANGELOG ×8, adding a test, going through pre-commit AI-review, and watching CI to green. The audit trail in `tests/qa-report-fixes.test.mjs` is the regression-locked memory of every shipped fix. This is unusual discipline for a small-team product.

### 4.2 — Defense in depth

`UI.md()` escape-first as the XSS boundary. `stripDangerousMarkdown` as the CV ingress filter. `cleanLlmMarkdown` as a declutter step (explicitly NOT a sanitizer — category error guarded). `isValidJobUrl` + `safeGet` for SSRF. `withFileLock` for parent-file writes. `PATHS` resolves once per process. **`validateConfig`** strips SPA-injected `lang` before validation (v1.57.2 invariant). Server `4xx`/`5xx` bodies stay English by policy (DOC-1 v1.58.50) for debuggability + CI fixture stability.

### 4.3 — Testing pyramid

`npm test` (≥ 900 tests) · `npm run test:e2e` (smoke) · `npm run test:e2e:full` (23-step comprehensive) · `npm run test:e2e:browser` (58/62 Playwright). Coverage floor ≥ 80% on non-trivial logic. Shell-file `tests/sh-files.test.mjs` for `bin/*.sh`. `scripts/check-no-also-leftovers.mjs` + `scripts/check-changelog-parity.mjs` as additional CI gates.

### 4.4 — Documentation hygiene

`CLAUDE.md` for the AI maintainer · `qa/REGRESSION-FINAL.md` as the perennial regression prompt · `docs/help/<lang>.md` ×8 with 18 H2 / 73 H3 parity gate · `qa/FIX-PROMPT-FINAL.md` as the closure ledger. The `docs/help/*.md` Help bundles are H2-locked in tests so any new section added to the canonical career-ops.org docs has to be mirrored.

### 4.5 — Catch lessons

The codebase encodes its own lessons in inline comments and the perennial regression file:
- `[hidden]` is a no-op against author-level `display:` rules.
- `npm test 2>&1 | grep …` masks the exit code.
- `cleanLlmMarkdown` is not a sanitizer.
- Lock-test regex must tolerate markdown bolding (`\W*` between words).
- `Publish to GitHub Packages` runs against the TAGGED ref, not `main`.

These aren't theoretical — each has burned the project at least once and now lives as a static guard in tests.

---

## 5. Quality signal: change in posture across the regression cycles

Over the regression engagement, the project went from:

- **v1.58.2/3 — MASTER regression:** 32 findings, 2 Critical (C-1 stripper missing; `<html lang>` not updating).
- **v1.58.4 → v1.58.35:** 32 one-fix releases. All MASTER findings closed; cycle ledger expanded to 47 invariants.
- **v1.58.36 — first deep button-result audit:** 4 NEW findings (NEW-D1/D2/D3/D4), all Medium-Minor.
- **v1.58.37 → v1.58.50:** 14 one-fix releases addressing all NEW findings + UX-designer audit additions.
- **v1.58.51 — final verification:** 13 of 14 §13 closures live-verified; 2 new findings (NEW-K1 Medium scroll-spy, NEW-M4-r1 Minor render-path), both queued for v1.58.52/.53.

**The shape of findings has shifted from "Critical security / functional gaps" to "UX polish and orientation cues."** That is the right trajectory.

---

## 6. Recommendations (strategic, not tactical)

### 6.1 — Close the prompt-layer parent dependency (C-1)

The single highest-impact remaining issue is the Deep research output structure. The web-ui's defensive warning is queued but the real fix is in the parent `modes/deep.md`. Prioritize the cross-repo conversation.

### 6.2 — Add a deliberate mobile audit cycle

The product feels desktop-first. Once mobile is on the roadmap, treat it like the 8-locale rollout: a perennial regression matrix on 420 px / 768 px / 1024 px viewports, with separate snapshots.

### 6.3 — Add a "first-run" Playwright contract

Cold-start scenarios (empty parent files, no API key, only one provider key set) deserve a dedicated test file: `tests/e2e/first-run-cold-start.spec.mjs`. The fixture-profile banner (UX-D-B) is one piece — the rest is the entire onboarding journey from empty `cv.md` to first eval.

### 6.4 — Document the "OR" model on the Dashboard

A small (`.dash-chip` style) chip near the hero CTAs that reads "Live evals: Anthropic claude-sonnet-4-6 ⚡" when a provider is set, or "No API key — using manual prompt mode" when not. This would make the OR model immediately legible without a Health-page visit.

### 6.5 — Sunset the `Acceptance Test` fixture

The fixture profile is a useful test artifact but ships in the default `config/profile.yml` of the parent project. Cross-repo: replace with an obviously-placeholder name (`Your Name Here` / `Replace with your name`) that the fixture-profile banner (UX-D-B) can still detect, but that doesn't look like a real person's name in saved briefs accidentally.

### 6.6 — Cost-line + provider-display unification

The cost line + the OR chip from §6.4 + the `#/health` provider rows are three views of the same model — current-active-provider. Consider a single `<provider-status>` web component that owns the data and is reused across the three locations. Reduces drift.

---

## 7. The truthful verdict

**career-ops-ui v1.58.51 is a mature, well-engineered web app** that delivers the documented promise faithfully. The remaining items are polish (NEW-K1, NEW-M4-r1), strategic (mobile audit, cold-start tests, OR-model surfacing), or genuinely cross-repo (C-1, G-005). There are **no blockers** for a normal user shipping their job search through this tool.

The team has cultivated a discipline — single-fix releases, parity gates, perennial regression files, AI-review as advisory layer, CI as hard gate — that scales beyond this product. The codebase is a study in how to ship small, ship often, and not regress.

Where it falls short — Deep brief structure (cross-repo), scroll-spy lifecycle (v1.58.52 fix), card render inconsistency (v1.58.53 fix) — those are surface-level fixes with clear paths forward, not architectural debt.

If I were rating this product as a designer, I'd say: **8.5 / 10**. Half a point for the open Deep brief promise gap, half a point for the absent mobile cycle, and a quarter point each for the two surface findings still open. The rest is solid craft.

---

## 8. What I'd ship next, in order

1. **v1.58.52** — NEW-K1 Help TOC scroll-spy fix. (1 day)
2. **v1.58.53** — NEW-M4-r1 saved-card render unification. (1 day)
3. **v1.58.54** — UX-D-A defensive structure check on Deep saved brief (warning banner when fewer than 3 H2s). (1 day; doesn't fix the root cause but tells the user honestly that something is off.)
4. **v1.59.0 mobile pass** — 420 px / 768 px / 1024 px audit, Playwright on those viewports.
5. **v1.59.1 first-run cold-start tests** — Playwright e2e starting from empty parent files.

After that the project enters maintenance mode with the perennial regression prompt (`qa/REGRESSION-FINAL.md`) catching any drift.

---

*Compiled by Claude (Sonnet 4.6) as senior QA + UX hybrid. The numbers and verdicts here are evidence-backed by the regression session artifacts in `qa/v54-regression/` and the FIX-PROMPT chain.*
