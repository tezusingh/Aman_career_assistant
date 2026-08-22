# Fix-prompt for Claude Code · career-ops-ui v1.14.0 → v1.15.0

> Apply against `/Users/sergejemelanov/Projects/career-ops/web-ui/`. Commits follow Conventional Commits. Land in the order given. After each PR run `npm test` and the regression CI gates (`scripts/check-no-enru-bleed.mjs`, `scripts/help-i18n-check.mjs`).

The goal of this release is **doc conformance** — bring the UI in line with what users see on <https://career-ops.org/docs> so the same workflow promised by the canonical CLI works end-to-end through the browser, on every locale.

---

## PR-A · `fix(evaluate): realign Block A-F with canonical career-ops.org rubric` (G-005)

### Scope

`modes/oferta.md` in the **parent** project owns the prompt template. CLAUDE.md hard rule #1 forbids editing parent files from web-ui, so this PR is a coordinated change:

1. **Parent commit** (`santifer/career-ops`): rewrite `modes/oferta.md` to emit canonical A-F:
   - A. Role Summary
   - B. CV Match (top 3 hits + top 3 gaps)
   - C. **Strategy** (renamed from Risks; risks moved into A as bullets)
   - D. Compensation
   - E. **Personalization** (renamed from Application Strategy)
   - F. **STAR stories** (replaces Verdict; verdict moves to the report header `score: N.N/5`)
   - **G is removed**; legitimacy moves to header `legitimacy: High|Medium|Low` (already rendered as a tag on `#/reports` cards).

2. **web-ui commit** (this PR):
   - `server/lib/prompts.mjs` — update any block-name strings in `SCAFFOLD_STRINGS` (Russian "G. Легитимность" → drop; "C. Риски" → "C. Стратегия"; "F. Вердикт" → "F. STAR-истории"; …).
   - `docs/help/<locale>.md` §9 Evaluate — update the block list in 8 locales.
   - `public/js/views/evaluate.js` — if the page renders A-G section headers, drop G; relabel C / E / F per canonical.
   - `public/js/views/reports.js` — surface `legitimacy` (already done) and `verdict` from header; drop any code that parses `## G.` section.
   - Add a small migration note in CHANGELOG: "Reports written before v1.15 used A-G with Risks/Verdict/Legitimacy blocks; we still render them as-is."

### Tests

- `tests/eval-blocks-canonical.test.mjs` — assert prompt-generated markdown has exactly `## A.` through `## F.` H2s, no `## G.`
- Snapshot test: `#/reports/<existing-pre-1.15-slug>` still renders without console errors.

---

## PR-B · `feat(tracker): Legitimacy column + canonical batch result table` (G-006)

### Changes

1. **`server/lib/routes/tracker.mjs`** — when serializing `data/applications.md` rows, include `legitimacy` field (parse from the existing markdown column or derive from the report header).

2. **`public/js/views/tracker.js`**:
   ```js
   c('th', null, t('track.col.legitimacy', 'Legitimacy')),
   // ...
   c('td', null, r.legitimacy
     ? c('span', { className: 'badge ' + legitimacyClass(r.legitimacy) }, r.legitimacy)
     : c('span', { className: 'muted' }, '—')),
   ```

3. **i18n keys** (8 locales):
   ```json
   "track.col.legitimacy": {
     "en": "Legitimacy", "ru": "Достоверность", "es": "Legitimidad",
     "pt-BR": "Legitimidade", "ja": "信頼性", "ko": "신뢰도",
     "zh-CN": "可信度", "zh-TW": "可信度"
   }
   ```

4. **Optional** — also add the column to `#/batch` pending-additions preview.

### Tests

- Snapshot of `#/tracker` with seed of 3 rows (one with `Legitimacy: High`, one Medium, one missing) — assert badges render correctly.

---

## PR-C · `feat(auto-pipeline): 1-click "paste URL → full report + PDF + tracker"` (G-007) **biggest UX win**

### Goal

Match the canonical promise: "career-ops detects the URL and runs the full pipeline." Today users do it in 3-5 manual steps.

### Server

