# career-ops-ui — full-project regression prompt (v1.29.2)

> **Audience:** human QA, Claude Cowork browser agent, or any automated harness running against a live stand.
> **Scope:** every page, every endpoint, every documented invariant from **v1.6.0 baseline through v1.29.2** — the most-recent release.
> **Sister doc:** [`DOCS-COVERAGE-v1.29.md`](DOCS-COVERAGE-v1.29.md) is the top-down docs-driven coverage spec; this file is the bottom-up regression contract. Run both on every release.
> **Owner:** this file supersedes `REGRESSION-v1.29.md`, which superseded `REGRESSION-v1.27.md`. Evidence runs live under `qa/v29-regression/<run-date>-REGRESSION.md`.

---

## 0. Pre-flight — stand setup

Every cell below MUST pass before running the rest of the matrix.

```bash
# ─── version + health ───
curl -fsS http://127.0.0.1:4317/api/health | jq '{version, ok}'
# expected: { "version": "1.29.2" (or newer), "ok": true }

curl -fsS http://127.0.0.1:4317/api/health | jq '.checks | map(select(.required)) | all(.ok)'
# expected: true   (all required checks green)

# ─── SPA shell + tag ───
curl -fsS http://127.0.0.1:4317/ | grep -q '<title>career-ops-ui</title>' && echo "SPA shell OK"
git -C $WEB_UI describe --tags --abbrev=0
# expected: v1.29.2 (or newer)

# ─── v1.27.0 — sidebar dedupe (one `href="#/dashboard"` total) ───
curl -fsS http://127.0.0.1:4317/ | grep -c 'href="#/dashboard"'
# expected: 1

# ─── v1.28.1 — health row prune (no HH_USER_AGENT row) ───
curl -fsS http://127.0.0.1:4317/api/health | jq -r '.checks[].name' | grep -c HH_USER_AGENT
# expected: 0

# ─── v1.28.1 — router strips ?query (open in browser, MUST not 404) ───
#   http://127.0.0.1:4317/#/evaluate?url=https%3A%2F%2Fexample.com%2Fjd
#   http://127.0.0.1:4317/#/config?tab=modes
# Both must render the target view, NOT __not_found__.

# ─── v1.29.0 — source registry exposes 11 entries (6 EN ATS + 5 RU) ───
curl -fsS http://127.0.0.1:4317/api/scan/sources | jq '.sources | length'
# expected: 11

curl -fsS http://127.0.0.1:4317/api/scan/sources \
  | jq -r '[.sources[] | select(.region=="ru") | .value] | sort | join(",")'
# expected: geekjob,getmatch,habr-career,hh.ru,trudvsem

# ─── v1.29.0 — help-bundle parity at 17 H2 sections ───
for lc in en es pt-BR ko ja ru zh-CN zh-TW; do
  n=$(curl -fsS http://127.0.0.1:4317/api/help/$lc \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['markdown'].count('## '))")
  printf "%-6s : %d\n" "$lc" "$n"
done
# expected: every line ends in 17

# ─── v1.29.1 — help §5 RU-config user guide present in every locale ───
for lc in en es pt-BR ko ja ru zh-CN zh-TW; do
  ok=$(curl -fsS "http://127.0.0.1:4317/api/help/$lc" | python3 -c "
import sys, json
md = json.load(sys.stdin).get('markdown','')
print('YES' if 'sources: [\"hh\", \"habr\", \"trudvsem\", \"getmatch\", \"geekjob\"]' in md else 'NO')")
  printf "%-6s : %s\n" "$lc" "$ok"
done
# expected: every line ends in "YES"

# ─── v1.29.2 — multi-phase SSE: source=both emits TWO `done` events ───
curl -sN --max-time 60 "http://127.0.0.1:4317/api/stream/scan?source=both&dryRun=1" \
  | grep -c '"final":false'
# expected: 1   (EN phase emits done with final:false so client keeps stream open)

curl -sN --max-time 60 "http://127.0.0.1:4317/api/stream/scan?source=both&dryRun=1" \
  | grep -c '"final":true'
# expected: 1   (RU phase emits done with final:true so client closes)
```

If any pre-flight check fails — stop, fix, then run the matrix.

---

## 1. Smoke nav — every route loads (60 sec)

Visit every sidebar route + every mode page. For each: URL hash matches, `<h1.page-title>` rendered, 0 red console errors, screenshot.

| # | Route | v-gate | Expectation |
|---|---|---|---|
| 1  | `#/dashboard`        | v1.26.1 | counts cards + recent apps + 5 header buttons all ≥ 44 px (Doctor / Quick scan / Open Pipeline / 🌐 Scan now / ✨ Auto-pipeline) |
| 2  | `#/scan`             | **v1.29.0/2** | 🌐 Scan button + Active Companies card + chip filters + **11-entry source dropdown** + **both phases run (EN then RU) when clicked** |
| 3  | `#/pipeline`         | v1.28.1 | URL input + filterable list + preview pane + **▶ jumps to `#/evaluate?url=…` without 404** |
| 4  | `#/evaluate`         | v1.28.1 | JD textarea + ▶ Evaluate button — **query-prefill works (`?url=…`)** |
| 5  | `#/batch`            | v1.28.0 | TSV editor + 5 controls including **Max retries (numeric, 1-10)** |
| 6  | `#/reports`          | v1.24.0 | reports list + score-thresholds card (collapsible) |
| 7  | `#/tracker`          | v1.21.0 | sortable table over `data/applications.md` |
| 8  | `#/activity`         | v1.7.0  | audit-log table with timestamps |
| 9  | `#/cv`               | v1.22.0 | markdown editor + side-by-side preview + 📁 Upload + 📄 Generate PDF |
| 10 | `#/profile`          | v1.10.0 | read-only profile summary |
| 11 | `#/config`           | **v1.28.1** | API keys + Profile + Modes tabs — **`?tab=modes` deep-link works** |
| 12 | `#/health`           | v1.28.1 | required + optional checks — **HH_USER_AGENT row absent** |
| 13 | `#/help`             | v1.29.1 | **17-section** in-app guide in current locale — **§5 has the RU-config user guide, §17 has the developer guide** |

