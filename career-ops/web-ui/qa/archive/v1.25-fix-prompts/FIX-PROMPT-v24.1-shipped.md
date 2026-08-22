# career-ops-ui v1.24.0 → v1.24.1 / v1.25.0 · CURRENT FIX-PROMPT

> **Stand state:** v1.24.0 verified live across 8 locales × 5 docs workflows (2026-05-14).
> See `qa/v24-regression/01-LIVE-8-LOCALES-WORKFLOWS.md` for the full evidence matrix.
>
> Most of the v1.10 / v1.14 / v1.15 backlog is **closed** (17 of 19 F-* findings, 8 of 11 G-* findings).
> See `qa/archive/` for the historical fixes.

## Open findings at v1.24.0

| ID | Severity | Title | Target release |
|---|---|---|---|
| **G-015** | **🚨 BLOCKER** | `/#/config` crashes — `c(...).also is not a function` on all 8 locales | **v1.24.1 hot-fix** |
| G-014 | Minor (DoS-risk) | `/api/auto-pipeline` ignores `mode: 'manual'` flag → always goes live | v1.25.0 |
| G-012 | Minor (docs) | CHANGELOG parity drift: EN at 1.24, RU at 1.23, 6 other locales at 1.22 | v1.25.0 |
| G-005 | Minor (docs) | Report block structure A-G in our prompts vs canonical A-F at career-ops.org/docs | v1.25.0 (coordinated parent commit) |
| G-003 | Minor (cosmetic) | `README.cn.md` → `README.zh-CN.md` for consistency with rest of i18n | v1.25.0 |
| Cosmetic | Trivial | Dashboard button shows `✨ ✨ Auto-pipeline по URL` — double `✨` glyph | v1.25.0 |

---

# v1.24.1 hot-fix (SHIP TODAY)

## PR-A · `fix(config): replace removed Element.prototype.also call in config.js`

### Symptom

`http://127.0.0.1:4317/#/config` renders a page-level error card:

```
Ошибка / Error / 오류 / エラー / 错误 / 錯誤 / Erro
c(...).also is not a function
[Повторить]
```

Confirmed broken on **all 8 locales** (en, ru, es, pt-BR, ko, ja, zh-CN, zh-TW). All other 20 sidebar routes render correctly. `/api/health` returns ok+v1.24.0. The error is purely client-side, isolated to the config view.

### Root cause

v1.22.0 backlog item N-2 dropped the `Element.prototype.also` monkey-patch. The migration updated `public/js/views/cv.js:189` (you can see the explanatory comment there) but **missed `public/js/views/config.js:371`**, which still calls `.also((root) => …)` on a chained `c(...)`.

### Patch — `public/js/views/config.js`

Find the current broken tail (around line 363-380):

```js
return c('div', null, [
  c('div', { className: 'page-header' }, …),

  c('div', { className: 'card', style: { background: '#fff8e6', …} }, [
    c('strong', null, 'ℹ ' + t('config.bannerTitle', 'Both projects pick this up')),
    c('p', { style: { margin: '6px 0 0', fontSize: '14px' } },
      t('config.bannerBody', '…')),
  ]),

  tabsHost,
  panelHost,
]).also((root) => {                                  // ← THIS LINE IS THE BUG
  const want = tabFromHash();
  const panel = want === modesLabel ? modesPanel
              : want === profileLabel ? profilePanel
              : apiPanel;
  activate(want, panel);
});
```

Replace with the free-statement pattern (mirror of `cv.js:189`):

```js
const root = c('div', null, [
  c('div', { className: 'page-header' }, …),

  c('div', { className: 'card', style: { background: '#fff8e6', …} }, [
    c('strong', null, 'ℹ ' + t('config.bannerTitle', 'Both projects pick this up')),
    c('p', { style: { margin: '6px 0 0', fontSize: '14px' } },
      t('config.bannerBody', '…')),
  ]),

  tabsHost,
  panelHost,
]);

// v1.24.1 (G-015) — was `.also((root) => …)` via Element.prototype.also,
// dropped by v1.22.0 N-2 without migrating this view. Default to the
// API-keys tab unless the hash deep-links to Profile or Modes.
{
  const want = tabFromHash();
  const panel = want === modesLabel ? modesPanel
              : want === profileLabel ? profilePanel
              : apiPanel;
  activate(want, panel);
}

return root;
```