```js
// server/lib/routes/auto-pipeline.mjs (new)
//
// POST /api/auto-pipeline { url }    SSE stream
//   1. validate URL (isValidJobUrl)
//   2. fetch JD text via SSRF-safe proxy (existing /api/pipeline/preview helper)
//   3. POST /api/evaluate { jd, save: true, lang } → get report markdown + score + slug
//   4. POST /api/pdf/inline { markdown, filename: '<slug>.pdf' } → output/<slug>.pdf
//   5. POST /api/tracker { company, role, score, status: 'Evaluated', url, reportSlug }
//   6. recordActivity('auto-pipeline.done', { url, slug, score })
//
// SSE events:
//   start  → { steps: 5, url }
//   step   → { i, label, status: 'running' | 'done' | 'failed', detail }
//   done   → { slug, pdfPath, trackerRow, score, legitimacy }
//   error  → { step, message }
//
// On any step failure: emit error, stop, return what was completed.
// The user can still navigate to a partial report.

import { registerAutoPipelineRoutes } from './auto-pipeline.mjs';
registerAutoPipelineRoutes(app);
```

### Front-end

Three places to expose the button:

1. **`#/dashboard`** — primary CTA "✨ Paste URL & Auto-pipeline" replaces / augments today's "Quick scan" pill.
2. **`#/pipeline`** — small "✨ Auto" button next to each unevaluated URL.
3. **Global `Cmd+K`** — paste a URL → Enter runs auto-pipeline (instead of just adding to pipeline).

```js
// public/js/views/dashboard.js
c('button', { className: 'btn btn-primary',
  onclick: () => openAutoPipelineModal() },
  t('dash.autoPipeline', '✨ Auto-pipeline a URL'));
```

Modal renders an SSE-log timeline:

```
[●]  1/5  Validating URL                                  ✓ 0.1 s
[●]  2/5  Fetching job description (SSRF-safe proxy)      ✓ 1.8 s
[●]  3/5  Evaluating against your CV (Anthropic live)     … 47 s
[●]  4/5  Generating tailored PDF (Playwright)            … pending
[ ]  5/5  Adding to tracker                               waiting
```

On `done`: redirect to `#/reports/<slug>` with the PDF link already in place.

### i18n keys

```json
{
  "dash.autoPipeline":        "✨ Auto-pipeline a URL",  // EN
  "auto.step.validate":       "Validating URL",
  "auto.step.fetch":          "Fetching job description",
  "auto.step.evaluate":       "Evaluating against your CV ({mode})",
  "auto.step.pdf":            "Generating tailored PDF",
  "auto.step.tracker":        "Adding to tracker",
  "auto.done":                "Auto-pipeline complete — opening report…",
  "auto.failed":              "Auto-pipeline failed at step {i}: {message}"
}
```

Localize naturally to ru/es/pt-BR/ko/ja/zh-CN/zh-TW.

### Tests

- `tests/auto-pipeline-success.test.mjs` — mocks Anthropic + Playwright, asserts all 5 steps complete, file `output/<slug>.pdf` exists, tracker row appended.
- `tests/auto-pipeline-failure.test.mjs` — Anthropic returns 500, assert SSE `error` event with step=3 and no tracker row appended.

---

## PR-D · `feat(profile): expose modes/_profile.md as a first-class editor` (G-008)

### Goal

The single most-edited file per canonical docs (Quick Start §Step-5) has no UI surface today. Add a "Modes" tab next to "API keys & runtime" and "Profile" on `#/config`.

### Server

```js
// server/lib/routes/content.mjs — extend with two routes
const MODES_PROFILE = path.join(parentRoot, 'modes', '_profile.md');
const MODES_PROFILE_TEMPLATE = path.join(parentRoot, 'modes', '_profile.template.md');

app.get('/api/modes/profile', (_req, res) => {
  let markdown = '';
  try { markdown = readFileSync(MODES_PROFILE, 'utf8'); }
  catch {
    // scaffold from template on first read
    try {
      markdown = readFileSync(MODES_PROFILE_TEMPLATE, 'utf8');
      writeFileSync(MODES_PROFILE, markdown);
    } catch {
      markdown = '# Career framing\n\nFill in your target roles, framing, narrative…\n';
    }
  }
  res.json({ markdown, bytes: Buffer.byteLength(markdown) });
});

app.put('/api/modes/profile', (req, res, next) => {
  const md = req.body?.markdown;
  if (typeof md !== 'string') return res.status(400).json({ error: 'markdown body required' });
  if (Buffer.byteLength(md) > 256 * 1024) return res.status(413).json({ error: 'modes/_profile.md too large (max 256 KB)' });
  const sanitized = stripDangerousMarkdown(md);
  atomicWriteFile(MODES_PROFILE, sanitized.text);
  recordActivity('modes_profile.save', { target: 'modes/_profile.md', bytes: Buffer.byteLength(sanitized.text) });
  res.json({ ok: true, sanitized: sanitized.changed, bytes: Buffer.byteLength(sanitized.text) });
});
```