Mode pages (direct URL): `#/deep`, `#/apply`, `#/project`, `#/training`, `#/followup`, `#/contacto`, `#/interview-prep`, `#/patterns`.

Back-compat aliases (must resolve, not 404): `#/settings` → Profile; `#/batch-prompt` → legacy mode-builder with deprecation banner.

**v1.27.0 sidebar dedupe:** brand is `<div class="logo">`; exactly one `<a href="#/dashboard">` in served HTML.

**PASS** = 13 sidebar + 8 mode + 2 alias + all pre-flight gates green.

---

## 2. Per-page regression

### 2.1 Dashboard (`#/dashboard`)
- Counts (apps / pipeline / reports) match `data/applications.md` / `data/pipeline.md` / `reports/`.
- Avg score = `sum / count`, rounded to 1 dp.
- 8 status buckets shown.
- Recent applications: last 5 by date.
- Auto-pipeline button: `✨ Auto-pipeline a URL` (single ✨).
- All 5 header `.btn:not(.btn-sm)` ≥ 44 × 44 px (v1.26.1 floor).

### 2.2 Scan (`#/scan`) — v1.29.0 + v1.29.2 refresh
- **One** 🌐 Scan button (single button, not separate EN/RU).
- **v1.29.0 — source-filter dropdown is dynamic** (`GET /api/scan/sources` → registry). Expected entries (alphabetical, **11 total**):
  - Ashby · GeekJob · Greenhouse · GetMatch · Habr Career · hh.ru · Lever · SmartRecruiters · Trudvsem · Workable · Workday.
- Build-time fallback list survives if endpoint is unreachable.
- **v1.29.2 — multi-phase SSE.** Clicking 🌐 Scan triggers `GET /api/stream/scan?source=both`. SPA must show TWO phase headers, in order:
  1. `▶ ATS scan (Greenhouse + Ashby + Lever)` + EN log lines + `✓ ATS done · NEW=N`
  2. `▶ Regional scan (hh.ru + Habr Career)` + RU log lines + `✓ Regional done · NEW=M`
  - The pre-v1.29.2 bug was the RU phase silently dropped (client closed `EventSource` on first `done`). Regression contract: RU phase header MUST appear after EN phase done.
- Filters: Free text / Source (11 entries) / Remote-Hybrid-Onsite / Stack chips / Dynamic chips.
- Active Companies card: ✓ green tags for direct API support, ○ gray for fallback. Click name → fills results filter; ↗ icon → opens careers page.
- Stop button mid-scan aborts via `AbortController`.

### 2.3 Pipeline (`#/pipeline`)
- Add URL via form or Ctrl+K.
- URL passes `isValidJobUrl()`: localhost / 127.0.0.1 / file:// / javascript: / IP literals / template chars all 400.
- Server-side preview via `safeGet` (DNS-pinned, redirect-revalidated, 8 KB cap, 3 hops).
- ✕ removes from `data/pipeline.md`.
- **v1.28.1 ▶ button** (`Router.go('/evaluate?url=…')`) resolves to Evaluate view — NOT 404. Regression contract: the route resolver in [`public/js/router.js`](../public/js/router.js) strips `?query` before name lookup.
- 20 parallel POSTs → 20 sequential rows via `withFileLock` (v1.21 H-6).

### 2.4 Evaluate (`#/evaluate`)
- Paste JD → ▶ Evaluate.
- With Anthropic key → live, A-F sections.
- With only Gemini key → Gemini fallback.
- No key → manual prompt card.
- Save JD checkbox → `jds/jd-<date>-<ts>.txt`.
- **v1.28.1 query prefill:** `#/evaluate?url=https%3A%2F%2F…` parses URLSearchParams from hash and pre-fills the JD textarea with `URL: <href>\n\n[paste JD text here]`.

### 2.5 Reports (`#/reports`)
- Score-thresholds card (collapsible `<details>`).
- 4 rubric rows ≥4.5 / 4.0-4.4 / 3.5-3.9 / <3.5 with action text (i18n keys `rep.thr45 / thr40 / thr35 / thrLow`).
- Score-pill glyphs ✓ ◐ ○ (WCAG 1.4.1 redundant cue).
- Pagination 12/page.
- Detail view: ← All reports + 🔗 Open JD + 📄 Generate PDF.
- Outbound link to career-ops.org/docs.
- **Known drift (G-005):** report letters render BOTH legacy A-G and v1.15+ A-F (renderer is schema-tolerant).

### 2.6 Tracker (`#/tracker`)
- Columns: # / Date / Company / Role / Score / Status / PDF / Report / Notes.
- Status enum: Evaluated / Applied / Responded / Interview / Offer / Rejected / Discarded / SKIP.
- Filters: Status / Score (≥4.0, ≥3.0, <3.0) / Search.
- 25/page pagination.
- BF-1: `Acme | Co` (pipe), `Senior Backend\nEngineer` (newline) round-trip.
- ▶ Normalize / Dedup / Merge maintenance buttons.
- Concurrent POSTs serialize via `withFileLock`.

### 2.7 Activity log (`#/activity`)
- JSONL audit trail.
- Secrets redacted in payloads.
- Filter by action prefix; 25/page; ≤ 500 rows.

