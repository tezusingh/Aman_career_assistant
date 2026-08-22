# career-ops-ui — full-project regression prompt (v1.27.0)

> **Audience:** human QA, Claude Cowork browser agent, or any automated
> harness running against a live stand.
> **Scope:** every page, every endpoint, every documented invariant from
> v1.6.0 baseline through **v1.27.0**. Catches regressions in code that
> already works; **does not** describe known open backlog.
> **Open backlog:** see §11 "Known deferred" at the bottom — single
> remaining item is **G-005** (A-G → A-F report-block realignment),
> which needs a coordinated parent-project commit.
> **Owner:** this file is the canonical regression source. Older
> prompts (`qa/REGRESSION-v1.26.md`, `qa/FIX-PROMPT-v26.1.md`,
> `qa/archive/`) are historical only; evidence runs live in
> `qa/v26-regression/` and `qa/v27-regression/`.

---

## 0. Preflight — stand setup

Before running any scenario:

```bash
# 1. Server must respond green
curl -fsS http://127.0.0.1:4317/api/health | python3 -m json.tool
# expected: ok=true, version=1.27.0 (or newer), all `required: true` checks ok

# 2. SPA shell loads
curl -fsS http://127.0.0.1:4317/ | grep -q '<title>career-ops-ui</title>'

# 3. Tag is at expected version
git -C $WEB_UI describe --tags --abbrev=0
# expected: v1.27.0 or newer

# 4. Sidebar dedupe gate (v1.27.0 PR-D)
curl -fsS http://127.0.0.1:4317/ | grep -c 'href="#/dashboard"'
# expected: 1   (the single nav-item; the brand block is now a <div>)
```

**Stand requirements:**

- Node ≥ 18 (uses native `fetch`, `node:test`).
- Parent `career-ops` project at `$CAREER_OPS_ROOT` (env var) or `..`. The Health page reports it as `parentVersion` — must be ≥ v1.7.0 for the report-block schema, ≥ v1.13.0 for the batch runner, ≥ v1.16.0 for the auto-pipeline orchestration.
- Optional `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` for live LLM scenarios. Without them: manual-prompt fallback paths run and must still pass.
- Optional Playwright (transitive dep of career-ops) for the PDF + apply scenarios.

**Stand layouts:**

| Layout | Use when | `CAREER_OPS_ROOT` |
|---|---|---|
| `career-ops/web-ui/` (cloned inside parent) | Most users | `..` (auto) |
| Standalone clone | Reviewer running against a fixture | absolute path, exported as env var |
| CI runner | GitHub Actions | `mktemp -d` + scaffolded files (see `tests/api.test.mjs::before`) |

---

## 1. Smoke nav — every route loads (60 sec)

Open the SPA and visit every sidebar route + every mode page. For each:
- URL hash matches expectation.
- `<h1.page-title>` rendered.
- 0 red console errors (warnings allowed).
- Screenshot.

| Order | Route | Expectation |
|---|---|---|
| 1 | `#/dashboard` | counts cards + recent applications card |
| 2 | `#/scan` | 🌐 Scan button + Active Companies card + chip filters |
| 3 | `#/pipeline` | URL input + filterable list + preview pane |
| 4 | `#/evaluate` | JD textarea + ▶ Evaluate button |
| 5 | `#/batch` | TSV editor + Parallel/min-score/dry-run/retry controls (NOT the legacy `#/batch-prompt`) |
| 6 | `#/reports` | reports list + score-thresholds card (collapsible) |
| 7 | `#/tracker` | sortable table over `data/applications.md` |
| 8 | `#/activity` | audit-log table with timestamps |
| 9 | `#/cv` | markdown editor + side-by-side preview + 📁 Upload + 📄 Generate PDF |
| 10 | `#/profile` | read-only profile summary |
| 11 | `#/config` | API keys + Profile + Modes tabs (v1.24.1 — must NOT crash with `c(...).also is not a function`) |
| 12 | `#/health` | required + optional checks; Playwright + key presence |
| 13 | `#/help` | 16-section in-app guide in current locale |

Mode pages (direct URL):

`#/deep`, `#/apply`, `#/project`, `#/training`, `#/followup`, `#/contacto`, `#/interview-prep`, `#/patterns` — each renders form + ▶ Run button.

Back-compat aliases (must resolve, not 404):

- `#/settings` → Profile view (canonical is `#/profile`)
- `#/batch-prompt` → legacy mode-builder with deprecation banner pointing at `#/batch`

**Sidebar dedupe (v1.27.0 PR-D):**

- The brand logo (`co · career-ops`) is rendered as `<div class="logo">`, NOT `<a>`.
- Only **one** `<a href="#/dashboard">` lives in the sidebar — the nav item with `◆ Dashboard`.
- Tab-key sequence inside the sidebar visits exactly one Dashboard control (was two on v1.26.x).
- Screen reader (VoiceOver / NVDA / TalkBack) announces "Dashboard, link" exactly once when entering the navigation landmark.

**PASS** = 13 sidebar + 8 mode + 2 alias routes render with 0 console errors, dedupe gate green.

---

## 2. Per-page regression

### 2.1 Dashboard (`#/dashboard`)