### Front-end

```js
// public/js/views/config.js — add tab
const TABS = [
  { id: 'api',     i18n: 'config.tabApiKeys',  view: renderApiKeysTab },
  { id: 'profile', i18n: 'config.tabProfile',  view: renderProfileTab },
  { id: 'modes',   i18n: 'config.tabModes',    view: renderModesTab },     // NEW
];

function renderModesTab() {
  return [
    c('p', { className: 'hint' }, t('config.modesHint',
      'modes/_profile.md is your private career framing — never committed. Used by every evaluation, deep research, and outreach prompt.')),
    c('textarea', { /* bound to /api/modes/profile */ }),
    c('button', { onclick: saveModes }, t('common.save', '💾 Save')),
  ];
}
```

### Profile read-only card

```js
// public/js/views/profile.js — add a second card below the YAML preview
c('div', { className: 'card' }, [
  c('h2', null, t('profile.framingTitle', 'Career framing')),
  c('p', { className: 'muted' }, t('profile.framingHint',
    "modes/_profile.md drives every prompt's understanding of your target roles and narrative.")),
  c('a', { href: '#/config?tab=modes' }, t('profile.editModes', 'Edit in App settings → Modes')),
]);
```

### i18n keys × 8 locales

```
config.tabModes:        "Modes" / "Режимы" / "Modos" / …
config.modesHint:       "modes/_profile.md is your private career framing…"
profile.framingTitle:   "Career framing"
profile.framingHint:    "modes/_profile.md drives every prompt…"
profile.editModes:      "Edit in App settings → Modes"
```

### Tests

- `tests/modes-profile-crud.test.mjs` — GET returns scaffolded markdown on first read; PUT 200 on valid; PUT 413 on 257 KB body; PUT 400 on non-string body.
- Snapshot of `#/config?tab=modes` shows a textarea + Save button + hint.

---

## PR-E · `feat(profile): add location + narrative.headline, accept canonical schema` (G-009)

### Goal

Bring the profile schema closer to what career-ops.org docs §Step-3 promise.

### Server changes

`server/lib/routes/content.mjs::renderProfile()` (or wherever profile YAML is parsed for the `/api/profile` summary):

```js
function summarizeProfile(yaml) {
  // Accept both legacy and canonical shapes; legacy wins if both present
  const candidate = yaml.candidate || {};
  const target = yaml.target || {};
  const targetRoles = yaml.target_roles || {};
  const compensation = yaml.compensation || {};
  const narrative = yaml.narrative || {};
  return {
    full_name: candidate.full_name || yaml.full_name || null,
    email:     candidate.email     || yaml.email     || null,
    linkedin:  candidate.linkedin  || yaml.linkedin  || null,
    location:  candidate.location  || yaml.location  || null,                       // NEW
    headline:  candidate.headline  || narrative.headline || null,                   // NEW
    target_roles: target.roles || targetRoles.primary || [],
    comp_min_usd: target.comp_total_min_usd
                 || parseCompRange(compensation.target_range)?.min
                 || null,                                                            // accept canonical
    archetypes: target.archetypes || []
  };
}
```

### Front-end `#/profile`

Add two new card fields:

```js
c('dt', null, t('profile.location', 'Location')),
c('dd', null, p.location || c('span', { className: 'muted' }, t('profile.missing', '— not set'))),

c('dt', null, t('profile.headline', 'Headline')),
c('dd', null, p.headline || c('span', { className: 'muted' }, t('profile.missing', '— not set'))),
```

### `#/config → Profile` validation messages

