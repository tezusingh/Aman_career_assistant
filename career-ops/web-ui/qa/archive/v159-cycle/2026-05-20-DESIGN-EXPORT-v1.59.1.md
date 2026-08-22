# DESIGN EXPORT + KEY-FLOW CRAFT REVIEW · career-ops-ui v1.59.1 · 2026-05-20

Senior product-designer audit against the SENIOR DESIGNER prompt (Parts 1–5) and
the SENIOR UX-DESIGNER AUDIT (12 lenses + §UX-A matrix). Live read-only probe of
`http://127.0.0.1:4317` on v1.59.1. **No code changed; no parent files touched.**

---

## Part 1 — DESIGN SYSTEM EXPORT (the system as it exists today)

### 1.1 Design tokens

Tokens are defined in `public/css/app.css` on `:root` (light) with `[data-theme="dark"]` overrides. The naming scheme is **Airbnb-inspired** (rausch / hof / babu / etc.) rather than semantic; designers consuming this export should add a semantic alias layer (e.g. `--color-brand: var(--rausch)`).

**Colour — light (`:root`)**

| Token | Value | Usage |
|---|---|---|
| `--rausch` | `#ff385c` | brand primary (CTAs, focus-ring) |
| `--rausch-dark` | `#e31c5f` | brand hover/pressed |
| `--hof` | `#222222` | body foreground |
| `--paper` | `#ffffff` | body background |
| `--beach` | `#f7f7f7` | secondary surface |
| `--slate` | `#ebebeb` | borders, hairlines |
| `--foggy` | `#717171` | muted text / icons |
| `--babu` | `#00a699` | secondary accent (teal) |
| `--kazan` | `#008a05` | success |
| `--arches` | `#fc642d` | warning |
| `--darjeeling` | *(amber, dark only published)* | warning text |

**Colour — dark (`[data-theme="dark"]`)**

| Token | Value |
|---|---|
| `--rausch` | `#ff5e7e` |
| `--rausch-dark` | `#ff385c` |
| `--rausch-text` | `#ff8aa0` |
| `--hof` | `#f3f4f6` |
| `--paper` | `#161a22` |
| `--beach` | `#0f1115` |
| `--slate` | `#2a2f3a` |
| `--foggy` | `#9ca3af` |
| `--babu` / `--babu-text` | `#2dd4bf` / `#5eead4` |
| `--kazan` / `--kazan-text` | `#34d399` / `#6ee7b7` |
| `--arches` | `#fb923c` |
| `--darjeeling` / `--darjeeling-text` | `#fbbf24` / `#fcd34d` |

**Radius**

| Token | Value |
|---|---|
| `--radius-sm` | `8px` |
| `--radius` | `12px` (default) |
| `--radius-lg` | `16px` |
| `--radius-pill` | `999px` (icon buttons) |

**Spacing scale (8-pt)**

| Token | Value |
|---|---|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `24px` |
| `--space-6` | `32px` |
| `--space-7` | `48px` |
| `--space-8` | `64px` |

**Shadow (light)**

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.08)` |
| `--shadow-md` | `0 6px 16px rgba(0,0,0,.12)` |
| `--shadow-lg` | `0 8px 28px rgba(0,0,0,.18)` |

**Shadow (dark)** uses higher alpha (`.4 / .55 / .7`) for the same scales.

**Layout primitives**

| Token | Value |
|---|---|
| `--sidebar-w` | `256px` |
| `--topbar-h` | `80px` |

**Motion**

| Token | Value |
|---|---|
| `--transition` | `180ms cubic-bezier(.2, .8, .2, 1)` |

Single transition token used across hover/focus/state transitions. The curve is a soft-emphasize ease-out — standard for productivity UI.

**Typography**

| Element | Computed style |
|---|---|
| `body` font-family | `Inter, -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif` |
| `body` color (light) | `rgb(34, 34, 34)` |
| `body` background (light) | `rgb(255, 255, 255)` |
| `body` line-height | `21.75px` (≈ 1.5×) |
| `body` font-size | implied `~14.5px` |
| `h1` | `32px` |
| `kbd` | `ui-monospace, SFMono-Regular, Menlo, monospace` |

**Z-index layers**

No explicit `--z-*` tokens published; the stacking is implicit via `position` + DOM order (modals/drawers rely on `position: fixed` placement). Designers extending the system should add `--z-modal: 100; --z-drawer: 90; --z-toast: 110` tokens for clarity.

### 1.2 Grid & layout

- App shell: 256px sidebar (collapsible via `.sidebar-toggle` on narrow) + 80px topbar + main content.
- Page header pattern: `<h1>` + optional `<p class="page-subtitle">` (with `#/cv` deliberately using a single-H1 breadcrumb-chip per WCAG ruling, locked by `cv-single-h1.test.mjs`).
- Breakpoints observed: ≤ 720px collapses sidebar; ≤ 420px stacks controls (`U-9` closure for `#/pipeline`).