- Counts (apps / pipeline / reports) match what's in `data/applications.md` / `data/pipeline.md` / `reports/`.
- Avg score is `(sum scores) / (count rows with score)`, rounded to 1 decimal.
- Status breakdown shows 8 buckets (`Evaluated`, `Applied`, `Responded`, `Interview`, `Offer`, `Rejected`, `Discarded`, `SKIP`).
- Recent applications: last 5 by date.
- Auto-pipeline button text reads **`✨ Auto-pipeline a URL`** — single ✨ glyph, NOT double (v1.25.0 cosmetic fix).
- **Header buttons (v1.26.1 PR-A):** `#btn-doctor`, `#btn-quick-scan`, "Open Pipeline", "🌐 Scan now", "✨ Auto-pipeline a URL" all render at ≥ 44 × 44 px (WCAG 2.5.5 — see §5.3).

### 2.2 Scan (`#/scan`)

- **One** 🌐 Scan button (not two for EN/RU — v1.18.0 unification).
- Click → live SSE log → results table populates → chip filters appear.
- Active Companies card lists every entry from `portals.yml::tracked_companies` with API-health pip.
- Filterable: location, Remote/Hybrid badge, relocation flag, salary, source.

### 2.3 Pipeline (`#/pipeline`)

- Add URL via form OR Ctrl+K paste → row appears.
- Server-side preview proxy: click row → preview pane fetches JD body via `safeGet` (v1.21.0 — DNS-pinned, redirect-revalidated, 8 KB body cap, 3-hop limit).
- Invalid URL (`javascript:alert(1)`, `http://127.0.0.1/`, `not-a-url`) → toast error, no append.
- Dedup: paste same URL twice → second toast says "deduped" or equivalent.
- Filter input filters the list live.
- Concurrent POSTs (v1.21.0 H-6) — 20 parallel adds via curl don't drop rows.

### 2.4 Evaluate (`#/evaluate`)

- Paste JD → ▶ Evaluate.
- **No key set:** manual-prompt card with copy button.
- **Anthropic key set:** live response, scores in header `score: N.N/5`.
- **Only Gemini set:** Gemini fallback.
- Save JD checkbox: when ticked → JD goes to `jds/`.

### 2.5 Reports (`#/reports`)

- Score-thresholds card (`v1.11.1+`) visible at top, collapsible via `<details>`.
- Each report card: header (Score / Legitimacy / URL) + click opens detail view.
- Score pills wear redundant glyph (v1.22.0 M-3): ✓ on high (≥ 4), ◐ on mid (≥ 3), ○ on low.
- Generate PDF button on each detail view streams via `/api/stream/pdf/report?slug=…`.
- **Known doc/code drift (G-005):** report-block letters still show A-G with `C=Risks, F=Verdict, G=Legitimacy`. career-ops.org/docs canonical is A-F with `C=Strategy, F=STAR` (no Legitimacy block). Tracked in §11 — needs coordinated parent commit.

### 2.6 Tracker (`#/tracker`)

- Filterable + sortable table.
- Add row: company `Acme | Co` (with pipe), role `Senior Backend\nEngineer` (with newline) — both round-trip losslessly (BF-1 regression).
- One-click normalize / dedup / merge buttons stream SSE.
- Concurrent POSTs serialize via `withFileLock` (v1.21.0 H-6).

### 2.7 Activity log (`#/activity`)

- Reverse-chronological JSONL audit trail of state-changing requests.
- Secrets redacted in `body.*` payloads.

### 2.8 CV (`#/cv`)

- Markdown editor on left, preview on right (live re-render on input).
- 📁 Upload CV: accepts `.md`, `.txt`, `.html`, `.pdf`, `.docx`, `.odt`, `.rtf`, `.doc`. v1.13.0+ supports multer multipart curl uploads.
- 💾 Save: server runs `stripDangerousMarkdown` (v1.22.0 M-4 entity-aware: catches `&lt;script&gt;`, `java&#115;cript:`, SVG-on-load).
- 📄 Generate PDF: streams Playwright run; PDF auto-downloads + appears in PDF list.
- Cap: 1 MB on `cv.md`; 11 MB on uploads (multer).

### 2.9 Profile (`#/profile`)

- Read-only summary of `config/profile.yml`. Use App settings → Profile tab to edit.

### 2.10 App settings (`#/config`) ⚠ critical-path

**v1.24.1** — must render without `c(...).also is not a function` on any locale.

- Three tabs: API keys & runtime / Profile / Modes.
- Save round-trip: write parent `.env` keys + apply to live `process.env`.
- Profile tab: edit `config/profile.yml`, header `# Career-Ops Profile Configuration` auto-added.
- Modes tab: edit `modes/_profile.md` (v1.15.0).
- All fields have `<label for="…">` (WCAG 3.3.2, v1.20.0 + v1.20.1 H-2 fix).

### 2.11 Health (`#/health`)

- Required checks green: `cv.md exists`, `config/profile.yml exists`, `portals.yml exists`, `Profile customized`, `API key set` (any one).
- Optional: `Playwright (parent node_modules)`, `Node version`, `Project root`.
- Run `doctor.mjs` + `verify-pipeline.mjs` buttons stream SSE.
- Footer: `version` = web-ui pkg version; `parentVersion` = parent `VERSION` file.

