# career-ops-ui v1.14.0 vs career-ops.org/docs — Conformance Audit

**Date:** 2026-05-13  ·  **Reference docs (read 2026-05-13):**

1. <https://career-ops.org/docs> — Quick Start (7 steps from clone → first eval)
2. <https://career-ops.org/docs/introduction/what-is-career-ops> — product philosophy
3. <https://career-ops.org/docs/introduction/guides/scan-job-portals> — `portals.yml` + scan options
4. <https://career-ops.org/docs/introduction/guides/apply-for-a-job> — `/career-ops apply {company}` workflow
5. <https://career-ops.org/docs/introduction/guides/batch-evaluate-offers> — batch flow
6. <https://career-ops.org/docs/introduction/guides/set-up-playwright>

## Scope

This audit is structural: does the UI expose the same data model, the same commands, the same workflow promises, and the same scoring rubric as the canonical CLI? It does not run live scans / live LLM calls (covered in the earlier v1.14 regression report).

---

## Verdict per docs section

### `what-is-career-ops` — philosophy

| Doc claim | UI status |
|---|---|
| "Open source, no paid tier, no telemetry" | ✓ matches — single-tenant on loopback, no outbound analytics |
| "AI-agnostic; runs on Claude / Codex / OpenCode / Gemini / Qwen / Copilot" | ⚠ partial — UI hard-codes `ANTHROPIC_API_KEY` + `GEMINI_API_KEY` only. No surface for Codex / OpenCode / Qwen / Copilot CLIs |
| "Six-dimension scoring rubric" | ⚠ help text claims six dimensions; evaluate prompt emits seven blocks A-G (mismatch — see G-005 below) |
| "Data never leaves your machine unless you push it" | ✓ matches |

### `docs` (Quick Start, 7 steps)

| Step | Doc says | UI status |
|---|---|---|
| 1 — Clone | `git clone …; cd career-ops; npm install; npx playwright install chromium` | ✓ Bootstrap covered by `bin/start.sh` and Health gates |
| 2 — Verify | `npm run doctor` | ✓ Doctor button in header → `/api/run/doctor` → streams `doctor.mjs` |
| 3 — Profile | edit `config/profile.yml` with `full_name`, `email`, `location`, `target_roles.primary`, `compensation.target_range`, `narrative.headline` | ⚠ **schema mismatch** — see G-005 / G-009 below |
| 4 — CV | put markdown in `cv.md` | ✓ `#/cv` editor |
| 5 — Target role types | `cp modes/_profile.template.md modes/_profile.md`, edit | ❌ **gap** — UI has NO editor / viewer for `modes/_profile.md`. Only the legacy `config/profile.yml` view is present (see G-008) |
| 6 — Open AI assistant | `claude` / `codex` / `opencode` / `qwen` | n/a (UI is alternative UX, not replacing the CLI) |
| 7 — Evaluate | paste URL or text into CLI; auto-pipeline runs end-to-end (~1–2 min) | ⚠ **UX gap** — UI requires Pipeline → Evaluate → Save → PDF as separate steps. No "paste URL → full report + tracker row + PDF in one click" path (see G-007) |

### `guides/scan-job-portals`

| Doc says | UI status |
|---|---|
| `portals.yml` has `title_filter` (`positive`, `negative`, `seniority_boost`) | ⚠ our help/scaffold mention `positive` / `negative` but NOT `seniority_boost` (see G-010) |
| `tracked_companies` with `name, careers_url, api, enabled` | ✓ matches `/api/portals` shape |
| `search_queries` section with `name, query, enabled` | ❓ partially — workspace `portals.example.yml` not in web-ui; need to check parent. Help mentions `russian_portals.queries` only |
| **Option A:** `npm run scan` (script, ~30s, no AI tokens, only Greenhouse/Ashby/Lever) | ✓ exposed in help.en.md §7 lines 565-573, and `/api/run/scan` route |
| **Option B:** `/career-ops scan` (Claude CLI, browser-based, also runs `search_queries`) | ✓ exposed in help.en.md §7 lines 575-578 — but **the in-process scanner at `/api/stream/scan` is Option A only**. Option B is documented as CLI-only |
| **Flags:** `--dry-run`, `--company <name>` | ✓ `#/scan` UI has both: Dry-run checkbox + Company dropdown |
| Output summary: "Companies scanned / Total jobs found / Filtered by title / Duplicates skipped / New offers added" | ✓ SSE log shows these — confirmed in live scan during regression |
| **Score → action thresholds** (4.5+ apply / 4.0-4.4 apply or contacto / 3.5-3.9 deep first / <3.5 skip) | ✅ EXACTLY MATCHED in `public/js/views/reports.js:94-109` |