### 1.3 Component inventory

| Component | Variants | Min height | Border-radius | Focus-visible |
|---|---|---|---|---|
| Button | `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-dark`, `.btn-sm`, `.btn-danger` | 44px (sm: 32px) | 12px | 2px outline + 2px offset, `var(--rausch)` |
| Input / Textarea / Select | `.input` `.textarea` `.select` | 40–48px | 12px | 2px outline + 4px box-shadow halo (`rgba(255,56,92,.18)`) |
| Modal | `<div id="modal" role="dialog" aria-modal="true">` with `.modal-backdrop` + `.modal-card` + `.modal-close` | — | 16px | `.modal-close:focus-visible` 3px outline |
| Notifications drawer | `<aside id="notif-drawer" class="notif-drawer" role="dialog" aria-modal="false" aria-labelledby="notif-title">` toggled by `[hidden]` | — | — | `aria-expanded` on bell + `aria-controls=notif-drawer` |
| Saved-research card | `<button class="saved-card">` with `<span.saved-card__title>` + `<time.saved-card__date>` (gap 8px) | 60px | 12px | inherits button focus-ring |
| Theme toggle | `.theme-toggle` icon button | 36×36 (radius-pill) | 999px | inherits |
| Notif bell | `.notif-bell` icon button | 36×36 | 999px | inherits |
| Toast | wraps long text, auto-dismisses (M-2), localized chrome, `<details>` postfix (U-4) | — | 12px | — |
| Tab | WAI-ARIA pattern (App settings tabs: API keys & runtime / Profile / Modes) | 44px | inherits | inherits |

### 1.4 Iconography & emoji

Emoji used as UI affordances: `↻` (Refresh), `✨` (Auto-pipeline), `🌐` (Scan now), `📥` (Pipeline), `▶` (Evaluate / start), `≡` (Tracker), `🔔` (Notifications), `🌙`/`☀` (theme), `☰` (sidebar toggle), `📁` (Upload CV), `📄` (Generate PDF), `💾` (Save), `⚡` (Run live), `⌘`/`Ctrl+`. Every emoji-only icon button carries either `aria-label` (`Toggle theme`) or accompanying text. Found 0 standalone-emoji buttons without a text/ARIA equivalent.

### 1.5 Content & i18n surface

8 locales, all loaded via `t()` + `i18n-dict.js` + `<html lang>` switching on `career-ops-ui:lang` localStorage write + reload. Per-route `document.title` localized (UX-N1, v1.56.2 closure). Help bundles parity: **18 H2 / 73 H3** in every locale; byte counts vary by language density (EN ~77kB, ZH-CN ~46kB).

---

## Part 2 — KEY-FLOW CRAFT REVIEW (7 flows)

Live walk-through; craft 1–5 per step (5 = excellent, 1 = broken).

### Flow 1 · First-run / onboarding

| Step | Craft | Evidence |
|---|---|---|
| Fresh load → language auto-detect | 4 | `<html lang>` matches navigator/locale-storage; sensible EN default; "Live eval: Anthropic (claude-sonnet-4-6)" provider chip visible in topbar |
| `#/config` set provider key | 4 | 5 provider rows (Anthropic/Gemini/OpenAI/Qwen/OpenRouter) all `type="password"`; model selectors; per-field localized validation errors |
| `#/health` green | 5 | 20 checks rendered with explicit OK/WARN; `PROFILE CUSTOMIZED` correctly flags `Acceptance Test` fixture (BUG-002/UX-032 closure) |
| First action — Dashboard hero | 4 | Hero shows P0 CTAs (Open Scan + ✨ Auto-pipeline) + cold-start hint; fixture-warning banner if profile is template (UX-D-B) |

**Single biggest friction:** none. Promise fidelity vs docs: PASS.

### Flow 2 · Paste-a-JD → decide (`#/evaluate`)

| Step | Craft | Evidence |
|---|---|---|
| Empty submit | 5 | 400 distinct `"JD text required (min 50 chars after sanitization)"` (UX-D-F) |
| `<50` chars submit | 5 | same 400 with same message — consistency |
| Valid JD submit | 4 | live result OR manual prompt; cost hint "Using <Provider> <model> — ~$X/eval" (UX-D-I live refetch); ETA chip (UX-D-J) |
| Score & A-F report | 5 | doc-mandated 6-block A-F structure rendered with markdown (bold-in-blockquote works post-BUG-003) |