### 2.8 CV (`#/cv`)
- Markdown editor + live preview.
- 📁 Upload CV accepts `.md / .txt / .html / .pdf / .docx / .doc / .odt / .rtf`.
- 💾 Save runs `stripDangerousMarkdown` (entity-aware: `<script>`, `&lt;script&gt;`, `java&#115;cript:`, SVG-onload).
- Body cap 1 MB PUT / 11 MB upload (multer).
- 📄 Generate PDF streams Playwright; auto-downloads.

### 2.9 Profile (`#/profile` + `#/settings` alias)
- Read-only summary of `config/profile.yml`.
- Edit via `#/config → Profile tab`.
- Both URLs resolve to the same view (router alias).

### 2.10 App settings (`#/config`) — v1.28.1 refresh
- Three tabs: API keys / Profile / Modes.
- **v1.28.1 deep-link works:** `#/config?tab=modes` lands directly on Modes tab. Regression contract: router strips `?` BEFORE the route-name split.
- v1.24.1: no `c(...).also is not a function` on any locale.
- Save round-trip writes parent `.env` (API keys & runtime tab) or `config/profile.yml` (Profile tab) or `modes/_profile.md` (Modes tab).
- Secrets masked in GET response (`sk-ant•••••••a1b2`).

### 2.11 Health (`#/health`) — v1.28.1 refresh
- Required checks green: Node ≥ 18 / Project root / cv.md / config/profile.yml / portals.yml / data/applications.md / data/pipeline.md / modes/oferta.md.
- Optional: Profile customized / GEMINI_API_KEY / ANTHROPIC_API_KEY / Playwright / Parent project dependencies / data,reports,output,jds directories.
- **v1.28.1 — HH_USER_AGENT row absent.** Total `.checks` count ≥ 12 (was ≥ 13 pre-prune).
- ▶ Doctor + ▶ Verify pipeline buttons stream SSE.
- Footer: `version` (web-ui pkg) + `parentVersion` (parent VERSION file).

### 2.12 Help (`#/help`) — v1.29.x refresh
- **17 H2 sections** in current locale (was 16 pre-v1.29.0). CI gates: `tests/canonical-docs-coverage.test.mjs::17-H2 parity` + `tests/help-ui.test.mjs::17 sections`.
- 5 canonical career-ops.org URLs each appear ≥ 2 times.
- 21-step Getting Started walkthrough.
- **v1.28.0 — §intro AI-list canonical:** Claude Code / Codex / OpenCode / Qwen CLI + localized one-liner.
- **v1.29.0 — §17 "How to add a new job-portal source"** present in EN (full code template + mocked test pattern + portals.yml example); 7 locales have localized abridged version with universal code blocks and cross-link to EN canonical.
- **v1.29.1 — §5 carries the "Configuring Russian portals — detailed setup guide" ### subsection** in every locale: 5-row inventory table (`hh / habr / trudvsem / getmatch / geekjob` × type × auth × geo), 5-source YAML example, negative-list collision fix, disable-one-source snippet, verify-via-Scan workflow with the per-source SSE log shape. `HH_USER_AGENT` literal referenced.

### 2.13 Batch (`#/batch`) — v1.28.0 refresh
- TSV editor (4 cols: id / url / source / notes).
- 5 run controls (was 4): Parallel select (1/2/3) · Min score · Dry-run · Retry failed · **v1.28.0 Max retries (number 1-10, disabled until Retry failed checked)**.
- ▶ Run batch streams SSE.
- Server validates `maxRetries` int 1..10, silently drops out-of-range, no-op without `--retry-failed`.
- ▶ Merge button consumes `batch/tracker-additions/*.tsv`.
- Legacy `#/batch-prompt` resolves with deprecation banner.

### 2.14 Mode pages (`#/deep`, `#/project`, `#/training`, `#/followup`, `#/contacto`, `#/interview-prep`, `#/patterns`)
- Each renders form + ▶ Generate prompt + ⚡ Run live (when key present).
- Prompt download as `.md`.
- `#/apply` is NOT a mode page — it's an explicit checklist that mentions `/career-ops apply` + "never auto-submit" warning.

---

## 3. API endpoint regression — curl-driven

### 3.1 Health & dashboard
```bash
curl -fsS http://127.0.0.1:4317/api/health | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['ok'] is True
assert d['version'].startswith('1.')
assert not any(c['name'] == 'HH_USER_AGENT' for c in d['checks']), 'v1.28.1: HH_USER_AGENT row must be absent'
print('PASS')
"
```

### 3.2 Retired aliases (must 404)
```bash
for ep in /api/stream/scan-en /api/stream/scan-ru /api/scan-ru/config; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:4317$ep")
  [ "$status" = "404" ] || { echo "FAIL: $ep returned $status"; exit 1; }
done
echo "PASS — 3 legacy aliases retired"
```

### 3.3 Scan source registry (v1.29.0)
```bash
curl -fsS http://127.0.0.1:4317/api/scan/sources | python3 -c "
import sys, json
d = json.load(sys.stdin)
ru = sorted(s['value'] for s in d['sources'] if s['region'] == 'ru')
assert ru == ['geekjob', 'getmatch', 'habr-career', 'hh.ru', 'trudvsem'], f'RU mismatch: {ru}'
en = sorted(s['value'] for s in d['sources'] if s['region'] == 'en')
assert en == ['ashby', 'greenhouse', 'lever', 'smartrecruiters', 'workable', 'workday'], f'EN mismatch: {en}'
print('PASS — 11 sources surfaced')
"
```