**Risk:** zero. The block is purely behavioural setup (active-tab selection on first render); no DOM mutations after the tree is assembled. The same pattern is already proven in `cv.js:189`.

### CI gate to prevent recurrence

Add `scripts/check-no-also-leftovers.mjs`:

```js
#!/usr/bin/env node
// Fails the build if any view JS still calls `.also(` (Element.prototype.also was removed in v1.22.0).
import { execSync } from 'node:child_process';
import path from 'node:path';

try {
  const out = execSync(
    "grep -rEn '\\.also\\(' public/js/views/ | grep -v '//.*\\.also'",
    { encoding: 'utf8' }
  ).trim();
  if (out) {
    console.error('::error::Element.prototype.also call sites found:\n' + out);
    process.exit(1);
  }
} catch (e) {
  // grep exits 1 when no matches — that's the desired state
  if (e.status !== 1) throw e;
}
console.log('✓ no .also( leftovers in views/');
```

Wire into `package.json` postinstall + CI:

```json
{
  "scripts": {
    "test:ci": "npm test && node scripts/check-no-also-leftovers.mjs && node scripts/help-i18n-check.mjs"
  }
}
```

### Tests

```js
// tests/config-view-renders.test.mjs (new)
import { test } from 'node:test';
import assert from 'node:assert/strict';
// pseudo-Playwright; adjust to project's e2e harness
test('/#/config renders without TypeError on every locale', async () => {
  for (const loc of ['en','ru','es','pt-BR','ko','ja','zh-CN','zh-TW']) {
    await page.goto(BASE + '/#/dashboard');
    await page.click(`[data-lang-btn="${loc}"]`);
    await page.goto(BASE + '/#/config');
    await page.waitForSelector('h1');
    const text = await page.textContent('main');
    assert.equal(/is not a function/.test(text), false, `locale ${loc} crashed`);
  }
});
```

### Release

```bash
cd /Users/sergejemelanov/Projects/career-ops/web-ui
# Apply the patch above to public/js/views/config.js
npm test                                # unit/e2e all green
node scripts/check-no-also-leftovers.mjs # passes
# Manual smoke on /#/config in 1-2 locales
npm version patch                       # 1.24.0 → 1.24.1
git push --tags
```

This is the only PR in v1.24.1. The rest below bundle into v1.25.0.

---

# v1.25.0 (next regular release)

## PR-B · `fix(auto-pipeline): honor mode:'manual' short-circuit` (G-014)

### Symptom

```js
fetch('/api/auto-pipeline', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://job-boards.greenhouse.io/anthropic/jobs/x', mode: 'manual' })
})
// → hangs 1-3 minutes (live Anthropic call), regardless of mode:'manual' flag
```

### Why this matters

Mirrors the F-009 issue we fixed for `/api/evaluate` in v1.10.x. The other prompt-builder routes (`/api/deep`, `/api/mode/<slug>`) honor `mode: 'manual'` and return a copy-pasteable prompt without spending API credits. Auto-pipeline doesn't. Side effects:

1. **DoS-risk on public bind** — even with `llmRateLimit` (10 req/60s), 10 attackers × 10 reqs/min each = $50/min in Anthropic spend.
2. **CI / test friction** — any e2e test of `/api/auto-pipeline` against a stand with `ANTHROPIC_API_KEY` set hangs past the 45 s CDP timeout.

### Patch — `server/lib/routes/auto-pipeline.mjs:158`

Add a short-circuit at the top of the handler, before the heavy LLM call:

```js
app.post('/api/auto-pipeline', llmRateLimit, async (req, res) => {
  const { url, mode, lang } = req.body || {};

  // Validate URL up front (existing isValidJobUrl call stays)
  if (!isValidJobUrl(url)) return res.status(400).json({ error: 'invalid url' });

  // v1.25.0 (G-014) — honor explicit `mode: 'manual'` so CI / preview /
  // smoke flows can exercise the orchestrator shape without paying $0.30
  // per request to Anthropic. Mirror /api/evaluate which already does
  // this since v1.10.2.
  if (mode === 'manual') {
    const stages = [
      { stage: 'validate', status: 'ok' },
      { stage: 'fetch',    status: 'skipped (manual mode)' },
      { stage: 'evaluate', status: 'manual-prompt', prompt: buildOfertaPrompt({ jd: '', lang }) },
      { stage: 'save-report', status: 'skipped (manual mode)' },
      { stage: 'tracker',  status: 'skipped (manual mode)' },
    ];
    return res.json({ mode: 'manual', stages, message: 'Manual mode — no live LLM call made.' });
  }

  // …existing live path…
});
```

### Test

```js
test('POST /api/auto-pipeline honors mode:manual even with key set', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-test-fake';
  const t0 = Date.now();
  const r = await fetch(BASE + '/api/auto-pipeline', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://job-boards.greenhouse.io/anthropic/jobs/x', mode: 'manual' })
  });
  const j = await r.json();
  assert.ok(Date.now() - t0 < 500, 'must return in <500 ms');
  assert.equal(j.mode, 'manual');
  assert.equal(j.stages.length, 5);
});
```

---

## PR-C · `chore(changelog): backfill 1.23 + 1.24 entries in 7 non-EN locales` (G-012)

Current state (verified `wc -l CHANGELOG*.md` head):

| File | Newest entry |
|---|---|
| `CHANGELOG.md` (EN canonical) | 1.24.0 |
| `CHANGELOG.ru.md` | 1.23.0 (1 release behind) |
| `CHANGELOG.es.md` | 1.22.0 |
| `CHANGELOG.pt-BR.md` | 1.22.0 |
| `CHANGELOG.ko-KR.md` | 1.22.0 |
| `CHANGELOG.ja.md` | 1.22.0 |
| `CHANGELOG.zh-CN.md` | 1.22.0 |
| `CHANGELOG.zh-TW.md` | 1.22.0 |

### Action

1. Use the same parallel translation-agents pattern from v1.23.0 ("переводы тел CHANGELOG в 6/7 локалях через параллельные translation agents"), this time for the **v1.23.0 + v1.24.0** body translations in the 6 lagging locales.
2. RU only needs v1.24.0 body translated.
3. After: `grep -c "## \[1.24.0\]" CHANGELOG*.md` → 8.

### CI gate to prevent recurrence

```bash
# scripts/check-changelog-parity.mjs
node -e "
const fs = require('fs');
const en = (fs.readFileSync('CHANGELOG.md','utf8').match(/^## \[(\d+\.\d+\.\d+)\]/m) || [])[1];
for (const f of ['ru','es','pt-BR','ko-KR','ja','zh-CN','zh-TW']) {
  const c = fs.readFileSync('CHANGELOG.' + f + '.md','utf8');
  const v = (c.match(/^## \[(\d+\.\d+\.\d+)\]/m) || [])[1];
  if (v !== en) { console.error('::error::CHANGELOG.' + f + '.md is at ' + v + ', EN is at ' + en); process.exit(1); }
}
"
```

---

## PR-D · `fix(evaluate): realign report blocks A-F per canonical career-ops.org/docs` (G-005)

### Current divergence

Our `modes/oferta.md` (parent project) emits **A-G**:

- A. Role Summary
- B. CV Match
- C. **Risks**
- D. Compensation
- E. **Application Strategy**
- F. **Verdict** (score)
- G. **Posting Legitimacy**

Canonical career-ops.org/docs (Quick Start "Reading your results" + scan-job-portals "Read the scan output") promises **A-F**:

- A. plain-English role summary
- B. CV match table
- C. **Strategy** recommendation
- D. Compensation research
- E. **Personalization** notes
- F. **STAR stories**

Reports written by our system end up labeled "C. Risks" / "F. Verdict" / "G. Posting Legitimacy" — users coming from the canonical docs expect different content under those letters.

### Coordinated commit

This requires a parallel commit in the **parent project** (`santifer/career-ops`):

1. Rewrite `modes/oferta.md` to emit canonical A-F:
   - A = Role Summary (fold C-Risks bullets into A as a "Risks" sub-list)
   - B = CV Match
   - **C = Strategy** (rename current E)
   - D = Compensation (unchanged)
   - **E = Personalization** (new — distill from interview-prep notes if available)
   - **F = STAR stories** (replace current F; current F's score → report header `score: N.N/5`)
   - **Drop G** (legitimacy → header tag, already rendered on `#/reports` cards)

2. In `web-ui/`:
   - Update `server/lib/prompts.mjs::SCAFFOLD_STRINGS` per-locale block names.
   - Update `docs/help/<locale>.md` §9 (Evaluate) in all 8 bundles to describe A-F instead of A-G.
   - Update `public/js/views/reports.js` to NOT special-case `## G.` — accept arbitrary block letters.

### Migration / backward compat

Pre-v1.25 reports use A-G. The renderer must still display them as-is. Add a small front-matter note that the canonical schema is now A-F and any report written after the v1.25 release will use the new structure.

---

## PR-E · `chore: rename README.cn.md → README.zh-CN.md` (G-003)

```bash
cd /Users/sergejemelanov/Projects/career-ops/web-ui
git mv README.cn.md README.zh-CN.md
sed -i.bak 's|README\.cn\.md|README.zh-CN.md|g' README.md docs/*.md
rm README.md.bak docs/*.bak 2>/dev/null

# Verify
grep -l "README.cn.md" . -r 2>/dev/null   # should be empty
ls README*.md | grep -E '\.(zh-CN|zh-TW|ru|es|pt-BR|ko-KR|ja)\.md|README\.md'   # 8 files, canonical names
```

The Chinese-Simplified README is the only one using a non-canonical 2-letter language code. Every other surface in the project (CHANGELOG, docs/help, i18n bundle keys) uses `zh-CN`. This rename aligns the README with the rest.

---

## PR-F · `fix(dashboard): deduplicate ✨ glyph in auto-pipeline button label` (cosmetic)

### Symptom

Dashboard hero button text renders as **`✨ ✨ Auto-pipeline по URL`** (double ✨). Looks like the glyph is in both the i18n value AND prepended in the view code.

### Patch — `public/js/views/dashboard.js`

Find around line 58:

```js
c('button', { className: 'btn btn-primary', onclick: openAutoPipelineModal },
  '✨ ' + t('dash.autoPipeline', '✨ Auto-pipeline a URL')),   // ← double ✨
```

Fix — pick one:

```js
// Option A: drop the literal in the view (preferred — keeps the glyph in i18n where translators can change it)
c('button', { className: 'btn btn-primary', onclick: openAutoPipelineModal },
  t('dash.autoPipeline', '✨ Auto-pipeline a URL')),

// Option B: drop the glyph from i18n defaults (and from each locale's bundle)
c('button', { className: 'btn btn-primary', onclick: openAutoPipelineModal },
  '✨ ' + t('dash.autoPipeline', 'Auto-pipeline a URL')),
```

Audit the rest of the i18n bundle for similar double-glyph patterns — `🌐`, `▶`, `💾`, `📁`, `📄`, `📊` are likely candidates.

---

# Build order for v1.25.0

1. **PR-B** — auto-pipeline manual flag (closes DoS-risk; 1 hour)
2. **PR-F** — cosmetic ✨ dedup (10 minutes)
3. **PR-E** — README rename (10 minutes)
4. **PR-C** — CHANGELOG backfill (translation agents, 2-3 hours background work)
5. **PR-D** — A-F realignment (coordinated parent commit; biggest semantic change, 1 day)

---

# Final acceptance checks

```bash
cd /Users/sergejemelanov/Projects/career-ops/web-ui
npm test                                              # all green
npm run test:coverage                                 # ≥ 80% line/branch (baseline 93/83)
npm run test:e2e:full
node scripts/check-no-also-leftovers.mjs              # G-015 gate
node scripts/check-no-enru-bleed.mjs                  # G-001/F-010 history gate
node scripts/help-i18n-check.mjs                      # 16 H2 per locale
node scripts/check-changelog-parity.mjs               # new: G-012 gate
node scripts/canonical-docs-coverage.test.mjs         # 5 URLs × 8 locales

# Manual smoke after v1.24.1 / v1.25 deploy
1. Open #/config in EN → see API keys + Profile + Modes tabs (no "is not a function")
2. Switch locale to ru / ja / ko / zh-CN → /#/config still renders (no regression)
3. POST /api/auto-pipeline { mode: 'manual' } → returns in <500 ms with mode:'manual' in body
4. Dashboard auto-pipeline button text → "✨ Auto-pipeline a URL" (single ✨)
5. ls README*.md → 8 files, all canonical names
6. grep -c '## \[1.24.0\]' CHANGELOG*.md → 8 (or 8 of latest after v1.25)
```

Tag and ship.