### `guides/apply-for-a-job`

| Doc says | UI status |
|---|---|
| `/career-ops apply {company}` opens browser via Playwright, reads form, returns numbered answers per field | ❌ **UI does NOT** — `#/apply` only generates a static checklist text. The browser-driven form-reading is CLI-only by design (`server/lib/routes/llm.mjs:37` comment: "auto-pipeline intentionally stays off this UI") |
| Output structure: `1. Field — answer` per field, then `Key notes` block | ❌ not implemented in UI — `/api/apply-helper` returns `{ checklist, message }` (static guidance) |
| Upload field hint: use `/career-ops pdf` first | ⚠ #/apply page DOES show Playwright setup link (PR-9 follow-up) but no inline PDF prompt |
| Submit step: user confirms `"Submitted."` and tracker auto-updates to `Applied` | ⚠ no auto-status-flip in UI; user must edit tracker row manually |

### `guides/batch-evaluate-offers`

| Doc says | UI status |
|---|---|
| TSV file `batch/batch-input.tsv` with columns `id, url, source, notes` | ✓ `#/batch` SPA has TSV editor (v1.13.0) |
| `./batch/batch-runner.sh --dry-run` | ✓ Dry-run checkbox |
| `./batch/batch-runner.sh --parallel N` (1/2/3) | ✓ Parallel select (1/2/3) |
| `./batch/batch-runner.sh --min-score 4.0` | ✓ Min-score input |
| `./batch/batch-runner.sh --retry-failed` (`--max-retries 3`) | ✓ Retry checkbox |
| `node merge-tracker.mjs` (and `--dry-run`) | ✓ `POST /api/batch/merge` endpoint |
| Output: `reports/` files + `batch/tracker-additions/` one-liners | ✓ pending additions list visible on `#/batch` |

### `guides/set-up-playwright`

| Doc says | UI status |
|---|---|
| `npm install` (already covered) | n/a |
| `npx playwright install chromium` | ✓ Health page calls this out; `#/apply` links to canonical doc |
| `claude mcp add playwright npx @playwright/mcp@latest` (one-step MCP register) | ⚠ help has the link but no copy-paste button — minor UX polish |
| "watch-mode" instruction: `/career-ops apply {company} open up with playwright the browser and fill out the entire form` | ❌ not in UI (CLI-only); but #/apply could surface as a "Run in CLI" hint |

---

## New conformance findings (G-005 … G-010)

### G-005 · Evaluate block structure diverges from canonical A-F → A-G with shifted semantics · MAJOR

**Doc says** (quick-start §Reading-your-results):

> Block A — plain-English role summary
> Block B — CV match table with gaps
> Block C — **strategy recommendation**
> Block D — compensation research
> Block E — **personalization notes**
> Block F — **STAR stories** tailored to the job

**Our prompt emits** (per `docs/help/<locale>.md` §9 Evaluate, and the saved reports):

> A. Role Summary
> B. CV Match
> C. **Risks**  ← shifted: doc has Strategy
> D. Compensation
> E. **Application Strategy**  ← shifted: doc has Personalization
> F. **Verdict**  ← shifted: doc has STAR stories
> G. **Posting Legitimacy**  ← extra block, not in docs

**Impact:** anyone arriving from career-ops.org and opening a report expects Block C = strategy, but gets risks. Block F = STAR stories the user can paste into cover letters — but our F is just a 0–5 score. This is a structural divergence that breaks the canonical promise.