### 3.4 Multi-phase SSE for `source=both` (v1.29.2)
```bash
# Two `start` events (en-scanner → ru-scanner), TWO `done` events
# (first final:false, second final:true). dryRun=1 keeps it fast.
out=$(curl -sN --max-time 60 "http://127.0.0.1:4317/api/stream/scan?source=both&dryRun=1")
starts=$(echo "$out" | grep -c '^event: start')
fdones_false=$(echo "$out" | grep -c '"final":false')
fdones_true=$(echo "$out" | grep -c '"final":true')
[ "$starts" = "2" ]        || { echo "FAIL: expected 2 start, got $starts"; exit 1; }
[ "$fdones_false" = "1" ]  || { echo "FAIL: expected 1 done(final:false), got $fdones_false"; exit 1; }
[ "$fdones_true" = "1" ]   || { echo "FAIL: expected 1 done(final:true), got $fdones_true"; exit 1; }
echo "PASS — source=both emits both phases correctly"
```

### 3.5 Path-traversal sweep (v1.21 H-4)
```bash
for name in '..' '...' '..pdf' '..%2fetc%2fpasswd'; do
  for ep in /api/jds /api/reports /api/modes /api/output/pdfs; do
    enc=$(printf '%s' "$name" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")
    status=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:4317${ep}/${enc}")
    [ "$status" = "400" ] || [ "$status" = "404" ] || { echo "FAIL: $ep/$name returned $status"; exit 1; }
  done
done
echo "PASS — path-traversal rejected"
```

### 3.6 SSRF reject
```bash
for url in 'javascript:alert(1)' 'file:///etc/passwd' 'http://127.0.0.1:22/' \
          'http://10.0.0.5/internal' 'http://169.254.169.254/latest/meta-data/' \
          'http://[::1]/internal' 'not-a-url'; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H 'Content-Type: application/json' -d "{\"url\":\"$url\"}" \
    http://127.0.0.1:4317/api/pipeline)
  [ "$status" = "400" ] || { echo "FAIL: $url → $status"; exit 1; }
done
echo "PASS — 7 SSRF / invalid-URL rejected"
```

### 3.7 Tracker round-trip (BF-1)
```bash
curl -fsS -X POST -H 'Content-Type: application/json' \
  -d '{"company":"Acme | Co","role":"Senior Backend\nEngineer","score":"4.2","status":"Evaluated"}' \
  http://127.0.0.1:4317/api/tracker | grep -q '"ok":true' && echo PASS
```

### 3.8 Auto-pipeline manual mode (v1.25.0 G-014)
```bash
t0=$(date +%s%N)
body=$(curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
  http://127.0.0.1:4317/api/auto-pipeline)
t1=$(date +%s%N)
elapsed=$(( (t1 - t0) / 1000000 ))
[ "$elapsed" -lt 2000 ] || { echo "FAIL: ${elapsed}ms"; exit 1; }
echo "$body" | grep -q '"mode":"manual"' || exit 1
echo "PASS — manual short-circuit in ${elapsed}ms"
```

### 3.9 CV XSS strip (v1.22 M-4)
```bash
curl -fsS -X PUT -H 'Content-Type: application/json' \
  -d '{"markdown":"# CV\n\n<script>evil()</script>\n[link](javascript:alert(1))\n&lt;script&gt;encoded&lt;/script&gt;"}' \
  http://127.0.0.1:4317/api/cv > /dev/null
curl -fsS http://127.0.0.1:4317/api/cv | python3 -c "
import sys, json
md = json.load(sys.stdin)['markdown']
for pat in ('<script', 'javascript:'):
    assert pat.lower() not in md.lower(), f'XSS leaked: {pat}'
print('PASS')
"
```

### 3.10 Help-bundle 5 URLs × 8 locales
```bash
fail=0
for lang in en es pt-BR ko ja ru zh-CN zh-TW; do
  md=$(curl -sS "http://127.0.0.1:4317/api/help/$lang" | python3 -c "import sys,json; print(json.load(sys.stdin).get('markdown',''))")
  for url in what-is-career-ops scan-job-portals apply-for-a-job batch-evaluate-offers set-up-playwright; do
    if ! echo "$md" | grep -q "$url"; then echo "FAIL: $lang missing $url"; fail=$((fail+1)); fi
  done
done
[ "$fail" = "0" ] && echo "PASS — 40/40"
```

### 3.11 Batch `--max-retries N` pass-through (v1.28.0)
Unit tests cover this comprehensively — see `tests/batch-max-retries.test.mjs` (7 cases: present / out-of-range upper / lower / non-int / without `retry=1` / no-param / combined-with-other-flags).

### 3.12 Sidebar dedupe (v1.27.0)
```bash
[ "$(curl -fsS http://127.0.0.1:4317/ | grep -c 'href=\"#/dashboard\"')" = "1" ] \
  && echo "PASS — 1 href=#/dashboard" || echo "FAIL"
```

### 3.13 Router query-string strip (v1.28.1) — open in browser
- `http://127.0.0.1:4317/#/evaluate?url=https%3A%2F%2Fexample.com%2Fjd` → renders Evaluate view with URL prefilled (NOT `__not_found__`).
- `http://127.0.0.1:4317/#/config?tab=modes` → lands directly on Modes tab.

### 3.14 RU adapter contract (v1.29.0)
Each of the 5 RU adapters (hh, habr, trudvsem, getmatch, geekjob) follows the common `{ id, title, company, url, salary, location, isRemote, workplaceType, relocates, date, snippet, source }` shape. Unit-tested with mocked transport:
- `tests/sources-trudvsem.test.mjs` — 6 cases.
- `tests/sources-getmatch-geekjob.test.mjs` — 11 cases.

---

## 4. Security envelope — invariants

### 4.1 CSP (on public bind only)
```bash
HOST=0.0.0.0 ... # start with public bind
curl -sSI http://127.0.0.1:4317/ | grep -i 'content-security-policy'
# Expected: script-src has NO 'unsafe-inline', NO 'unsafe-eval'; frame-ancestors 'none'
```

### 4.2 No inline event handlers
```bash
grep -rE 'on[a-z]+\s*=\s*"' public/index.html public/js/views/*.js | grep -v '//.*on'
# Expected: empty
```

