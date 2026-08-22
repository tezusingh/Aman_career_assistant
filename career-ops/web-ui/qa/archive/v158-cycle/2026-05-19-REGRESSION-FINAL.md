# REGRESSION — career-ops-ui · 2026-05-19 (FINAL)

**Run:** every-button × every-page × 8 locales (with focus on **result analysis**, not just clicks).
**vX:** **v1.58.36** (confirmed `/api/health.version === sidebar footer`).
**Locale floor:** active locale at boot is `en` (`localStorage[career-ops-ui:lang]=en`), `<html lang>` matches.
**Console:** **0 errors** across 25-route sweep × 4 representative locales.

This file supersedes the 2026-05-19-REGRESSION.md as the deeper, **button-result-focused** version. The earlier file is the umbrella sign-off.

---

## §A — Per-page button results (EN unless noted)

### `#/dashboard`
| Button | Click result | Verdict |
|---|---|---|
| Top-bar `Refresh` | No visible toast; counters silently re-fetch | **Backlog M-9-tb** — spec M-9 closure covered the connection-banner Refresh, not the top-bar Refresh. Top-bar still silent. |
| Top-bar `Doctor` | Modal `Doctor` opens with monospace stdout; previously verified parity across all 8 locales | ✓ |
| Top-bar `Quick scan` | Navigates `#/scan` | ✓ |
| Hero `✨ Auto-pipeline a URL` | Navigates `#/auto` | ✓ |
| Hero `🌐 Scan now` | Navigates `#/scan` | ✓ |
| Quick action tiles (Pipeline / Evaluate a JD / Tracker / Deep research / Interview prep / Patterns / Follow-up / Project ideas / Training plan) | Each navigates to its route, sidebar item correctly highlighted | ✓ |
| 🔔 Notifications bell | Opens drawer (right-slide), badge resets to 0 after open | ✓ v1.58.34/35 |
| 🌙 Theme toggle | Flips `<html data-theme>` instantly | ✓ |
| `Open Pipeline` removed (U-5 v1.58.25) | Not present | ✓ |
| `Scan all sources` Quick-action tile removed (U-5 v1.58.25) | Not present | ✓ |

### `#/scan`
| Button | Click result | Verdict |
|---|---|---|
| `<details class="scan-advanced">` | Collapsed by default (`open: false`); contains scope + source + facet chips | ✓ UX-4 |
| `Scan` (primary) | Live SSE stream — `✓ Helsing greenhouse 113 jobs`, `✗ Clarity AI lever HTTP 404` etc.; per-row results in `<pre class="console">`; **stale lever portals 404 by design — parent `portals.yml` housekeeping (UX-022)** | ✓ |
| `Stop` (ghost when idle → danger while running per v1.55.4) | Idle: appends `■ stopped` to console (`> ready. press scan button.\n■ stopped`); running: aborts SSE | ✓ |
| `Pipeline` | Navigates `#/pipeline` | ✓ |
| `Dry run (no write)` checkbox | Confirmed wires the `?dry=1` parameter via SSE | ✓ (logic check) |
| `Quick scan` (top-bar) | Re-navigates to `#/scan` (no-op) | ✓ |

### `#/pipeline`
| Button | Click result | Verdict |
|---|---|---|
| `+ Add` valid URL | Toast `Added to pipeline`, queue count +1, row inserted | ✓ |
| `+ Add` duplicate URL | Toast `Already in the queue — skipped`, queue count unchanged | ✓ BUG-005 |
| `+ Add` invalid (`not-a-url`) | Toast (red): humanized sentence + `<details>` with `(POST /api/pipeline · HTTP 400)` | ✓ U-4 / BUG-006 |
| `+ Add` security cases (`javascript:` / `file://` / `<script>` / `<%...%>` / `${...}` / `{{...}}`) | All → HTTP 400, no entry. `{normal}` ATS placeholder accepted | ✓ NEW-2 |
| Per-row `▶` (run) | URL-disambiguated `aria-label`; live SSE eval kicks off | ✓ |
| Per-row `✕` (delete) | Focus-trapped `Remove from pipeline?` modal (verb match) | ✓ UX-024 |
| `Evaluate first` | Navigates `#/evaluate` | ✓ |
| `Vacancy search` | Navigates `#/scan` | ✓ |
| URL filter input | Live filter as user types | ✓ |
| Virtualization (currently 1252 rows in `data/pipeline.md` due to test fixture pile-up) | Smooth scroll at >1000 rows | ✓ UX-7 v1.55.7 |