Today errors say `"profile must be a YAML mapping"` and `"profile.candidate is required"`. Accept either `candidate:` OR top-level `full_name:` (canonical shape). Update validation:

```js
if (typeof yamlObj !== 'object' || Array.isArray(yamlObj)) {
  return res.status(400).json({ error: 'profile must be a YAML mapping' });
}
const hasCandidate = yamlObj.candidate || yamlObj.full_name;
if (!hasCandidate) {
  return res.status(400).json({ error: 'profile.candidate (or top-level full_name) is required' });
}
```

### Tests

- Accepts canonical schema: `{ full_name, email, location, target_roles: { primary } }`
- Accepts legacy schema: `{ candidate: { full_name, … }, target: { roles, archetypes } }`
- Mixed schema: legacy wins.

---

## PR-F · `docs: seniority_boost + search_queries in help §5 + scaffold` (G-010)

### Changes

1. **`docs/help/<locale>.md` §5** (Portals) — add a paragraph after the `negative` keywords block:

   ```
   `seniority_boost` is the third title-filter key. Keywords listed here
   don't filter anything out — they push matching jobs higher in the
   results. Default: ["Senior", "Staff", "Lead"]. Tune to match how your
   target roles are titled.
   ```

   Translate the paragraph into each of 8 bundles.

2. **`search_queries` example** — add a code block in §5:

   ```yaml
   search_queries:
     - name: "Greenhouse — Rails Engineer"
       query: 'site:job-boards.greenhouse.io "Rails Engineer" OR "Ruby on Rails" remote'
       enabled: true
   ```

   With a one-line explanation that these run only via the AI-powered Option B scan (Claude CLI).

3. **`bin/start.sh` portals.yml scaffold** — bump the default `title_filter` to include `seniority_boost: ["Senior", "Staff", "Lead"]`.

### Tests

- Same `help-i18n-check.mjs` parity gate; H2 count stays at 16 per locale.

---

## PR-G · `chore: carryover fixes from v1.14 regression` (G-001..G-004)

### G-001 · Replace `scan.noResults` EN/RU literal in i18n bundle (was F-010)

`public/js/lib/i18n.js:312` — replace 8 strings with locale-agnostic copy:

```js
'scan.noResults': {
  en:      'No results. Run a scan above — results will appear here once it finishes.',
  ru:      'Нет результатов. Запустите скан выше — результаты появятся здесь после завершения.',
  es:      'Sin resultados. Ejecuta un escaneo arriba — los resultados aparecerán al terminar.',
  'pt-BR': 'Sem resultados. Execute uma varredura acima — os resultados aparecerão ao terminar.',
  ko:      '결과 없음. 위에서 스캔을 실행하세요 — 완료 시 여기에 표시됩니다.',
  ja:      '結果なし。上からスキャンを実行してください — 完了時に表示されます。',
  'zh-CN': '无结果。在上方运行扫描 — 完成后将显示在此处。',
  'zh-TW': '無結果。在上方執行掃描 — 完成後將顯示在此處。'
}
```

Run `scripts/check-no-enru-bleed.mjs` — should pass after.

### G-002 · Add `📄 Generate PDF` to `#/interview-prep` (was F-015)

Mirror the deep.js pattern — single button on the result panel, wired to `/api/pdf/inline { markdown, filename: '<co>-<role>-interview.pdf' }`.

### G-003 · Rename `README.cn.md` → `README.zh-CN.md`

```bash
git mv README.cn.md README.zh-CN.md
sed -i.bak 's|README\.cn\.md|README.zh-CN.md|g' README.md docs/*.md
rm README.md.bak docs/*.bak 2>/dev/null
```

Update any link from `README.md` index that pointed at `.cn.md`.

### G-004 · Add deprecation warnings to `/api/stream/scan-en` + `/api/stream/scan-ru`

```js
// server/lib/routes/scan.mjs
const DEPRECATION_HEADER = 'Wed, 01 Oct 2026 00:00:00 GMT';  // 4-5 months ahead

app.get('/api/stream/scan-en', (req, res) => {
  console.warn('[deprecated] /api/stream/scan-en will be removed in v1.16.0 — use /api/stream/scan?source=ats');
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', DEPRECATION_HEADER);
  res.setHeader('Link', '</api/stream/scan?source=ats>; rel="successor-version"');
  // existing handler…
});
// same for /api/stream/scan-ru
```