### 4.3 `safeGet` is the only outbound HTTP path
```bash
grep -rn 'fetch(' server/lib/routes/pipeline.mjs server/lib/routes/auto-pipeline.mjs
# Expected: zero matches
```

### 4.4 `sanitizePathName` consolidated
```bash
grep -rE "replace\(.*\[\^\\\\w" server/lib/routes/
# Expected: only inside reports.mjs::sanitizeSlug
```

### 4.5 `withFileLock` wraps every R-M-W on applications/pipeline
```bash
grep -rB 2 -A 8 'writeFileSync.*PATHS\.\(applications\|pipeline\)' server/lib/routes/
# Expected: every write under withFileLock callback
```

### 4.6 `llmRateLimit` on every LLM endpoint
```bash
grep -E "app\.post.*llmRateLimit" server/lib/routes/llm.mjs server/lib/routes/auto-pipeline.mjs
# Expected: 4 routes — /api/evaluate, /api/deep, /api/mode/:slug, /api/auto-pipeline
```

### 4.7 `stripDangerousMarkdown` entity-aware
```bash
node -e "
import('./server/lib/security.mjs').then(({stripDangerousMarkdown}) => {
  for (const t of ['&lt;script&gt;alert(1)&lt;/script&gt;', 'java&#115;cript:alert(1)']) {
    const r = stripDangerousMarkdown(t);
    if (/<script|javascript\s*:/i.test(r)) { console.log('FAIL:', t); process.exit(1); }
  }
  console.log('PASS');
});
"
```

---

## 5. Accessibility regression (WCAG 2.2 AA)

### 5.1 Skip link (2.4.1)
Tab from page load: first focusable is a visible "Skip to main content" link; Enter jumps to `#content`.

### 5.2 Focus Visible (2.4.7)
Every focused control has ≥ 2 px outline, 3:1 contrast.

### 5.3 Target Size (2.5.5) — v1.26.1 PR-A
```js
// In DevTools, on every sidebar route:
Array.from(document.querySelectorAll('.btn:not(.btn-sm)'))
  .filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
  .length
// Expected on every route: 0
```
Static CSS canary in `tests/wcag-target-size.test.mjs` (4 cases: `.btn` carries `min-height: 44px` + `flex-shrink: 0`; `.btn-sm` keeps 32 px and follows `.btn` in source order).

### 5.4 Chip + nav-item + tab-btn targets (v1.20)
```js
['.chip', '.nav-item', '.tab-btn'].forEach((sel) => {
  const min = sel === '.chip' ? 28 : 44;
  console.log(sel, Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().height < min).length, '<', min);
});
// Expected: 0 on every line
```

### 5.5 Form labels (v1.20 + v1.21 H-2)
```js
Array.from(document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),textarea,select'))
  .filter(el => !el.labels?.length && !el.getAttribute('aria-label'))
// Expected: []
```

### 5.6 `aria-describedby` IDREFs resolve (v1.21 H-1)
```js
Array.from(document.querySelectorAll('[aria-describedby]'))
  .filter(el => !document.getElementById(el.getAttribute('aria-describedby')))
// Expected: []
```

### 5.7 `<html lang>` updates on locale switch
```js
document.documentElement.getAttribute('lang')
// = 'en' / 'ru' / etc. matching active locale
```

### 5.8 Color-only state has redundant cue (v1.22 M-3)
- `.score-high::before` content `'✓'`
- `.score-mid::before` content `'◐'`
- `.score-low::before` content `'○'`
- `.conn-banner ⚠` in offline state

### 5.9 Sidebar dedupe (v1.27.0)
Screen reader announces "Dashboard, link" exactly once when entering navigation landmark. Tab sequence visits Dashboard control once.

---

## 6. i18n regression — 8 locales × every page

### 6.1 Locale persistence
Click `.lang-btn[data-lang-btn="ru"]`; reload; UI still in Russian; `localStorage.getItem('career-ops-ui:lang') === 'ru'`.

### 6.2 Safari private mode (v1.22 M-5)
Safari → New Private Window → BASE_URL → SPA renders normally (NOT raw keys).

### 6.3 DICT coverage (CI gate)
```bash
npm test -- tests/i18n-coverage.test.mjs
# 5/5 pass
```

### 6.4 17-H2 parity per locale (v1.29.0 — was 16)
```bash
for f in docs/help/*.md; do echo "$f: $(grep -c '^## ' "$f")"; done
# Expected: every file → 17
```

### 6.5 §17 "How to add a portal" exists in every locale (v1.29.0)
```bash
for f in docs/help/*.md; do
  grep -q '^## 17\.' "$f" && echo "OK $f" || echo "FAIL $f"
done
```

### 6.6 §5 "Configuring Russian portals" exists in every locale (v1.29.1)
```bash
# Universal YAML marker — present in every locale's §5 expansion.
for f in docs/help/*.md; do
  grep -q 'sources: \["hh", "habr", "trudvsem", "getmatch", "geekjob"\]' "$f" \
    && echo "OK $f" || echo "FAIL $f"
done
```

### 6.7 AI-list canonical (v1.28.0)
```bash
for f in docs/help/*.md README*.md; do
  for x in OpenCode "Qwen CLI"; do
    grep -q "$x" "$f" || echo "FAIL: $f missing $x"
  done
done
# Expected: silent
```

### 6.8 CHANGELOG parity (v1.29.2)
```bash
node scripts/check-changelog-parity.mjs
# Expected: "✓ CHANGELOG parity: all 8 locales at v1.29.2"
```

---

## 7. Source registry & RU adapter contract (v1.29.0)

### 7.1 Registry shape
```bash
curl -fsS http://127.0.0.1:4317/api/scan/sources | jq '.sources[] | {value, label, region, configKey}'
# Every entry: value:string, label:string, region:'en'|'ru'; RU entries have configKey.
```