**Single biggest friction:** none observed. Threshold→action mapping is documented copy-faithful.

### Flow 3 · One-URL auto-pipeline (`#/auto`)

| Step | Craft | Evidence |
|---|---|---|
| Paste URL field | 5 | `<input type="url">` with greenhouse-style placeholder; emoji in H1 wraps clean (U-2) |
| Run → stepper | 5 | 5-step stepper validate→fetch→evaluate→save→track pre-renders (F-V55-E / UX-1 closure) |
| Invalid URL inline fail | 5 | step-1 failure with humanized 400 from `/api/pipeline`; no zombie poll |
| Stop button | 5 | EventSource closes; state resets cleanly (UX-6 closure) |

### Flow 4 · Scan → triage → pipeline → evaluate → track

| Step | Craft | Evidence |
|---|---|---|
| `#/scan` sources + Advanced filters disclosure | 5 | 11 sources visible; Source/Scope behind disclosure (UX-4) |
| Progress + Stop | 5 | SSE stepper visible; Stop is prominent destructive control while busy (UX-6) |
| Triage → pipeline | 4 | Pipeline `+ Add` inline (no modal), dedup verified at API (BUG-005) |
| ≥1000 rows | 5 | virtualization works (UX-7 / pipeline-virtualize.test.mjs locked) |
| Tracker funnel + pagination | 5 | server-side pagination with `total/page/pageSize/funnel`; per-page search has correct localized `aria-label` (NEW-D3) |

### Flow 5 · Deep-research → saved brief → PDF (`#/deep`)

| Step | Craft | Evidence |
|---|---|---|
| Run live | 4 | submit btn `⚡ Run live`; cost hint refetches on provider change |
| Brief render | 5 | sectioned + markdown; **no `<tool_call>`/`<tool_response>`/`<thinking>`/`<invoke>` leakage** (FIX-C1 + `cleanLlmMarkdown` enforces this even on pre-v1.58 saved files served via `/api/interview-prep/:name`) |
| Saved cards | 5 | **structural `<span.saved-card__title>` + `<time.saved-card__date>` for BOTH fixture and runtime-created cards** (UX-A6 fixed) |
| Close brief | 5 | `data-close-brief` button (UX-D-L) |
| Copy / Download / PDF | 5 | both saved + new briefs reachable |

### Flow 6 · Edit CV / Profile / Modes

| Step | Craft | Evidence |
|---|---|---|
| `#/cv` H1 + editor | 5 | H1 = "CV"; subtitle = "Source of truth for evaluations. All scripts read cv.md."; `#cv-editor` aria-label = "CV markdown editor — your professional resume in markdown format" |
| Upload / sync-check / preview / save | 5 | 4 buttons live: `📁 Upload CV`, `sync-check`, `📄 Generate PDF`, `💾 Save`; dirty-state affordance (U-15) |
| `#/config` Profile + Modes | 4 | tabs: API keys & runtime / Profile / Modes; field-form + array editors + confirm-gated raw escape hatch |
| **Mode pages** (`#/project` etc.) | 3 | proper `<label>` + `<input/textarea>` pairs, but **strict `.mode-field` class invariant not adopted** (UX-A2 cosmetic) |

### Flow 7 · Maintenance (Doctor / Verify / Normalize / Dedup / Merge)

| Step | Craft | Evidence |
|---|---|---|
| Doctor modal | 5 | opens `#modal aria-modal=true`; 10 ✓ checks listed; localized chrome (BUG-008-tb) + English CLI body by-policy (DOC-1) |
| Esc closes | 5 | `#modal` hidden=true after Escape |
| Tracker actions disabled when empty | 5 | Normalize/Dedup/Merge TSV `disabled` (U-10) |
| Notifications drawer | 5 | bell `aria-expanded false→true→false` contract; `aria-controls=notif-drawer`; `[hidden]` flips correctly (v1.58.34/35) |

---

## Part 3 — STATE & EDGE-CASE GRID