**Fix:** realign the `oferta.md` prompt to match the canonical A-F. Either:
- (a) Adopt canonical A-F verbatim: re-key C → Strategy, E → Personalization, F → STAR stories. Move Risks into A or C. Move Verdict (score) into the report header. Move Posting Legitimacy into a sidebar tag (already done on `#/reports` cards).
- (b) Document the divergence explicitly in `docs/career-ops-canonical.md` and the help bundles, so users know "career-ops-ui adds a Verdict and Legitimacy block on top of the canonical six".

I'd recommend (a). Reports written today won't match the docs language even though both call themselves "career-ops".

### G-006 · `Legitimacy` column missing from `#/tracker` (it IS in `#/reports`) · MINOR

**Doc says** (scan-job-portals §pipeline-output): batch table shows `# | Company | Role | Score | Legitimacy`.

**Our tracker columns** (`public/js/views/tracker.js`): `# | Date | Company | Role | Score | Status | PDF | Report`. No Legitimacy.

`reports.js:59` HAS legitimacy as a tag on each report card. The data exists. Just thread it into the tracker row JSON and the table header:

```js
// public/js/views/tracker.js
c('th', null, t('track.col.legitimacy', 'Legitimacy')),
// ...
c('td', null, r.legitimacy
  ? c('span', { className: 'badge ' + legitimacyClass(r.legitimacy) }, r.legitimacy)
  : ''),
```

Server-side `/api/tracker` already serializes whatever `data/applications.md` row contains — verify it includes a Legitimacy column and surface it.

### G-007 · No 1-click auto-pipeline flow (paste URL → full report + tracker row + PDF) · MAJOR (UX promise)

**Doc says** Quick Start §Step-7:

> "career-ops detects that you shared a job posting and runs the full pipeline automatically. This is called the auto-pipeline."
>
> Reads JD → Reads CV → Scores → Writes report → Generates PDF → Adds tracker row. All in one command.

**Our UI requires three separate clicks across two pages:**

1. `#/pipeline` paste URL + Add
2. Click ▶ Evaluate (jumps to `#/evaluate`)
3. Manually click 💾 Save report
4. Manually click 📄 Generate PDF
5. (No auto tracker row — user must click Add to tracker afterward)

**Fix:** add a "✨ Auto-pipeline" button on `#/pipeline` and `#/dashboard`, plus a global shortcut (Ctrl+K). On click:

```js
// new server endpoint, mirrors the parent CLI auto-pipeline flow
POST /api/auto-pipeline { url }
  → 1. fetch JD via SSRF-safe proxy
  → 2. POST /api/evaluate { jd, save: true }
  → 3. POST /api/pdf/inline { markdown: report }
  → 4. POST /api/tracker { company, role, score, status: 'Evaluated', reportSlug, url }
  → return { reportSlug, pdfPath, trackerRow } as SSE stream

// front-end
showModal('Auto-pipeline running…', sseLogPane);
// on done: navigate to /#/reports/<slug>
```

This is the single biggest doc-vs-product gap. Users come from the docs expecting "paste URL → done" and find a 3-page workflow.

### G-008 · `modes/_profile.md` (the most user-edited file per docs §Step-5) has no UI surface · MAJOR

**Doc says** the file `modes/_profile.md` is *the most important place users edit* — it contains:

- Your Target Roles
- Your Adaptive Framing (which projects to highlight per role)
- Your Exit Narrative (career story used in cover letters)
- Your Comp Targets
- Your Location Policy

> "Important: `modes/_profile.md` is never saved to version control. It is safe to put personal details, salary expectations, and career notes in it."

**Our UI exposes `config/profile.yml` (`#/profile` view + `#/config → Profile` editor).** There is no view for `modes/_profile.md` — and from `#/profile` you would never know it exists.

**Fix:**

```
#/profile → add a second card "Career framing (modes/_profile.md)"
            with a read-only preview and "Edit in #/config → Modes tab" link

#/config → add a new tab "Modes" alongside (API keys / Profile)
            • textarea bound to GET /api/modes/_profile (PUT to save)
            • plain markdown editor — file is sensitive, no YAML validation
```

Server side:

```js
// server/lib/routes/content.mjs — add modes/_profile.md endpoints
app.get('/api/modes/profile', (req, res) => {
  const raw = readFileSync(path.join(parentRoot, 'modes', '_profile.md'), 'utf8');
  res.json({ markdown: raw });
});
app.put('/api/modes/profile', (req, res) => {
  // 256 KB cap, atomic write to modes/_profile.md
});
```