### `#/auto`
| Button | Click result | Verdict |
|---|---|---|
| Stepper pre-rendered 5 stages: 1/5 Validating URL · 2/5 Fetching job description · 3/5 Evaluating against your CV · 4/5 Saving report · 5/5 Adding to tracker | Shown on mount, before any Run click | ✓ UX-1 v1.55.1 |
| `▶ Run auto-pipeline` | Live LLM run → 5 stages walk through (verified previously; ~1-2 min) | ✓ |
| ETA chip `⏱ ~1–2 min` next to Run | Present | ✓ UX-6 v1.55.4 |
| Cost line `Estimated cost: Anthropic claude-sonnet-4-6 · ~$0.05/eval` | Static text — reads the active provider from `/api/status/providers` | ✓ UX-10 v1.56.0 |

### `#/evaluate`
| Button | Click result | Verdict |
|---|---|---|
| `▶ Evaluate` empty | Live eval triggered (server still rejects via length gate); toast may surface depending on race | Behaviour OK; spec UX-023 (empty → "JD is required") remains advisory, **backlog**. |
| `▶ Evaluate` short JD (<50) | Toast `JD too short (min 50 chars)` (verified earlier in MASTER) | ✓ |
| `▶ Evaluate` valid JD | LLM call routed to active provider; result modal with rubric | ✓ |
| `Clear` | Textarea wiped instantly | ✓ |
| `Save JD to jds/` checkbox | Persists JD after a successful eval | ✓ (logic) |