### 7.2 RU dispatcher honors registry
```bash
node --test tests/ru-scanner.test.mjs
# 11 / 11 pass
```

### 7.3 Per-adapter unit tests pass
```bash
node --test tests/sources-trudvsem.test.mjs tests/sources-getmatch-geekjob.test.mjs
# 17 / 17 pass
```

### 7.4 Adding a 12th adapter — documented flow
Help §17 (8 locales) covers the developer flow end-to-end (adapter file template, registry entry, dispatcher wiring, mocked unit test, portals.yml enablement). Help §5 (v1.29.1, 8 locales) covers the user-facing config flow for the 5 already-shipped adapters.

---

## 8. Multi-phase SSE contract (v1.29.2) — load-bearing

> The pre-v1.29.2 bug had user-visible severity: the RU scan phase silently failed every time `🌐 Scan` was clicked with `source=both`. This section locks the fix down.

### 8.1 Server contract
- [`server/lib/routes/scan.mjs::driveOne`](../server/lib/routes/scan.mjs) accepts a `final` param (default `true`). The `done` payload carries `final: <bool>`.
- The `source=both` branch passes `final: false` to the first phase, `final: true` to the second. Single-phase modes (`ats`, `regional`) always emit `final: true`.

### 8.2 Client contract
- [`public/js/api.js::stream`](../public/js/api.js) closes the `EventSource` on `done` only when `data.final !== false`.
- Close on `error` is unconditional.
- Backward-compatible: legacy single-phase producers (`/api/stream/batch`, `/api/stream/pdf*`, etc.) don't set `final`, so behaviour is unchanged for them.