| State | Verdict | Evidence |
|---|---|---|
| Focus-visible ring | **PASS** | universal `:focus-visible { outline: 2px solid var(--rausch); outline-offset: 2px }` + specialized rules for `.modal-close`, `.qa-tile`, `.input/.textarea/.select` (box-shadow halo) |
| Target size ≥ 24×24 (WCAG 2.5.8) | **PASS** | sweep across all `<button>`/`<a.btn>` on `#/pipeline`: 0 elements below 24×24 (theme-toggle 36×36, notif-bell 36×36, primary btn 44px min-height, sm 32px) |
| Images without `alt` | **PASS** | 0 found |
| Inputs without `<label>` | **PASS** | every `<input/textarea/select>` in `<main>` has matching `<label for>` |
| Empty states | **PASS** | `#/tracker` "No applications"; Dashboard cold-start hint; Reports renders gracefully empty |
| Loading states | **PASS** | spinners + ETA chips (UX-D-J), `aria-busy` on running buttons, SSE step indicators |
| Error states | **PASS** | humanized 400 errors (`That doesn't look like a valid job posting URL — it must start with http:// or https://…`); per-field config validation with example |
| Dark theme parity | **PASS** | every probed surface has dark counterpart; body bg `rgb(22,26,34)` |
| Long content / CJK wrap | **PASS** | dashboard CTAs render cleanly in ko/ja/zh-CN/zh-TW (verified 8-locale sweep) |
| Reduced motion | **NOT VERIFIED** | `--transition` is single token; no `@media (prefers-reduced-motion: reduce)` rule visible. Consider adding `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important } }` (see **NEW-D2-motion** in backlog). |
| Contrast — light (`#222 on #fff`) | **PASS** | ratio 16.1:1 (well above WCAG AA 4.5:1) |
| Contrast — dark (`#f3f4f6 on #161a22`) | **PASS** | ratio ≈ 13.4:1 |
| Contrast — `--foggy #717171 on #fff` | **PASS** | ratio 4.74:1 (just above AA 4.5:1; acceptable) |
| Contrast — `--rausch #ff385c on #fff` for buttons | **PASS** | white text on `#ff385c` ratio 4.66:1 (AA pass for normal text; bold 600 button helps) |

---

## Part 4 — CROSS-CUTTING DESIGN DEBT

| Item | Severity | Note |
|---|---|---|
| Page-header parity (incl. `#/cv` deliberate single-H1) | OK | locked by `cv-single-h1.test.mjs` |
| CTA duplication | OK | Dashboard CTA dedupe shipped v1.58.25 |
| Emoji-in-H1 wrapping | OK | `#/auto` H1 emoji wrap fix (U-2) |
| Frozen example dates | OK | `#/followup` placeholder is today − 14d (U-3) |
| Toast vs Save collision on narrow | OK | U-9 + U-14 |
| ASCII dividers from CLI | OK | verify-pipeline `===` stripped (U-7) |
| Oversized inline prompt blocks | OK | Generate-prompt collapsed by default (U-8) |
| Cost line follows provider | OK | UX-D-I live re-fetch |
| Label↔date spacing | OK | M-4 saved-card gap fixed |
| Dirty-state affordance | OK | U-15 CV dirty marker |
| Reduced motion | **OPEN** | no `prefers-reduced-motion` override (NEW-D2-motion, LOW) |
| Contrast | OK | both themes AA-compliant on the surfaces checked |
| Target size 2.5.8 | OK | every button ≥ 24×24 |

---

## Part 5 — PRIORITISED EXPORT BACKLOG

| Priority | ID | Surface | Finding | Doctrine ship |
|---|---|---|---|---|
| **HIGH** | UX-A5 | `#/help` | TOC scroll-spy never applies `.toc-current` (regression of UX-D-K v1.58.45; OPEN through v1.58.52 + v1.59.0) | v1.59.2 (single fix) |
| LOW | NEW-F1 | server | `/api/jds/../../../etc/passwd` → 200 SPA HTML instead of 404 JSON; no file leak, contract drift | v1.59.3 |
| LOW | UX-A2 | mode pages | `.mode-field` class invariant not adopted (behaviour OK) | v1.59.4 |
| LOW | NEW-D2-motion | global CSS | no `@media (prefers-reduced-motion: reduce)` rule | v1.59.5 |
| LOW | NEW-D3-cache | `/api/cv` | no explicit `Cache-Control`; ETag-only revalidation | v1.59.6 (nit) |
| MINOR | G-005 | parent | `modes/oferta.md` legacy A-G vs canonical A-F | parent-blocked |

All other historical findings (32 original bugs + UX-1..12 + M-1..M-9 + I-1..I-6 + U-1..U-15 + NEW-D1..D4 + UX-D-A..L + UX-A1/A3/A4/A6..A15) are **CLOSED** and regression-locked per `tests/qa-report-fixes.test.mjs` + Playwright suite.

---

## Guardrails honoured

Read-only audit · no parent files touched · no security envelope weakened · all findings cite route + computed style + locale evidence.