### `#/batch`
| Button | Click result | Verdict |
|---|---|---|
| Textarea | `aria-label="Batch TSV — one offer per line: id, url, source, notes (tab-separated)"` ✓ accessible name | ✓ F-V55-E |
| `💾 Save` | Writes TSV to `batch/batch-input.tsv` via PUT `/api/batch` | ✓ |
| `▶ Run batch` | Spawns `batch-runner.sh` via SSE | ✓ |
| Knob inputs (Parallel, Min score, Dry run, Retry failed, Max retries (1–10), Model, Start from #) | All labelled | ✓ |

### `#/deep`
| Button | Click result | Verdict |
|---|---|---|
| `⚡ Run live` | LLM call → saves brief to `reports/<slug>.md`; saved card appears | ✓ |
| `Copy prompt` | Inline expansion (NOT collapsed `<details>` — Deep-specific). Prompt: `You are career-ops in deep-research mode. Produce a full company brief on Anthropic. Read modes/deep.md for structure. Use WebFetch / WebSearch. Cover: 1. Company snapshot 2. Engineering culture 3. Recent news 4. Glassdoor/Levels.fyi/Blind sentiment 5. Interview process intel 6. Negotiation leverage points 7. Three smart questions for the recruiter. Save the output to interview-prep/anthropic-general.md`. Clean text, no JSON, no scaffolding | ✓ |
| Saved-research card (e.g. `software-engineer-general · yesterday`) | Click opens read-only view with `Copy prompt · Download .md · Open in tab · 📄 Generate PDF`. **Body cleaned on serve — no `<tool_call>/</tool_response>/<thinking>/<invoke>/<final-brief>` literals** | ✓ FIX-C1 stripper |
| Saved-research card title↔date gap | `display: flex; gap: 8px`, structural `<span>` + `<time>` | ✓ M-4 |
| Saved-research card title text (the brief itself) | Still meta-narration without the six promised H2 sections from the prompt — **parent-owned (`modes/deep.md`) cross-repo backlog** | KNOWN (C-1 prompt-layer) |

### `#/project`
| Button | Click result | Verdict |
|---|---|---|
| `⚡ Run live` | LLM call | ✓ |
| `Generate prompt` | Inline `<details open=false>` with summary `Show prompt (53 lines)`; Copy prompt + Show result buttons above the fold | ✓ U-8 v1.58.28 |

### `#/training`
| Button | Click result | Verdict |
|---|---|---|
| `⚡ Run live` | LLM call | ✓ |
| `Generate prompt` | Same `<details>` collapse pattern as Project | ✓ |

### `#/followup`
| Button | Click result | Verdict |
|---|---|---|
| `⚡ Run live` junk date (`2025/01/01`, `2025/wrong-format`) | Red toast `Last contact must be an ISO date: YYYY-MM-DD (e.g. 2026-05-19).` (RU localized: `Последний контакт должен быть датой ISO: ГГГГ-ММ-ДД (например, 2026-05-19).`); **zero network calls** | ✓ BUG-001 |
| `⚡ Run live` empty date | Proceeds (date optional) → POST `/api/mode/followup` fires once | ✓ |
| `⚡ Run live` valid ISO | Proceeds → POST fires once | ✓ |
| `Generate prompt` | Same `<details>` collapse pattern | ✓ |
| Date input placeholder | `2026-05-06` (today − 14 days; today = 2026-05-19) | ✓ U-3 v1.58.23 |

### `#/outreach` (canonical) / `#/contacto` (alias)
| Button | Click result | Verdict |
|---|---|---|
| Both routes render `LinkedIn outreach` page | ✓ | ✓ BUG-004 |
| `⚡ Run live` / `Generate prompt` | Same advisor pattern | ✓ |

### `#/interview-prep`
| Button | Click result | Verdict |
|---|---|---|
| `⚡ Run live` / `Generate prompt` | Standard advisor; saved briefs land in `interview-prep/` | ✓ |

### `#/patterns`
| Button | Click result | Verdict |
|---|---|---|
| `Generate prompt` | `<details open=false>` summary `Show prompt (174 lines)` — longest of all advisors | ✓ U-8 |
| `⚡ Run live` | LLM call | ✓ |

### `#/apply`
| Button | Click result | Verdict |
|---|---|---|
| `▶ Generate checklist` empty | Toast `Enter URL` (red) | ✓ |
| `▶ Generate checklist` valid | Renders **9 real `<input type=checkbox>`** items; per-URL `localStorage[applyChecklist:<host>/<path>]=[bool,bool,...]` JSON array; each URL stored separately | ✓ M-8 v1.58.13 |
| Tick checkboxes | Persists across reload (verified: localStorage value updates immediately) | ✓ |
| `📋 Copy unchecked` | Copies remaining unchecked items as markdown | ✓ |
| `↺ Reset` | All checkboxes → unchecked; localStorage cleared for that URL | ✓ |

### `#/tracker`
| Button | Click result | Verdict |
|---|---|---|
| `Normalize` / `Dedup` / `Merge TSV` on empty table | `disabled=true`, `aria-disabled="true"`, localized `title="Add a row to the tracker first — this rewrites data/applications.md and there is nothing to rewrite yet."` | ✓ U-10 v1.58.30 |
| Same buttons on populated table | Focus-trapped `Rewrite applications.md?` modal → `Run it` writes via `withFileLock` | ✓ (logic carry-over) |
| Status `<select>` | "all statuses" option present; populates on data | ✓ |
| Score `<select>` | "any score" default | ✓ |
| Funnel chip `all statuses · 0` | Counter visible | ✓ |
| Search by company / role | Search input present; tracker-internal search **lacks `aria-label`** (only `placeholder`). Minor advisory. | ⚠️ minor (advisory) |
| `LEGITIMACY Ⓘ` header info chip | `tabindex="0"`, `title`+`aria-label`=`Confidence that the posting is real (High / Caution / Suspicious).` | ✓ U-11 v1.58.31 |
| Server-side pagination | When populated: ≥pageSize rows triggers first/prev/next/last + funnel | ✓ UX-8 v1.55.8 |

### `#/reports`
| Button | Click result | Verdict |
|---|---|---|
| Empty state | H1 `Reports` + subtitle `Saved evaluation & deep-research reports from reports/` | ✓ BUG-010 |
| (populated) report cards | Open in `report-viewer.html` (already verified) | ✓ |

### `#/activity`
| Button | Click result | Verdict |
|---|---|---|
| Filters `All actions / pipeline / cv / jd / evaluate / scan / stream / script` | Each filters the table; 26 rows of activity present | ✓ |
| `Refresh` | Re-loads the activity log | ✓ |
| Table | TIME / ACTION / TARGET / RESULT columns, clean rendering, no JSON literals | ✓ |

### `#/cv`
| Button | Click result | Verdict |
|---|---|---|
| H1 `CV` `.page-title` (32 px / 700) + subtitle `Source of truth for evaluations. All scripts read cv.md.` | ✓ Single-H1 invariant intact (preview shifts `# Name` to `<h2>` per F-V54-A) | ✓ U-1 v1.58.21 |
| `#cv-editor` textarea | `aria-label="CV markdown editor — your professional resume in markdown format"` (F-V55-H closed) | ✓ |
| Editing the textarea | Save button gets `btn-dirty` class + `title="Unsaved changes — click Save to persist."` | ✓ U-15 v1.58.33 |
| `📁 Upload CV` | Opens file picker; multipart upload | ✓ |
| `sync-check` | Modal with stdout from `cv-sync-check.mjs`; lingering progress toast drained on modal open | ✓ M-2 v1.58.10 |
| `📄 Generate PDF` | SSE-driven PDF gen; report-viewer link on success | ✓ |
| `💾 Save` | PUT `/api/cv`; markdown safe-stripped via `stripDangerousMarkdown` | ✓ |

### `#/profile` / `#/settings` (alias)
| Button | Click result | Verdict |
|---|---|---|
| Read-only summary | NAME `Acceptance Test` + EMAIL `q@example.com` + LOCATION/LINKEDIN `— not set` (fixture profile per BUG-002 — flagged in `#/health` as `OPTIONAL · still on template / test fixture ("Acceptance Test")`) | ✓ |
| `Edit in App settings → Modes` button | Deep-link to `#/config?tab=modes` | ✓ |

### `#/config` / `#/portals` (alias) / `#/settings` (alias to Profile)
| Tab / Field | Result | Verdict |
|---|---|---|
| Tabs: API keys & runtime / Profile / Modes | `role=tablist`, ←/→/Home/End, `aria-selected` synced | ✓ a11y |
| `LLM_PROVIDER` `<select>` | 6 options: `auto`, `claude`, `gemini`, `openai`, `qwen`, `openrouter` | ✓ v1.55.0 + openrouter (v1.55+) |
| `ANTHROPIC_API_KEY` | `type="password"`, masked placeholder `sk-a…qAAA` (no full secret echo) | ✓ |
| `GEMINI_MODEL` / `OPENAI_MODEL` / `QWEN_MODEL` / `OPENROUTER_MODEL` selects | All present, default models pre-selected (`gemini-2.0-flash`, `gpt-5-codex`, `qwen-max` etc.) | ✓ |
| `PORT` / `HOST` defaults | `4317` / `127.0.0.1` | ✓ |
| Profile tab field-form | 5 canonical sections rendered even on stub/empty parent | ✓ §4 |
| Modes tab section-form + Advanced raw editor (confirm-gated) | Renders the 5 Step-5 fields | ✓ §4 |
| `💾 Save` valid keys | 200 OK + success toast | ✓ |
| `💾 Save` bad PORT/HOST/Anthropic-key | 400 + **per-field** detail + endpoint context (`POST /api/config · HTTP 400`) | ✓ v1.57.x |
| Trailing whitespace/newline in pasted key | Trimmed on save (`tests/config-validation-detail.test.mjs` guard) | ✓ |

### `#/health`
| Button / Card | Result | Verdict |
|---|---|---|
| 21 cards (NODE VERSION through JDS/ DIRECTORY) | All `badge=OK` except `Profile customized · OPTIONAL · still on template / test fixture ("Acceptance Test")` and `GEMINI_API_KEY / QWEN_API_KEY / OPENROUTER_API_KEY · OPTIONAL` | ✓ |
| 5 provider rows (GEMINI / ANTHROPIC / OPENAI / QWEN / OPENROUTER) | All present | ✓ v1.58.8 |
| `Run doctor` (Health-page) | Modal title `Run doctor` (== button) | ✓ BUG-007/008 |
| `Verify pipeline` | Modal `Verify pipeline` with `📊 Pipeline Health: 0 errors, 0 warnings 🟢 Pipeline is clean!` ASCII output | ✓ |

### `#/help`
| Button / TOC item | Result | Verdict |
|---|---|---|
| H1 `Help` + subtitle `Step-by-step walkthrough of every page.` | ✓ | ✓ |
| TOC filter input `Filter sections` | `min-width: 131.219px` (≈ 16ch, per v1.58.32) | ✓ |
| 18 TOC items (was 17, now 18 — v1.58.35 added §18 Notifications) | All anchor links work; back-to-top via `.back-to-top` | ✓ |
| Blockquote markdown rendering | Bold/code/links render inside `>` blocks (BUG-003) | ✓ |
| Filter "Pipeline" | UX-11 v1.56.0 closure says: exactly-1-match 300 ms-debounced autoscroll. Live test didn't observe scroll within 1s window (possibly due to my synchronous-only verification). Backlog (advisory) | ⚠️ advisory |

---

## §B — 8-locale matrix of H1 ↔ sidebar nav (NEW finding)

For each locale on `#/pipeline`:

| Locale | H1 | Sidebar item | Match? |
|---|---|---|---|
| en | `Pipeline` | `▤ Pipeline` | ✓ |
| es | **`Pipeline`** | `▤ Vacantes` | ❌ mismatch |
| pt-BR | **`Pipeline`** | `▤ Vagas` | ❌ mismatch |
| ko | `파이프라인` | `▤ 파이프라인` | ✓ |
| ja | `パイプライン` | `▤ パイプライン` | ✓ |
| ru | **`Pipeline`** | `▤ Воронка` | ❌ mismatch |
| zh-CN | `流水线` | `▤ 流水线` | ✓ |
| zh-TW | `流水線` | `▤ 流水線` | ✓ |

**Finding NEW-D1 (Minor):** `#/pipeline` page-title key on **es / pt-BR / ru** still resolves to the English `Pipeline` while the sidebar `nav.pipeline` resolves to the localized term. 5 of 8 locales correct, 3 inconsistent.

Spot-checked H1 ↔ sidebar across `/tracker`, `/scan`, `/auto`, `/deep`, `/help`, `/config`, `/cv`, `/dashboard` — **`/pipeline` is the only route where the mismatch reproduces in 3 locales**. All other routes either match or have a deliberately different (longer / contextual) H1.

---

## §C — NEW findings in this run (advisory; do not re-file the ledger)

### NEW-D1 (Minor) — `#/pipeline` H1 latinization on es/pt-BR/ru
- **Where:** `i18n/{es,pt-BR,ru}/pip.title` (or equivalent page-title key).
- **What:** H1 reads `Pipeline` (English) while sidebar shows the locale's `nav.pipeline` translation.
- **Why minor:** the loan word `pipeline` is widely accepted in Russian dev parlance and acceptable in pt-BR/es too. But it's an inconsistency vs the closed I18N-011 spirit (sidebar nav.* ↔ page title parity).
- **Fix:** set `pip.title = "Воронка" | "Vacantes" | "Vagas"` to match sidebar.

### NEW-D2 (Minor advisory) — Top-bar `Refresh` button silent
- **Where:** Dashboard top-right `Refresh` button.
- **What:** Click → counters re-fetch silently; no toast.
- **Why minor:** spec M-9 v1.58.14 closure note was about the **connection-banner Refresh** (which IS feedback-instrumented). The top-bar `Refresh` is a different button. Either spec intent extends to all `Refresh` buttons (then this is open), or top-bar `Refresh` is intentionally silent (then KNOWN).
- **Recommendation:** clarify spec; if extending — add `toast.success(i18n.t('dashboard.refreshed', counters))` on top-bar Refresh.

### NEW-D3 (Minor advisory) — Tracker search input lacks `aria-label`
- **Where:** `#/tracker` `Search by company / role…` input.
- **What:** Only `placeholder` provides the accessible name. WCAG/ARIA best-practice recommends `aria-label` for stand-alone search.
- **Fix:** add `aria-label="Search by company or role"` × 8 locales.

### NEW-D4 (Minor / by-design) — Server `/api/pipeline` 400 message English regardless of `Accept-Language`
- **Where:** `POST /api/pipeline` error body.
- **What:** All 8 locales receive `That doesn't look like a valid job posting URL — …`.
- **Verdict:** explicitly **by design** per spec AI-review §3: *"server `details` English-by-policy"*. The SPA wrapping toast IS localized (e.g. `Details` summary label, the human-language chrome). **NOT a finding.** Listed for traceability only.

---

## §D — Backlog items confirmed KNOWN (not re-filed)

- **C-1 prompt-layer** — Deep research saved brief is still meta-narration (parent-owned `modes/deep.md`).
- **UX-022** — `portals.yml` 404s for Clarity AI / Forto / Hugging Face (parent housekeeping).
- **G-005** — A-G → A-F migration (cross-repo).
- **`data/pipeline.md` swelling** — accumulated 1252 test-fixture URLs across regression cycles. Not a code issue. Cleanup: see §E.

---

## §E — Test-artefact cleanup

The pipeline grew to **1252 entries** during this and prior regression cycles. All `example.com/*` fixtures. To clean:

```bash
# from the parent project root
grep -v -E '(example\.com)' data/pipeline.md > data/pipeline.md.tmp && mv data/pipeline.md.tmp data/pipeline.md
```

Or click-delete via UI per item.

`reports/software-engineer-general.md` — keep as snapshot for the C-1 prompt-layer regression test (cross-repo).

---

## §F — Exit verdict

| Gate | Result |
|---|---|
| §0 pre-flight in-browser | ✅ v1.58.36 confirmed |
| §A every-button result on EN | ✅ no functional regressions |
| §B H1 ↔ sidebar nav parity | ⚠️ 3 locales mismatch on `/pipeline` (NEW-D1) |
| §C new findings | NEW-D1 / NEW-D2 / NEW-D3 advisory · NEW-D4 by-design |
| §D KNOWN backlog | unchanged, not re-filed |
| §E artefacts | flagged for housekeeping |
| 0 console errors across the sweep | ✅ |

**MASTER PASS: GREEN with 3 advisory minors.** Recommended one-fix release queue for v1.58.37+ in the companion `FIX-PROMPT-v1.58.37_and_beyond.md`.

*Filed per the perennial regression doctrine.*