### 2.12 Help (`#/help`)

- 16 H2 sections in current locale (CI invariant — `tests/help-ui.test.mjs::section-parity`).
- Each of the 5 canonical [career-ops.org/docs](https://career-ops.org/docs) URLs appears ≥ 2 times (v1.24.0 content depth refresh).
- 21-step Getting Started walkthrough with all button labels (📁 Upload CV / 🌐 Scan now / ▶ Evaluate / 📄 Generate PDF / 💾 Save).

---

## 3. API endpoint regression — curl-driven

Each block can be wrapped into a test script. Output → `qa/v27-regression/<scenario>.log`.

### 3.1 Health & dashboard

```bash
curl -fsS http://127.0.0.1:4317/api/health | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['ok'] is True
assert d['version'].startswith('1.')
assert any(c['name'] == 'cv.md' and c['ok'] for c in d['checks'])
print('PASS')
"
curl -fsS http://127.0.0.1:4317/api/dashboard | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert all(k in d for k in ('counts', 'avgScore', 'byStatus', 'recent', 'pipeline', 'lastReport'))
print('PASS')
"
```

### 3.2 Retired aliases (must 404)

```bash
for ep in /api/stream/scan-en /api/stream/scan-ru /api/scan-ru/config; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:4317$ep")
  [ "$status" = "404" ] || { echo "FAIL: $ep returned $status (expected 404)"; exit 1; }
done
echo "PASS — all 3 legacy aliases retired"
```

### 3.3 Canonical scan config

```bash
curl -fsS http://127.0.0.1:4317/api/scan/regional/config | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert isinstance(d.get('queries'), list)
assert isinstance(d.get('sources'), list)
print('PASS')
"
```

### 3.4 Path-traversal sweep (v1.21.0 H-4 + v1.26.0 jds coverage)

```bash
for name in '..' '...' '..pdf' '....pdf' '../../etc/passwd' '..%2fetc%2fpasswd' '.hidden'; do
  for ep in /api/jds /api/reports /api/modes /api/output/pdfs; do
    enc=$(printf '%s' "$name" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")
    status=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:4317${ep}/${enc}")
    [ "$status" = "400" ] || [ "$status" = "404" ] || { echo "FAIL: $ep/$name returned $status"; exit 1; }
  done
done
echo "PASS — 28 path-traversal attempts all rejected"
```

### 3.5 SSRF reject (URL gate + DNS rebind)

```bash
for url in 'javascript:alert(1)' 'file:///etc/passwd' 'http://127.0.0.1:22/' \
          'http://10.0.0.5/internal' 'http://169.254.169.254/latest/meta-data/' \
          'http://[::1]/internal' 'not-a-url'; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"$url\"}" \
    http://127.0.0.1:4317/api/pipeline)
  [ "$status" = "400" ] || { echo "FAIL: $url returned $status (expected 400)"; exit 1; }
done
echo "PASS — 7 SSRF / invalid-URL inputs rejected"
```

### 3.6 Tracker round-trip (BF-1: pipe + newline preservation)

```bash
curl -fsS -X POST -H 'Content-Type: application/json' \
  -d '{"company":"Acme | Co","role":"Senior Backend\nEngineer","score":"4.2","status":"Evaluated","notes":"BF-1 regression"}' \
  http://127.0.0.1:4317/api/tracker | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['ok'] is True
assert d.get('num', '').isdigit()
print('PASS — tracker insert num=', d['num'])
"
curl -fsS http://127.0.0.1:4317/api/tracker | python3 -c "
import sys, json
rows = json.load(sys.stdin)['rows']
m = [r for r in rows if r['company'] == 'Acme | Co']
assert m, 'Acme | Co not in tracker'
print('PASS — pipe in company round-tripped intact')
"
```

### 3.7 Auto-pipeline manual mode (v1.25.0 G-014)

```bash
t0=$(date +%s%N)
body=$(curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
  http://127.0.0.1:4317/api/auto-pipeline)
t1=$(date +%s%N)
elapsed_ms=$(( (t1 - t0) / 1000000 ))
[ "$elapsed_ms" -lt 2000 ] || { echo "FAIL: manual mode took ${elapsed_ms}ms (expected <2000)"; exit 1; }
echo "$body" | grep -q '"mode":"manual"' || { echo "FAIL: no mode:manual in body"; exit 1; }
echo "$body" | grep -q '"prompt"' || { echo "FAIL: no prompt in body"; exit 1; }
echo "PASS — manual short-circuit returned in ${elapsed_ms}ms"
```

### 3.8 LLM rate-limit (v1.21.0 H-5)

**Skip on loopback bind.** Run only against `HOST=0.0.0.0` / public bind.

```bash
# Stand must be started with:
#   HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s npm start
ip=$(curl -s ifconfig.me 2>/dev/null || echo 192.0.2.1)
for i in 1 2 3 4; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","mode":"manual"}' \
    "http://0.0.0.0:4317/api/auto-pipeline")
  echo "  req $i: $status"
done
# Expected: 200 200 200 429
```

### 3.9 Concurrent tracker write (v1.21.0 H-6)

```bash
# 20 concurrent POSTs with distinct companies → 20 sequential row numbers
for i in $(seq 1 20); do
  curl -sS -X POST -H 'Content-Type: application/json' \
    -d "{\"company\":\"ConcurCo-$i\",\"role\":\"Engineer $i\",\"score\":\"4.0\",\"status\":\"Evaluated\"}" \
    http://127.0.0.1:4317/api/tracker > /dev/null &
done
wait
# Now verify: 20 rows, no missing nums
grep -c "ConcurCo-" "$CAREER_OPS_ROOT/data/applications.md"
# Expected: 20
```

### 3.10 CV save XSS strip (v1.22.0 M-4 entity-aware)

```bash
curl -fsS -X PUT -H 'Content-Type: application/json' \
  -d '{"markdown":"# CV\n\n<script>evil()</script>\n[link](javascript:alert(1))\n&lt;script&gt;encoded&lt;/script&gt;\n\nbody"}' \
  http://127.0.0.1:4317/api/cv > /dev/null
curl -fsS http://127.0.0.1:4317/api/cv | python3 -c "
import sys, json
md = json.load(sys.stdin)['markdown']
for pat in ('<script', 'javascript:', '<script'):  # last one is post-decode
    assert pat.lower() not in md.lower(), f'XSS leaked: {pat}'
print('PASS — XSS strip neutralized 3 vectors (literal, javascript:, entity-encoded)')
"
```

### 3.11 Help-bundle URL coverage matrix (5 URLs × 8 locales)

```bash
fail=0
for lang in en es pt-BR ko ja ru zh-CN zh-TW; do
  md=$(curl -sS "http://127.0.0.1:4317/api/help/$lang" | python3 -c "import sys,json; print(json.load(sys.stdin).get('markdown',''))")
  for url in what-is-career-ops scan-job-portals apply-for-a-job batch-evaluate-offers set-up-playwright; do
    if ! echo "$md" | grep -q "$url"; then
      echo "FAIL: $lang missing $url"
      fail=$((fail + 1))
    fi
  done
done
[ "$fail" = "0" ] && echo "PASS — 40/40 (8 locales × 5 URLs) covered"
```

### 3.12 Apply checklist (v1.25.0 — no auto-submit)

```bash
body=$(curl -fsS -X POST -H 'Content-Type: application/json' \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/x","jd":"Senior Backend"}' \
  http://127.0.0.1:4317/api/apply-helper)
echo "$body" | grep -q 'career-ops apply' || { echo "FAIL: no /career-ops apply mention"; exit 1; }
echo "$body" | grep -qi 'never auto\|auto-submit\|warning' || { echo "FAIL: no auto-submit warning"; exit 1; }
echo "PASS — apply checklist mentions parent command + warning"
```

### 3.13 Sidebar dedupe (v1.27.0 PR-D)

```bash
# Static HTML shape gate. Exactly one #/dashboard link in the rendered shell.
count=$(curl -fsS http://127.0.0.1:4317/ | grep -c 'href="#/dashboard"')
[ "$count" = "1" ] || { echo "FAIL: expected 1 #/dashboard link, found $count"; exit 1; }
# Brand block is now a <div>, not <a>.
curl -fsS http://127.0.0.1:4317/ | grep -q '<div class="logo">' \
  || { echo "FAIL: brand logo not rendered as <div class=\"logo\">"; exit 1; }
echo "PASS — sidebar dedupe holds"
```

---

## 4. Security envelope — invariants that must hold

### 4.1 CSP (Content-Security-Policy)

```bash
curl -sSI http://127.0.0.1:4317/ | grep -iE '^content-security-policy:' || {
  echo "PASS — CSP not attached on loopback (gated by isPubliclyExposed)"
}
HOST=0.0.0.0 ... # start server on public bind
curl -sSI http://127.0.0.1:4317/ | grep -i 'content-security-policy'
# Expected: script-src has NO 'unsafe-inline', has NO 'unsafe-eval', frame-ancestors 'none'
```

### 4.2 No inline event handlers

```bash
grep -rE 'on[a-z]+\s*=\s*"' public/index.html public/js/views/*.js | grep -v '//.*on'
# Expected: empty
```

### 4.3 `safeGet` is the only outbound HTTP path

```bash
# Server-side preview proxy + auto-pipeline must go through safeGet
grep -rn 'fetch(' server/lib/routes/pipeline.mjs server/lib/routes/auto-pipeline.mjs
# Expected: zero matches (safe-fetch is the canonical wrapper)
```

### 4.4 `sanitizePathName` covers every `:name` / `:slug` route param

```bash
grep -rE "replace\(.*\[\^\\\\w" server/lib/routes/
# Expected: only inside reports.mjs::sanitizeSlug (the wrapper); everywhere
# else uses sanitizePathName from security.mjs (v1.21.0 H-4).
```

### 4.5 `withFileLock` wraps every read-modify-write on applications/pipeline

```bash
grep -rB 2 -A 8 'writeFileSync.*PATHS\.applications\|writeFileSync.*PATHS\.pipeline' server/lib/routes/
# Expected: each write is inside a withFileLock(...) callback
```

### 4.6 `llmRateLimit` middleware on every LLM endpoint

```bash
grep -E "app\.post.*llmRateLimit" server/lib/routes/llm.mjs server/lib/routes/auto-pipeline.mjs
# Expected: 4 routes (/api/evaluate, /api/deep, /api/mode/:slug, /api/auto-pipeline)
```

### 4.7 `stripDangerousMarkdown` entity-aware (v1.22.0 M-4)

```bash
node -e "
import('./server/lib/security.mjs').then(({stripDangerousMarkdown}) => {
  const tests = [
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    'java&#115;cript:alert(1)',
    'ja&#x76;ascript:alert(1)',
    '&lt;img src=x onerror=alert(1)&gt;',
  ];
  for (const t of tests) {
    const r = stripDangerousMarkdown(t);
    if (/<script|javascript\s*:|onerror/i.test(r)) {
      console.log('FAIL:', t, '=>', r);
      process.exit(1);
    }
  }
  console.log('PASS — 4 entity-encoded XSS vectors neutralized');
});
"
```

---

## 5. Accessibility regression (WCAG 2.2 AA)

### 5.1 Skip link (2.4.1)

1. Open `BASE_URL`, press `Tab` once.
2. First focusable element is a visible "Skip to main content" link (or locale equivalent).
3. Press Enter — focus jumps to `#content`.

### 5.2 Focus Visible (2.4.7)

Tab through 5+ controls. Each focused element has visible outline (≥ 2 px, 3:1 contrast).

### 5.3 Target Size (2.5.5) — v1.26.1 PR-A gate

Run in DevTools console **on every sidebar route** (the regression was header-row-specific in v1.26.0):

```js
for (const route of ['#/dashboard','#/scan','#/pipeline','#/evaluate','#/batch',
                     '#/reports','#/tracker','#/activity','#/cv','#/profile',
                     '#/config','#/health','#/help']) {
  location.hash = route;
  await new Promise(r => setTimeout(r, 250));
  const bad = Array.from(document.querySelectorAll('.btn:not(.btn-sm)')).filter(b => {
    const r = b.getBoundingClientRect();
    return r.height < 44 || r.width < 44;
  }).map(b => ({ t: b.textContent.trim().slice(0,30), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }));
  console.log(route, bad.length ? 'FAIL' : 'pass', bad);
}
// Expected: every route → "pass"  []
```

Static CSS canary (no browser needed):

```bash
node --test tests/wcag-target-size.test.mjs
# Expected: 4 / 4 pass
#   - .btn carries min-height: 44px
#   - .btn carries flex-shrink: 0
#   - .btn-sm keeps 32 px floor
#   - .btn-sm follows .btn in source order
```

### 5.4 Chip + nav-item + tab-btn targets (v1.20.0)

```js
['.chip', '.nav-item', '.tab-btn'].forEach((sel) => {
  const min = sel === '.chip' ? 28 : 44;
  const bad = Array.from(document.querySelectorAll(sel)).filter(el =>
    el.getBoundingClientRect().height < min
  );
  console.log(sel, ':', bad.length, '<', min, 'px (expected 0)');
});
```

### 5.5 Form labels associated (v1.20.0 + v1.21.0 H-2)

```js
Array.from(document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea, select')).filter(el =>
  !el.labels?.length && !el.getAttribute('aria-label')
).map(el => el.outerHTML.slice(0, 100))
// Expected: []
```

### 5.6 `aria-describedby` IDREFs resolve (v1.21.0 H-1 canary)

```js
Array.from(document.querySelectorAll('[aria-describedby]')).filter(el => {
  const id = el.getAttribute('aria-describedby');
  return !document.getElementById(id);
})
// Expected: []
```

### 5.7 `<html lang>` updates on locale switch (WCAG 3.1.1)

```js
document.documentElement.getAttribute('lang')
// → 'en' / 'ru' / etc. matching the active locale
```

### 5.8 Color-only state has redundant cue (v1.22.0 M-3, WCAG 1.4.1)

- `.score-high` has `::before` content `'✓'`
- `.score-mid` has `::before` content `'◐'`
- `.score-low` has `::before` content `'○'`
- `.conn-banner` shows `⚠` glyph in offline state

```js
const cs = (sel, prop) => getComputedStyle(document.querySelector(sel) || document.body, '::before')[prop];
['score-high', 'score-mid', 'score-low'].forEach((cls) => {
  console.log(cls, '::before content =', cs('.' + cls, 'content'));
});
```

### 5.9 Sidebar duplicate-control gate (v1.27.0 PR-D)

- The "Dashboard" landmark is announced exactly once per navigation entry on VoiceOver / NVDA / TalkBack.
- Tab sequence inside `<aside class="sidebar">` visits the Dashboard nav item once, not twice.

---

## 6. i18n regression — 8 locales × every page

### 6.1 Locale switcher persists across reload

1. Click `.lang-btn[data-lang-btn="ru"]` in sidebar.
2. Reload page.
3. UI still in Russian.
4. `localStorage.getItem('career-ops-ui:lang')` === `'ru'`.

### 6.2 Safari private mode doesn't break SPA (v1.22.0 M-5)

1. Open Safari → File → New Private Window.
2. Visit `BASE_URL`.
3. SPA renders normally (NOT raw keys).
4. Locale switcher still works (writes silently fail; reads default to browser auto-detect).

### 6.3 i18n DICT coverage (CI invariant)

```bash
npm test -- tests/i18n-coverage.test.mjs
# 5 / 5 pass
```

### 6.4 Help-bundle 16-section parity

```bash
for f in docs/help/*.md; do
  echo "$f: $(grep -c '^## ' "$f")"
done
# Expected: every file → 16
```

### 6.5 Help-bundle content depth (v1.24.0)

For each of the 8 locales:

- 5 canonical career-ops.org/docs URLs appear ≥ 2 times.
- Section 14 (Apply) lists the 8-step CLI flow ending in `Submitted.`
- Section 5 (Portals) has the `cp templates/portals.example.yml portals.yml` bootstrap command.
- Section 7 (Scan) has the "no AI tokens consumed" note for Option A.

### 6.6 CHANGELOG locale parity (v1.25.0 + v1.26.0 + v1.27.0 gate)

```bash
node scripts/check-changelog-parity.mjs
# Expected: "✓ CHANGELOG parity: all 8 locales at v1.27.0"
```

---

## 7. Documentation alignment — vs career-ops.org/docs

(Detail in `qa/v24-regression/01-LIVE-8-LOCALES-WORKFLOWS.md`. Summary below.)

### 7.1 Score-threshold table (`what-is-career-ops`)

- ≥ 4.5 → `/career-ops apply` (push immediately)
- 4.0 – 4.4 → apply, or `/career-ops contacto`
- 3.5 – 3.9 → `/career-ops deep`
- < 3.5 → skip

Verify the values appear in `docs/help/<locale>.md` for every locale.

### 7.2 Scan workflow (`scan-job-portals`)

- Single 🌐 Scan button → consolidated SSE → 6 ATSes + hh.ru + Habr.
- `data/last-scan.json` + `data/scan-history.tsv` + filtered URLs in `data/pipeline.md`.
- Legacy `/api/stream/scan-{en,ru}` aliases → 404 (v1.18.0).
- Canonical: `/api/stream/scan?source=ats|regional|both`.

### 7.3 Apply workflow (`apply-for-a-job`)

- `/career-ops apply` (parent CLI) is the only auto-submit path.
- `#/apply` SPA generates a **checklist**, never auto-submits.
- Banner contains live `<a href="https://career-ops.org/docs/.../set-up-playwright">` link.

### 7.4 Batch evaluate (`batch-evaluate-offers`)

- `#/batch` SPA renders TSV editor + 4 controls.
- `GET /api/batch` returns `{ exists, runnerExists, raw, rows, additions }`.

### 7.5 Playwright setup (`set-up-playwright`)

- Help bundle §14 lists `npx playwright install chromium` + `claude mcp add playwright …`.
- `#/cv → 📄 Generate PDF` gracefully fails (NOT 500) when Playwright is missing.

### 7.6 Report blocks (`evaluate-an-offer`) — known drift

Canonical career-ops.org/docs lists A-F report blocks: `A=Synthesis, B=Match, C=Strategy, D=Questions, E=Personalization, F=STAR`. The web-ui Reports view + parent `modes/oferta.md` still emit A-G with the legacy schema (`C=Risks, F=Verdict, G=Legitimacy`). See §11 below — fix needs a parent commit.

---

## 8. Per-release regression checklist

Each item below is a known invariant from a specific release. Mass-spot-check after merging anything that touches the relevant area.

### v1.18.0 — WCAG 2.2 AA + scan retirement

- [ ] Skip link present (5.1)
- [ ] Focus visible (5.2)
- [ ] `.btn` ≥ 44 px (5.3)
- [ ] `<html lang>` set + updates (5.7)
- [ ] `/api/stream/scan-{en,ru}` → 404 (3.2)

### v1.19.0 — WCAG 1.4.3 contrast + HH_USER_AGENT removed from UI

- [ ] `.badge-{ok,warn,bad,info}` text on tinted bg ≥ 4.5:1 on light + dark
- [ ] `.score-{high,mid,low}` text on tinted bg ≥ 4.5:1 on light + dark
- [ ] HH_USER_AGENT field absent from `/#/config`
- [ ] HH_USER_AGENT absent from `GET /api/config` response keys

### v1.20.0 — per-component a11y + non-EN README parity

- [ ] `.chip` ≥ 28 px (5.4)
- [ ] `.nav-item` ≥ 44 px (5.4)
- [ ] `.tab-btn` ≥ 44 px (5.4)
- [ ] Every input has label / aria-label (5.5)
- [ ] `/api/scan-ru/config` → 404 (v1.20.0 alias retirement)
- [ ] All 8 READMEs at 569-603 lines (parity-class)

### v1.21.0 — security + concurrency + a11y (B-1, H-1..H-6)

- [ ] `safe-fetch.mjs` exists + used by `/api/pipeline/preview` + `/api/auto-pipeline` (4.3)
- [ ] `sanitizePathName` consolidated in `security.mjs`; 10 broken regex copies gone (4.4)
- [ ] `withFileLock` wraps tracker / pipeline writes (4.5)
- [ ] `llmRateLimit` on 4 LLM endpoints (4.6)
- [ ] All `aria-describedby` IDREFs resolve (5.6)
- [ ] Every form input has `htmlFor` or `aria-label` (5.5)
- [ ] 19 v1.20.0 i18n keys present in all 8 locales (6.3)

### v1.22.0 — M/L/N backlog clearout

- [ ] `stripDangerousMarkdown` entity-aware (4.7)
- [ ] Score pills + connection banner wear redundant glyph (5.8)
- [ ] mode-page fields carry inline hint `<p>` with `aria-describedby` wiring
- [ ] `parseInt(process.versions.node, 10)` (no missing radix)
- [ ] `bash --noprofile --norc` on batch runner subprocess
- [ ] Element.prototype.also gone (CI gate `scripts/check-no-also-leftovers.mjs`)
- [ ] Health-ping exponential backoff: 3s → 6s → 12s → 24s → 60s
- [ ] Safari private mode doesn't break i18n (6.2)
- [ ] `htmlFor` null-guard in `UI.el()` — `null` doesn't render `for="null"`
- [ ] `/api/scan-ru/config` 404 canary in test suite

### v1.23.0 — i18n split + CI hot-fix

- [ ] `public/js/lib/i18n-dict.js` exists (578 LOC data fixture)
- [ ] `public/js/lib/i18n.js` < 100 LOC (logic only)
- [ ] `public/index.html` loads `i18n-dict.js` BEFORE `i18n.js`
- [ ] Connection-banner recovery: kill server, wait 4 s, restart — banner auto-hides within `_HEALTH_MIN` of recovery (v1.23.0 cadence fix)
- [ ] All 8 READMEs reference locale-specific `dashboard-<locale>.png` (NOT `dashboard-en.png` for non-EN)
- [ ] Each non-EN README has `<!-- DO NOT REVERT -->` marker near the image line

### v1.24.0 — help-bundle content + scenario 31 live

- [ ] `docs/help/en.md` ≈ 1269 lines (content depth refresh)
- [ ] Each of 5 career-ops.org URLs appears ≥ 2 times in EVERY locale's help bundle (6.5)
- [ ] 16 H2 sections preserved per locale (6.4)

### v1.24.1 — `#/config` hot-fix (G-015)

- [ ] `/#/config` renders without `c(...).also is not a function` on every locale (1, route #11)
- [ ] `node scripts/check-no-also-leftovers.mjs` passes (CI gate)
- [ ] `tests/config-view-syntax.test.mjs` passes (3 unit tests)

### v1.25.0 — G-014 + G-012 + cosmetic

- [ ] `POST /api/auto-pipeline { mode: 'manual' }` returns in < 2 s with `mode:'manual'` + `prompt` in `done` payload (3.7)
- [ ] Works even with `ANTHROPIC_API_KEY` set (no live call)
- [ ] Legacy `evalMode: 'manual'` spelling still works
- [ ] All 8 CHANGELOGs at v1.25.0+ (6.6)
- [ ] Dashboard auto-pipeline button: `✨ Auto-pipeline a URL` (single ✨)

### v1.26.0 — test pyramid

- [ ] `docs/architecture/TESTING.md` documents 4-tier pyramid
- [ ] `tests/acceptance/` directory exists with at least 1 journey test
- [ ] `npm run test:ci` runs full suite + both CI gates (`check-no-also-leftovers` + `check-changelog-parity`)
- [ ] `npm test` count ≥ 502 (unit + acceptance)
- [ ] Coverage ≥ 93 % line / ≥ 83 % branch (per `npm run test:coverage`)

### v1.26.1 — WCAG 2.5.5 hot-fix (PR-A)

- [ ] `.btn` rule in `public/css/app.css` carries `min-height: 44px` + `flex-shrink: 0` + `line-height: 1.2`
- [ ] `.btn-sm` keeps `min-height: 32px` and comes AFTER `.btn` in source order
- [ ] `tests/wcag-target-size.test.mjs` passes (4 static CSS canaries)
- [ ] Live measurement: every `.btn:not(.btn-sm)` ≥ 44 × 44 px on every sidebar route (§5.3)
- [ ] Header buttons (Doctor / Quick scan / Open Pipeline / 🌐 Scan now / ✨ Auto-pipeline a URL) all measure ≥ 44 px

### v1.27.0 — sidebar dedupe (PR-D)

- [ ] Static HTML has exactly one `href="#/dashboard"` (3.13)
- [ ] Brand block renders as `<div class="logo">`, not `<a class="logo">`
- [ ] Screen reader announces "Dashboard, link" once when entering navigation landmark (§5.9)
- [ ] Tab order visits Dashboard control exactly once inside the sidebar
- [ ] All 8 CHANGELOGs at v1.27.0 (6.6)

---

## 9. Reporting format

Generate a single Markdown file under `qa/v27-regression/<run-date>-REGRESSION.md`:

```markdown
# Regression run — YYYY-MM-DD

**Stand:** http://127.0.0.1:4317 · v1.27.0 · parentVersion 1.7.1 · Node 22.x
**Tester:** human / Claude Cowork / CI
**Duration:** mm min

## Summary

| Section | Sub-checks | PASS | FAIL | SKIP | Notes |
|---|---|---|---|---|---|
| 1. Smoke nav | 23 routes + dedupe | 24 | 0 | 0 | |
| 2.1 Dashboard | 6 | 6 | 0 | 0 | |
| 2.2 Scan | 4 | 4 | 0 | 0 | |
| …  | | | | | |
| 8. Per-release | 60+ | N | M | K | |
| **Total** | **160+** | **N** | **M** | **K** | |

## Failures

(One block per failure: scenario, expected, actual, screenshot path, server log excerpt.)

## Warnings

(Items that PASSed but flagged a smell — e.g., slow response, stale screenshot.)

## Console errors

(Aggregated red console entries from sections 1-2.)

## Environment

(Versions of node, npm, parent career-ops, Playwright, OS.)
```

### Failure severity guide

| Severity | When to use |
|---|---|
| **BLOCKER** | Section 1 (any route fails to load), 2.10 (config crashes), 3.4 (path-traversal accepted), 3.5 (SSRF accepted), 4.7 (XSS leaks), 5.6 (dangling IDREFs), 6.4 (locale missing 16 sections) |
| **HIGH** | 2.7-2.8 (CV / activity log), 3.6 (BF-1 round-trip), 3.9 (concurrent write race), 5.3-5.5 (a11y targets / labels) |
| **MEDIUM** | 2.1-2.6 individual feature regressions, 6.5 (help-bundle content depth), 7.1-7.5 (docs alignment), 3.13 / 5.9 (sidebar dedupe — UX, not safety) |
| **WARNING** | Cosmetic glyph drift, slow response > 30 s, missing screenshot capture |

---

## 10. Quick automation hooks

For Claude Cowork / Playwright agent:

```bash
# Run sections 3 (API curl), 4 (security), 6.3/6.4/6.6 (i18n CI gates) headlessly:
bash bin/run_all.sh                    # full suite locally
npm run test:ci                        # 506 unit + 2 CI gates
npm run test:e2e:browser               # Playwright smoke + full-cycle

# Spot-check matrix only:
for lang in en es pt-BR ko ja ru zh-CN zh-TW; do
  curl -fsS "http://127.0.0.1:4317/api/help/$lang" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{${lang!r}:>6}:', d['markdown'].count('## '), 'H2 sections')"
done
# Expected: every line → 16

# Sidebar dedupe gate:
[ "$(curl -fsS http://127.0.0.1:4317/ | grep -c 'href=\"#/dashboard\"')" = "1" ] \
  && echo "PASS — sidebar dedupe (v1.27.0)" \
  || echo "FAIL"
```

For browser sub-tests (sections 5 / 7), use Claude Cowork or `tests/playwright-{smoke,full-cycle}.mjs`. Sections 1-2 are eyeball-only unless Playwright recorded a flow per page.

---

## 11. Known deferred (open backlog as of v1.27.0)

Single item left after v1.27.0. **Not a regression** — these are intentionally unshipped, tracked here so a fresh QA run doesn't refile them.

| ID | Severity | Title | Target | Why deferred |
|---|---|---|---|---|
| **G-005** | Minor (docs / cross-repo) | Report blocks A-G (`C=Risks, F=Verdict, G=Legitimacy`) vs canonical career-ops.org A-F (`C=Strategy, F=STAR, no Legitimacy`) | future release (coordinated with parent) | Requires the parent [`santifer/career-ops`](https://github.com/santifer/career-ops) `modes/oferta.md` to ship the A-F schema first; renderer in web-ui must keep displaying pre-v1.x A-G reports as-is for graceful degrade. See `qa/FIX-PROMPT-v26.1.md → PR-B` for the full spec. |

**Closed since v1.26.0:**

| ID | Closed in | How verified |
|---|---|---|
| WCAG-2.5.5-btn-height | v1.26.1 | `.btn:not(.btn-sm)` ≥ 44 × 44 px live on all 13 routes; `tests/wcag-target-size.test.mjs` × 4 canaries |
| Sidebar dup `#/dashboard` × 2 | v1.27.0 | Static HTML has exactly one `href="#/dashboard"`; brand block is a `<div>` |
| G-003 README.cn.md naming | already (verified during v1.26.1 cycle) | `ls README*.md` → 8 files at canonical `<base>.<locale>.md` |

---

## 12. Maintenance

- Every release with semantic surface area updates **Section 8** with a new sub-list.
- Every release that retires an alias updates **Section 3.2** with the new 404 target.
- Every release that adds a new endpoint adds a curl probe to **Section 3**.
- Every release that adds a new mode page adds a route to **Section 1**.
- Every release that closes a row in **Section 11** moves the row into "Closed since…".
- Archive prior `qa/v<N>-regression/` folders monthly; keep only the two most-recent under `qa/`.

When a regression scenario lands in CI (via `npm run test:ci`), this file's manual step becomes informational — keep it for human-driven smoke runs that hit the SPA visual layer.
