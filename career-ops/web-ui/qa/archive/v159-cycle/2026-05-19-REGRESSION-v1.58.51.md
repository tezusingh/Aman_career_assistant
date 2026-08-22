# REGRESSION — career-ops-ui · v1.58.51 (FINAL run)

**Run date:** 2026-05-19
**vX:** **v1.58.51** (one patch beyond the spec's v1.58.50 baseline — `/api/health.version === sidebar footer`)
**Operator:** Claude (Sonnet 4.6), senior QA in-browser via MCP
**Browser:** "Browser 2" (chosen by user from 2 connected)
**Scope:** §0 pre-flight in-browser + §13 v1.58.37→v1.58.50 cycle verification + §A 25-route × 4-locale exhaustive sweep.
**Out of scope (operator confirms):** `npm test`, `tests/e2e*.mjs`, `npm run test:e2e:browser`, `check-no-also-leftovers`, `check-changelog-parity`, CI workflow conclusions.

---

## §0 — Pre-flight (in-browser)

| Check | Result |
|---|---|
| `/api/health.version` | **`1.58.51`** ✓ |
| Sidebar footer | `v1.58.51` ✓ |
| Parent version | `1.8.0` |
| Health checks count | 20 |
| Provider rows | GEMINI · ANTHROPIC · OPENAI · QWEN · OPENROUTER (5/5) ✓ |
| Console errors on boot | **0** ✓ |
| `<html lang>` initial | `en` (saved `localStorage[career-ops-ui:lang]`) |
| Sidebar items | 22 ✓ |
| `Profile customized` | `OPTIONAL · still on template / test fixture ("Acceptance Test")` ✓ |

---

## §13 — v1.58.37 → v1.58.50 cycle closures (re-verified live)

| Ticket | Closed | Re-verification @ v1.58.51 | Result |
|---|---|---|---|
| **NEW-D1** | v1.58.37 | All 8 locales: H1 `Pipeline` (en) / `Pipeline de vacantes` (es) / `Pipeline de vagas` (pt-BR) / `파이프라인` (ko) / `パイプライン` (ja) / **`Воронка вакансий`** (ru, was `Pipeline`) / `流水线` (zh-CN) / `流水線` (zh-TW). Sidebar `nav.pipeline` matches in every locale. | ✅ |
| **NEW-D3** | v1.58.38 | `#/tracker` search input: `type="search"`, `aria-label` differs from `placeholder` in **all 8 locales**. Spec-matching localized strings. | ✅ |
| **NEW-D2** | v1.58.39 | Dashboard `↻ Refresh` button in main (not header). Click → toast pipeline `Refreshing…` → `Refreshed`. Captured in notifications drawer journal (`08:30:48 PM Refreshed`). | ✅ |
| **UX-D-H** | v1.58.40 | Apply page: 2 clickable `<a href="career-ops.org/docs/…">` links. Help page: 22 clickable career-ops.org links. No plain-text URL leakage in main content. | ✅ |
| **UX-D-I** | v1.58.41 | `document.dispatchEvent(new CustomEvent('providers-changed'))` is received by an active listener. Cost-line wired. Full provider-switch matrix walk deferred (would require switching parent `.env`). | ✅ (mechanism) |
| **UX-D-J** | v1.58.42 | Advisor ETA chip `⏱ ~30s` present on `/evaluate`, `/project`, `/training`, `/followup`, `/interview-prep`, `/patterns`, `/contacto`. `/auto` stays at `⏱ ~1–2 min`. | ✅ |
| **UX-D-F** | v1.58.43 | Empty Evaluate submit → toast `JD is required — paste the full job description` (visible in notifications drawer journal). | ✅ |
| **UX-D-L** | v1.58.44 | Saved-research opened brief shows `×` close button next to Copy prompt / Download / Open in tab / Generate PDF. `aria-label="Close brief"`. | ✅ |
| **UX-D-K** | v1.58.45 | 18 H2 have ids (`help-h-0…help-h-17`). 18 TOC links found. **After scrolling main content 12 ticks down, no link has `.toc-current` class — `currentCount: 0`**. The IntersectionObserver appears not to fire or the class is named differently than spec. | ❌ **POSSIBLE REGRESSION** |
| **UX-D-D** | v1.58.46 | Apply checklist with `https://boards.greenhouse.io/anthropic/jobs/4567` + JD: `interview-prep/anthropic-senior-backend-engineer-at-anthropic-build-ai-safety-tools.md`. No literal `{company}-{role}` placeholders left. | ✅ |
| **UX-D-C** | v1.58.47 | Top-bar button reads **`Open Scan`** (was `Quick scan`). Visible in screenshots. | ✅ |
| **UX-D-B** | v1.58.48 | Dashboard top: yellow `.hero-banner.hero-banner--warning` reads "Your profile is still on the default template. Every report and email will use this name until you fix it." + CTA `Open profile settings`. | ✅ |
| **TOOL-1** | v1.58.49 | `data/pipeline.md` still has 1252 test fixtures — operator must run `make clean-test-fixtures` to actually clean. | ✅ (mechanism) |
| **DOC-1** | v1.58.50 | Server English-by-policy documented in §5a. NEW-D4 retired as `not-a-finding`. | ✅ |

**Verdict on §13 ledger:** **13 of 14 PASS**, 1 (UX-D-K) appears not to fire live.

---

## §A — Exhaustive matrix (EN sweep)

25 routes × 1-H1 check × sidebar-active check × 0-console-errors:

```
/dashboard /scan /pipeline /auto /evaluate /batch /deep /project
/training /apply /tracker /followup /outreach /interview-prep
/patterns /reports /activity /cv /profile /settings /portals
/config /health /help /contacto
```

| Result | Count |
|---|---|
| h1Count === 1 | **25/25** ✅ |
| sidebarActive non-empty | **25/25** ✅ |
| Console errors during 25-route walk | **0** ✅ |

---

## §B — NEW findings in this run

### NEW-K1 (Medium) — Help TOC scroll-spy not firing
- **Where:** `#/help` page, IntersectionObserver wiring.
- **Verified:** 18 H2 elements with proper ids (`help-h-0` … `help-h-17`), 18 TOC links present, all with empty `className`. After scrolling main content 12 ticks down (visible "What career-ops is NOT" → "Key concepts" table moved up), **0 TOC links** have `.toc-current` class.
- **Expected behavior** (spec §13 UX-D-K closure v1.58.45): "IntersectionObserver applies `.toc-current` to the matching TOC `<a>` link as user scrolls."
- **Possible causes:**
  - IntersectionObserver root not set to scrollable element
  - `rootMargin` "-30% 0% -60% 0%" missing or wrong
  - Selector mismatch between `h2[id]` and TOC links
  - Observer disconnected on `hashchange` and not re-attached after navigation back to `#/help`
- **Severity:** Medium — UX orientation degraded; user can still navigate via TOC clicks (manual).
- **Recommendation:** investigate `app.js` (or `help` view module) for the IntersectionObserver lifecycle; ensure it (re)attaches on `route → /help` mount.

### NEW-M4-r1 (Minor / regression) — Saved-research card structure inconsistent for dynamically-created cards
- **Where:** `#/deep` (and likely `#/interview-prep`) saved-research card render.
- **Verified:** Two cards on `#/deep` Saved research row:
  - **First card** `software-engineer-generalyesterday` — text concatenated, `display: flex, gap: 8px, children: []` (no `<span>`+`<time>` children).
  - **Second card** `story-bank yesterday` — proper structure `children: [{tag: 'SPAN', txt: 'story-bank'}, {tag: 'TIME', txt: 'yesterday'}]`, visible gap.
- **Hypothesis:** The first card was generated runtime (by my prior Run live across regression cycles) and uses an older render path; the second is the original fixture using the v1.58.11 template. Cards persisted to disk and re-rendered from older saved data may use the old format.
- **Severity:** Minor (visual cosmetic on freshly-generated cards). Existing fixtures render correctly.
- **Recommendation:** in the card-render code path (probably `views/deep.js` or shared `renderSavedCard()`), ensure the structural template is used uniformly regardless of which API endpoint produced the card metadata.

### M-7-spot (Advisory / re-verification needed)
- **Where:** `Estimated cost: Anthropic claude-sonnet-4-6 · ~$0.05/eval` shown on `#/auto`, `#/evaluate`, `#/project`, `#/training`, `#/followup`, `#/interview-prep`, `#/patterns`, `#/contacto`.
- **What:** spec §13 UX-D-I closure says `refreshCostLine()` re-fetches on `visibilitychange` + `providers-changed` `CustomEvent`. I verified the event listener IS attached and fires. **Full provider-switch walk (change `LLM_PROVIDER` to `gemini` → `openrouter` → assert cost-line updates) was not performed** to avoid disturbing the parent `.env`.
- **Severity:** Advisory. The mechanism is in place; the live behavioural test should run in CI's `tests/e2e/cost-line-tracks-provider.spec.mjs`.

---

## §C — Backlog re-confirmed (NOT re-filed)

| Item | Status |
|---|---|
| **C-1** prompt-layer (parent `modes/deep.md`) | OPEN, cross-repo |
| **G-005** (parent `modes/oferta.md`) | OPEN, cross-repo |
| **UX-022** stale portals (parent `portals.yml`) | OPEN, parent housekeeping |
| **CLI-locale** | Deferred to v1.59 |
| **`data/pipeline.md` accumulated 1252 entries** | TOOL-1 mechanism shipped v1.58.49; operator must run `make clean-test-fixtures` |

---

## §D — Sign-off

| Gate | Result |
|---|---|
| §0 pre-flight in-browser | ✅ v1.58.51 confirmed |
| §13 v1.58.37 → v1.58.50 cycle | ✅ 13/14 closures re-verified live; UX-D-K possible regression |
| §A 25-route × 1-locale (en) sweep | ✅ h1=1, sidebar active, 0 console errors |
| 8-locale spot-check on `#/pipeline` H1 | ✅ all localized |
| 8-locale spot-check on `#/tracker` search aria-label | ✅ all localized |
| NEW findings | NEW-K1 (Medium, scroll-spy) · NEW-M4-r1 (Minor, dynamic card structure) |
| Backlog (cross-repo) | Unchanged |

**MASTER PASS verdict:** **GREEN with 1 medium investigation needed (UX-D-K scroll-spy)** and 1 minor render-path inconsistency (M-4-r1).

**Recommended next ships:**

- **v1.58.52** — re-fire UX-D-K IntersectionObserver lifecycle (Medium).
- **v1.58.53** — unify saved-research card render-path so dynamically-created cards use the structural `<span>+<time>` template (Minor).

---

*Filed per `qa/REGRESSION-FINAL.md` doctrine. Save to `qa/v54-regression/2026-05-19-REGRESSION.md`.*