---

## Build order

1. **PR-G** first — quick wins, removes the most visible carryover (`EN or RU scan` literal still in production).
2. **PR-F** — docs-only, no risk.
3. **PR-E** — server-side accept canonical profile.yml schema (backward-compatible).
4. **PR-D** — `modes/_profile.md` editor (largest gap closure for canonical docs §Step-5).
5. **PR-B** — Legitimacy column (cheap UX polish).
6. **PR-A** — Block A-F realignment (coordinated with parent commit; biggest semantic change).
7. **PR-C** — Auto-pipeline (biggest UX win; ship last so all the underlying endpoints from PR-A and PR-D are in place).

---

## Final acceptance checks before v1.15.0 tag

```bash
npm test
npm run test:coverage     # ≥ 80% line, ≥ 80% branch (current 93/83)
npm run test:e2e:full

node scripts/portals-health-check.mjs                  # all portals reachable
node scripts/check-no-enru-bleed.mjs                   # ✓ no EN/RU literal
node scripts/check-no-en-bleed-on-non-en-locales.mjs   # ✓ no EN token on non-EN UI
node scripts/help-i18n-check.mjs                       # ✓ all 8 bundles = 16 H2
node scripts/canonical-schema-check.mjs                # ✓ profile.yml canonical fields accepted
node scripts/block-letters-check.mjs                   # ✓ evaluate emits A-F, no G

# Manual smoke
1. Open #/dashboard, paste a real Anthropic URL into Cmd+K → ✨ Auto-pipeline → wait ~60-90 s → land on #/reports/<slug> with PDF + tracker row.
2. Open #/config → Modes → edit `modes/_profile.md` → 💾 Save → reload → text persists.
3. Open #/reports/<any-slug> — confirm A-F structure (no Block G).
4. Open #/tracker — confirm Legitimacy column visible with badge tinting.
5. Open #/scan → empty state — confirm "Run a scan above" copy (no "EN or RU").
6. Switch to ko → open #/help — confirm Korean body (no English fallback).
7. Switch to zh-CN → open #/scan — confirm no "Doctor / Quick scan" EN bleed.
```

Tag and ship as v1.15.0.



---

## PR-H · `fix(routing): dedupe sidebar; route #/batch to v1.13.0 TSV SPA, not mode-prompt builder` (G-011)

### Goal
Today `#/batch` is registered **twice** in the sidebar (under "Decision" and "Application") and both entries go to the legacy mode-prompt builder (`ModePromptView`). The v1.13.0 TSV SPA (`public/js/views/batch.js`, 8 KB; `server/lib/routes/batch.mjs`, 4 endpoints) exists but is unreachable from navigation. Same problem on `#/dashboard` (duplicated).

### Changes

1. **`public/js/views/sidebar.js`** — single canonical sidebar registry. Remove the duplicate `/batch` entry under the "Application" group and the duplicate `/dashboard` entry. Keep one per route, grouped per its semantic home (Decision for batch, top for dashboard).

2. **`public/js/router.js`** (or equivalent) — route `/#/batch` to `BatchTsvView` (from `public/js/views/batch.js`). Keep the legacy mode-prompt batch builder available at `/#/batch-prompt` for any deep-linked bookmarks, with a one-release deprecation notice rendered at the top.

```js
// public/js/router.js
const ROUTES = {
  '/batch':         { view: BatchTsvView },                       // NEW canonical
  '/batch-prompt':  { view: ModePromptView, mode: 'batch',
                      deprecation: 'Use /batch — the TSV SPA. This route will be removed in v1.16.' }
};
```

3. **CI gate** — `scripts/check-sidebar-dedupe.mjs` asserts no `href` appears more than once in the rendered sidebar.

### Tests

```js
test('sidebar has no duplicate hrefs', () => {
  const html = renderSidebar({ locale: 'en' });
  const hrefs = [...html.matchAll(/href="(#\/[^"]+)"/g)].map(m => m[1]);
  const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
  assert.deepEqual(dupes, []);
});

test('/#/batch renders TSV editor SPA, not mode-prompt builder', async () => {
  await page.goto(BASE + '/#/batch');
  // TSV SPA has these specific controls
  assert.ok(await page.$('textarea[name="tsv"]'));
  assert.ok(await page.$('select[name="parallel"]'));
  assert.ok(await page.$('input[name="min-score"]'));
  assert.ok(await page.$('input[type="checkbox"][name="dry-run"]'));
});
```