### 8.3 Test gate
`tests/scan-stream-multi-phase.test.mjs` — 11 cases:
- 6 SSE contract (single-phase final:true, both-phase final:false then true, start ordering, 2 static api.js canaries).
- 3 functional (RU phase banner actually emitted, ru-scanner start AFTER en-scanner done, dryRun=1 doesn't write pipeline).
- 1 pure-logic close-decision table (parametrized over 11 input combinations).
- 1 bug-forensics (simulates pre-v1.29.2 client; verifies server's `res.on('close')` abort path still works).

### 8.4 Live probe
```bash
curl -sN --max-time 60 "http://127.0.0.1:4317/api/stream/scan?source=both&dryRun=1" \
  | grep -E '^event:|"final":'
# event: start                                        ← en-scanner phase 1
# event: log  …
# event: done
# data: {"code":0,"counts":{...},"errors":0,"final":false}    ← phase 1 done
# event: start                                        ← ru-scanner phase 2
# event: log  …
# event: done
# data: {"code":0,"counts":{...},"errors":0,"final":true}     ← phase 2 done (final)
```

---

## 9. Per-release regression checklist

Use to spot-check a release area after any merge that touches it.

### v1.18.0 — WCAG 2.2 AA + scan retirement
- [ ] Skip link (5.1) · Focus visible (5.2) · `.btn` ≥ 44 px (5.3) · `<html lang>` (5.7)
- [ ] `/api/stream/scan-{en,ru}` → 404 (3.2)

### v1.19.0 — contrast + HH_USER_AGENT off UI
- [ ] Badge / score colors ≥ 4.5:1 light + dark · HH_USER_AGENT NOT in `/#/config`

### v1.20.0 — per-component a11y + README parity
- [ ] `.chip` ≥ 28 / `.nav-item` ≥ 44 / `.tab-btn` ≥ 44 (5.4) · All inputs labelled (5.5)
- [ ] `/api/scan-ru/config` → 404

### v1.21.0 — security + concurrency + a11y
- [ ] `safe-fetch.mjs` (4.3) · `sanitizePathName` (4.4) · `withFileLock` (4.5) · `llmRateLimit` (4.6) · `aria-describedby` (5.6)

### v1.22.0 — M/L/N backlog
- [ ] Entity-aware XSS strip (4.7) · Score-pill glyphs (5.8) · `Element.prototype.also` gone

### v1.23.0 — i18n split + connection-banner recovery
- [ ] `i18n-dict.js` exists + i18n.js < 100 LOC · Banner auto-hides after recovery

### v1.24.0 / 1.24.1 — help content + G-015 fix
- [ ] 5 career-ops.org URLs ≥ 2× per locale · `/#/config` renders without `.also` error

### v1.25.0 — G-014 + G-012 + cosmetic
- [ ] Auto-pipeline `mode:'manual'` returns ≤ 2 s (3.8) · 8 CHANGELOGs at v1.25.0+ · `✨ Auto-pipeline a URL` single ✨

### v1.26.0 — test pyramid
- [ ] `tests/acceptance/` exists · `npm run test:ci` covers both CI gates · Coverage ≥ 93 line / ≥ 83 branch

### v1.26.1 — WCAG 2.5.5 hot-fix
- [ ] `.btn` carries `min-height:44px + flex-shrink:0 + line-height:1.2` · `tests/wcag-target-size.test.mjs` passes

### v1.27.0 — sidebar dedupe
- [ ] One `href="#/dashboard"` in HTML (3.12) · Brand renders as `<div class="logo">`

### v1.28.0 — Issue #1 AI-list + Issue #2 max-retries
- [ ] `#/batch` has 5th input "Max retries" (1-10, disabled until Retry failed)
- [ ] Help-bundle + READMEs intro names OpenCode + Qwen CLI; no "Cursor, Gemini CLI, GitHub Copilot CLI" string
- [ ] `tests/canonical-docs-coverage.test.mjs::AI-list canaries` pass
- [ ] `tests/batch-max-retries.test.mjs::7 cases` pass

### v1.28.1 — router 404 hot-fix + HH_USER_AGENT prune
- [ ] `#/evaluate?url=…` renders Evaluate view (NOT 404)
- [ ] `#/config?tab=modes` lands on Modes tab (NOT 404)
- [ ] `/api/health` has NO row named `HH_USER_AGENT`
- [ ] `tests/router-query-string.test.mjs` + `tests/health-no-hh-user-agent-row.test.mjs` pass

### v1.29.0 — RU scanner 2→5 + registry + dynamic dropdown + §17
- [ ] `GET /api/scan/sources` returns 11 entries (6 EN + 5 RU) (3.3)
- [ ] `#/scan` source dropdown built dynamically; lists all 11 sorted alphabetically
- [ ] `russian_portals.sources` default (when array unset in portals.yml) = 5 RU keys
- [ ] `tests/sources-trudvsem.test.mjs` + `sources-getmatch-geekjob.test.mjs` + `scan-sources-endpoint.test.mjs` pass
- [ ] help-bundle §17 "How to add a portal" present × 8 locales (6.5)
- [ ] help §5 portals.yml example shows 5-source list × 8 locales
- [ ] `tests/canonical-docs-coverage.test.mjs::17-H2 parity` passes

### v1.29.1 — help §5 RU-config user guide × 8 locales
- [ ] every help-bundle §5 carries the new ### "Configuring Russian portals — detailed setup guide" subsection (localized H3 title)
- [ ] 5-source `russian_portals.sources: [...]` YAML example present × 8 locales
- [ ] 5-row inventory table (rows: `hh`, `habr`, `trudvsem`, `getmatch`, `geekjob`) present × 8
- [ ] Negative-list collision fix example present × 8
- [ ] Disable-one-source YAML snippet (`sources: ["hh", "habr", "trudvsem"]`) present × 8
- [ ] `HH_USER_AGENT` env-var name referenced × 8
- [ ] `tests/help-ru-config-section.test.mjs` — 7 / 7 pass
- [ ] H2-parity contract stays at 17

### v1.29.2 — multi-phase SSE close bug hot-fix
- [ ] `GET /api/stream/scan?source=both` emits 2 `start` events (en-scanner, ru-scanner) AND 2 `done` events with `final: false` then `final: true` (3.4)
- [ ] `GET /api/stream/scan?source=ats` emits 1 `done` with `final: true` (single-phase contract)
- [ ] `GET /api/stream/scan?source=regional` emits 1 `done` with `final: true`
- [ ] [`public/js/api.js`](../public/js/api.js) has NO `if (ev === 'done' \|\| ev === 'error') es.close()` pattern (the pre-fix bug)
- [ ] [`public/js/api.js`](../public/js/api.js) HAS `data.final !== false` guard
- [ ] `tests/scan-stream-multi-phase.test.mjs` — **11 / 11** pass (SSE contract + functional + logic table + bug forensics)
- [ ] Manual smoke: clicking 🌐 Scan on `#/scan` shows BOTH "▶ ATS scan" and "▶ Regional scan" headers + their logs + summaries
- [ ] No legacy single-phase consumer (batch / pdf-stream / liveness) regressed by the api.js change (existing tests pass)

---

## 10. Reporting format

Generate `qa/v29-regression/<run-date>-REGRESSION.md`:

```markdown
# Regression run — YYYY-MM-DD

**Stand:** http://127.0.0.1:4317 · v1.29.x · parentVersion x.x.x · Node 22.x
**Tester:** human / Claude Cowork / CI
**Duration:** mm min

## Summary

| Section | Sub-checks | PASS | FAIL | SKIP | Notes |
|---|---|---|---|---|---|
| 1. Smoke nav | 23 routes + pre-flight | 24 | 0 | 0 | |
| 2.1 Dashboard | 6 | 6 | 0 | 0 | |
| 2.2 Scan (v1.29 / v1.29.2) | 8 | 8 | 0 | 0 | dropdown 11 entries + both phases |
| 2.12 Help (v1.29.1) | 7 | 7 | 0 | 0 | §5 RU-config × 8 locales |
| 2.13 Batch (v1.28) | 7 | 7 | 0 | 0 | 5 controls |
| 3. API curl | 14 | 14 | 0 | 0 | |
| 4. Security | 7 | 7 | 0 | 0 | |
| 5. Accessibility | 9 | 9 | 0 | 0 | |
| 6. i18n | 8 | 8 | 0 | 0 | |
| 7. Registry / RU adapter | 4 | 4 | 0 | 0 | |
| 8. Multi-phase SSE | 4 | 4 | 0 | 0 | |
| 9. Per-release (v1.18→v1.29.2) | 70+ | N | M | K | |
| **Total** | **~180+** | **N** | **M** | **K** | |

## Failures
(One block per failure: section ID, expected, actual, screenshot, log excerpt.)

## Warnings
(PASSed but flagged — slow response, drift smell, etc.)

## Console errors
(Aggregated red entries from sections 1-2.)

## Environment
(Node, npm, parent career-ops, Playwright, OS versions.)
```

### Failure severity guide

| Severity | When |
|---|---|
| **BLOCKER** | Pre-flight fail · any §1 route 404 · §3.5 path-traversal · §3.6 SSRF · §4.7 XSS · §5.6 dangling IDREF · §6.4 / 6.5 / 6.6 locale missing required content · §8 multi-phase SSE broken |
| **HIGH** | §2 critical-path regression · §3.7 BF-1 break · §5.3-5.5 a11y · §3.3 registry shape break · §3.13 router 404 |
| **MEDIUM** | Individual feature regression · §6.7 AI-list drift · §7.x registry-shape edge case · slow response > 30 s |
| **WARNING** | Cosmetic drift · deferred drift (§13 G-005) · markdown-lint noise |

---

## 11. Quick automation hooks

```bash
# Full CI suite:
cd /Users/sergejemelanov/Projects/career-ops/web-ui
npm run test:ci                                       # 558 unit + 2 CI gates
npm test -- tests/canonical-docs-coverage.test.mjs    # 7 docs/i18n canaries
npm test -- tests/scan-stream-multi-phase.test.mjs    # 11 multi-phase SSE
npm test -- tests/help-ru-config-section.test.mjs     # 7 §5 RU-config gates
npm run test:e2e:browser                              # Playwright smoke + full-cycle (32 tests)

# Stand spot-checks:
[ "$(curl -fsS http://127.0.0.1:4317/ | grep -c 'href=\"#/dashboard\"')" = "1" ] && echo "sidebar dedupe OK"
curl -fsS http://127.0.0.1:4317/api/scan/sources | jq '.sources | length'                    # 11
curl -fsS http://127.0.0.1:4317/api/health | jq -r '.checks[].name' | grep -c HH_USER_AGENT   # 0
for lc in en es pt-BR ko ja ru zh-CN zh-TW; do
  curl -fsS "http://127.0.0.1:4317/api/help/$lc" | jq -r .markdown | grep -c '^## ' \
    | awk -v lc=$lc '{ printf "%-6s : %s\n", lc, $1 }'
done   # every line → 17

# Multi-phase SSE live probe (v1.29.2):
out=$(curl -sN --max-time 60 "http://127.0.0.1:4317/api/stream/scan?source=both&dryRun=1")
echo "starts: $(echo "$out" | grep -c '^event: start')   (expected 2)"
echo "final:false: $(echo "$out" | grep -c '\"final\":false')   (expected 1)"
echo "final:true:  $(echo "$out" | grep -c '\"final\":true')    (expected 1)"
```

---

## 12. Master invariants (do not regress)

Load-bearing contracts spanning v1.6.0 → v1.29.2. Any future change touching them MUST keep them green.

| # | Invariant | Source of truth |
|---|---|---|
| M-1  | Server never edits parent-project files outside explicit user actions | CLAUDE.md hard rule #1 |
| M-2  | CSP excludes `'unsafe-inline'` and `'unsafe-eval'` on public bind | §4.1 |
| M-3  | Every URL-fetching endpoint goes through `isValidJobUrl` + `safeGet` | §4.3 / `tests/safe-fetch.test.mjs` |
| M-4  | Every `:name` / `:slug` route param flows through `sanitizePathName` | §4.4 |
| M-5  | Every tracker/pipeline write is under `withFileLock` | §4.5 |
| M-6  | Every LLM endpoint carries `llmRateLimit` middleware | §4.6 |
| M-7  | CV PUT runs through entity-aware `stripDangerousMarkdown` | §4.7 |
| M-8  | All 8 locales surface the same key set + identical 17-H2 help structure | §6.3 / §6.4 |
| M-9  | All 8 CHANGELOGs stay at the same version | `scripts/check-changelog-parity.mjs` |
| M-10 | `.btn:not(.btn-sm)` ≥ 44 × 44 px on every public route | §5.3 / `tests/wcag-target-size.test.mjs` |
| M-11 | Router strips `?query` before route-name lookup (v1.28.1) | §2.10 / §3.13 / `tests/router-query-string.test.mjs` |
| M-12 | Source registry is the SINGLE place where adapters are listed (v1.29.0) | `server/lib/sources/registry.mjs` |
| M-13 | Multi-phase SSE: server marks intermediate `done` with `final: false`; client closes only on `final !== false` (v1.29.2) | §8 / `tests/scan-stream-multi-phase.test.mjs` |
| M-14 | help §5 + §17 stay synchronized: §5 = user-facing config (v1.29.1); §17 = developer adapter guide (v1.29.0); both × 8 locales | §2.12 / §6.5 / §6.6 |

---

## 13. Known deferred (open backlog as of v1.29.2)

| ID | Severity | Title | Notes |
|---|---|---|---|
| G-005 | Minor (cross-repo) | Report block letters A-G vs canonical A-F | Requires coordinated parent commit on `santifer/career-ops :: modes/oferta.md`. Renderer is schema-tolerant so legacy A-G files still display correctly. |

That's it. **Single open item.**

**Closed in v1.28.x / v1.29.x** — see `qa/DOCS-COVERAGE-v1.29.md §3.A / §3.B / §3.E / §3.F` for details:
- AI-list drift (Issue #1) — closed v1.28.0.
- `--max-retries N` UI surface (Issue #2) — closed v1.28.0.
- Router 404 on `?query` hashes — closed v1.28.1.
- `HH_USER_AGENT` health-row noise — closed v1.28.1.
- RU sources limited to 2 — closed v1.29.0 (now 5 by default).
- Three-place source-list drift — closed v1.29.0 (registry is single source of truth).
- User-facing RU-config docs gap — closed v1.29.1 (help §5 now has full step-by-step end-user guide × 8 locales).
- Multi-phase SSE close bug (RU phase silently dropped from `🌐 Scan`) — closed v1.29.2.

---

## 14. Maintenance

- Every release with semantic surface area updates **§9** with a new sub-list.
- Every release that retires an alias updates **§3.2**.
- Every release that adds an endpoint adds a curl probe to **§3**.
- Every release that adds a new mode page adds a route to **§1**.
- Every release that adds a new source adapter ships its row in `server/lib/sources/registry.mjs` and updates **§7.3** with the test file name.
- Every release that touches the SSE contract updates **§8** and `M-13` in **§12**.
- Archive prior `qa/v<N>-regression/` folders monthly; keep only the two most-recent under `qa/`.

When a scenario lands in CI (via `npm run test:ci`), this file's manual step becomes informational — keep it for human-driven smoke runs that hit the SPA visual layer.