Also: scaffold `modes/_profile.md` from `_profile.template.md` if missing (mirror what `bin/start.sh` already does for `cv.md` etc).

### G-009 · profile.yml field names diverge from canonical docs · MINOR

**Doc says:**

```yaml
full_name: ...
email: ...
location: ...
target_roles:
  primary: ...
compensation:
  target_range: "$120K-160K"
narrative:
  headline: "One sentence..."
```

**Our schema** (from runtime probe):

```yaml
candidate:
  full_name: ...
  email: ...
  linkedin: ...
target:
  roles: [...]
  comp_total_min_usd: 120000
  archetypes: [...]
```

The two are compatible enough that the UI works, but a user who reads the docs first and copies their YAML straight will land an "invalid profile" toast.

**Fix:** either rename our schema to match the docs (preferred — they're the canonical), or document the divergence in `#/config → Profile` tab hint text. If renaming: keep a one-version migration shim that reads either shape.

The bigger nudge — add `location` and `narrative.headline` to the read-only `#/profile` summary card. Both are referenced by cover-letter / outreach generation and surface nowhere today.

### G-010 · `title_filter.seniority_boost` not documented in our help / scaffold · MINOR

**Doc says** `portals.yml::title_filter` has three keys: `positive`, `negative`, **`seniority_boost`** (keywords that don't filter but rerank).

**Our help bundles** (`docs/help/<locale>.md` §5) only describe `positive` and `negative`. Our `portals.yml::tracked_companies` scaffold doesn't include a `seniority_boost` example.

**Fix:** update §5 of each of the 8 help bundles, and add `seniority_boost: ["Senior","Staff","Lead"]` to the scaffold template emitted by `bin/start.sh` when bootstrapping a fresh `portals.yml`.

---

## Cross-locale conformance (all 8)

The structural points above are bundle-agnostic — they affect the API + schemas, not the strings. The string-level audit was covered in the v1.14 regression (Scenarios 17, 18, 23 — all GREEN). Re-running the structural fixes does not require per-locale work, except:

- G-005 (block re-key): each of 8 help bundles must update §9 to show A-F (not A-G) with the canonical labels.
- G-006 (Legitimacy column): the `track.col.legitimacy` i18n key needs translations in 8 bundles.
- G-008 (modes UI): `config.modesTab`, `modes.profileTitle`, `modes.profileHint` — 3 new i18n keys × 8 locales.
- G-010 (seniority_boost): each help §5 needs the new bullet + example.

---

## Status summary

| ID | Title | Severity | Action |
|---|---|---|---|
| G-005 | Evaluate Block A-G vs canonical A-F | Major | rewrite `modes/oferta.md` to canonical schema; update help §9 in 8 locales |
| G-006 | No Legitimacy column on `#/tracker` | Minor | thread `r.legitimacy` into tracker.js + i18n |
| G-007 | No 1-click auto-pipeline (3 clicks today vs canonical 1) | Major | new `POST /api/auto-pipeline` + button on `#/pipeline` + `#/dashboard` |
| G-008 | `modes/_profile.md` has no UI surface | Major | new `#/config → Modes` tab + read-only card on `#/profile` |
| G-009 | profile.yml schema diverges (location, narrative.headline missing; compensation.target_range vs comp_total_min_usd) | Minor | migration shim + surface missing fields |
| G-010 | help §5 missing `seniority_boost` and `search_queries` schema docs | Minor | 8 locales help bundle edit + scaffold template |

Plus carried over from v1.14 regression:

- G-001 (was F-010 carryover) — `i18n.js::scan.noResults` still has "EN or RU scan" literal in 8 bundles
- G-002 (was F-015 carryover) — `📄 Generate PDF` missing on `#/interview-prep`
- G-003 — `README.cn.md` should be `README.zh-CN.md`
- G-004 (was F-018 carryover) — deprecated `/api/stream/scan-en` + `scan-ru` aliases still served (intentional v1.12, schedule removal for v1.15)

**10 still-open findings.** 7 minor, 3 major.