---

## PR-I · `docs: localized hero images in each README` (this task)

### Goal
Today every README (in 8 locales) points at the same English-locale screenshot (`./public/images/screen_vacancy_found.png`). Replace with one locale-specific dashboard screenshot per language.

### Already-applied changes in v1.14.x branch

This PR was partially applied during the QA session:

```
web-ui/README.md         → ![career-ops-ui — Command Center](./images/dashboard-en.png)
web-ui/README.ru.md      → ![career-ops-ui — Командный центр](./images/dashboard-ru.png)
web-ui/README.es.md      → ![career-ops-ui — Centro de Comando](./images/dashboard-es.png)
web-ui/README.pt-BR.md   → ![career-ops-ui — Centro de Comando](./images/dashboard-pt-BR.png)
web-ui/README.ko-KR.md   → ![career-ops-ui — 커맨드 센터](./images/dashboard-ko-KR.png)
web-ui/README.ja.md      → ![career-ops-ui — コマンドセンター](./images/dashboard-ja.png)
web-ui/README.cn.md      → ![career-ops-ui — 指挥中心](./images/dashboard-zh-CN.png)
web-ui/README.zh-TW.md   → ![career-ops-ui — 指揮中心](./images/dashboard-zh-TW.png)
```

The 8 PNG files (`images/dashboard-<locale>.png`) need to be generated. The capture script is shipped at `scripts/capture-dashboard-screenshots.mjs` — uses parent Playwright, idempotent, takes ~20 s for all 8.

### Things to clean up after merge

1. Delete the `.bak` files left over from the in-session sed pass:
   ```bash
   cd /Users/sergejemelanov/Projects/career-ops/web-ui
   rm -f README.*.md.bak README.md.bak
   ```

2. Run the capture script once to generate the PNGs:
   ```bash
   # parent must have Playwright + chromium installed
   cd /Users/sergejemelanov/Projects/career-ops && npm install && npx playwright install chromium
   cd web-ui && npm start &     # server on 127.0.0.1:4317
   node scripts/capture-dashboard-screenshots.mjs
   ```

3. Commit the 8 PNGs + delete the old `public/images/screen_vacancy_found.png`:
   ```bash
   git add images/ README*.md
   git rm public/images/screen_vacancy_found.png
   git commit -m 'docs: localized dashboard hero images per README locale (PR-I)'
   ```

4. Optional: rename `README.cn.md` → `README.zh-CN.md` (canonical locale tag) per G-003. The image filename already uses `zh-CN`; the README filename inconsistency is the only remaining oddity.

### Long-term: CI should regenerate on demand

Add a workflow that runs the capture script on every PR that touches `public/css/app.css` or `public/js/views/dashboard.js`, then diffs the resulting PNGs against the committed ones. If any locale's dashboard changed visually, the PR must include refreshed screenshots. Sketch:

```yaml
# .github/workflows/dashboard-screenshots.yml
on:
  pull_request:
    paths: ['public/css/app.css', 'public/js/views/dashboard.js', 'public/js/lib/i18n.js']
jobs:
  diff-screenshots:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm start &
      - run: node scripts/capture-dashboard-screenshots.mjs
      - run: |
          if ! git diff --quiet web-ui/images/; then
            echo "::error::Dashboard screenshots changed but were not refreshed in this PR."
            git diff web-ui/images/
            exit 1
          fi
```

### Why dashboard, not scan-results

The earlier hero image (`screen_vacancy_found.png`) was the scan-results view full of test data. The dashboard:

- shows every section of the product (search & apply, research & prep, prompt builders, workspace, system) at a glance,
- doesn't depend on having a fresh scan history,
- highlights the localized chrome (sidebar groups, top buttons, KPI cards),
- communicates "command center" — the same name career-ops.org uses for the entry experience.

These eight dashboard PNGs become the README hero for each language. A non-EN user lands on their localized README, sees the UI labelled in their language, and immediately recognizes it.

