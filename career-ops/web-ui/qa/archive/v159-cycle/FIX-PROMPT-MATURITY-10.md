# FIX-PROMPT — career-ops-ui · MATURITY-10 (post-v1.58.51 → v1.59.0)

Final consolidated fix-prompt to lift career-ops-ui from its current **8.5 / 10** to **10 / 10**. Combines the two newly-found regressions from `2026-05-19-REGRESSION-v1.58.51.md` (NEW-K1 / NEW-M4-r1 → renamed UX-A5 / UX-A6) and all 15 UX-designer findings from `2026-05-19-UX-AUDIT.md` (UX-A1 → UX-A15).

Sequence: **14 single-fix releases v1.58.52 → v1.59.0**, doctrine-strict.

---

## §0 — Doctrine (non-negotiable)

> **ONE one-fix ship per release** — bump + CHANGELOG ×8 (parity-gated) + a dedicated test + Playwright-verify + pre-commit AI-review LGTM + CI-watch to green. Never batch. **HIGH → MEDIUM → LOW.** Pre-commit AI review is advisory; **`ci.yml` is the hard gate.**

**Hard rules** (re-stated):
1. **Parity** at every release.
2. **CI gates** must finish `success` on Node 18 / 20 / 22.
3. **8-locale parity** via `tests/i18n-coverage.test.mjs`.
4. **Security envelope** unchanged: CSP unconditional · `frame-ancestors 'none'` · `isValidJobUrl` rejections · `safeGet` SSRF · `UI.md()` escape-first · `validateConfig` no secret echo.
5. **Promise fidelity to `career-ops.org/docs`** — UI never alters or contradicts the documented journey.
6. **No batching.** Each numbered item below = its own release.

---

## §1 — Release queue (14 ships)

| Release | Ticket | Severity | Class | Effort |
|---|---|---|---|---|
| **v1.58.52** | UX-A5 (= NEW-K1) | MEDIUM | UX regression — Help TOC scroll-spy | 1 d |
| **v1.58.53** | UX-A6 (= NEW-M4-r1) | MINOR | UX regression — saved-card render | 1 d |
| **v1.58.54** | UX-A1 | HIGH (defensive) | Promise fidelity — Deep brief warning | 1 d |
| **v1.58.55** | UX-A3 | MEDIUM | Onboarding — Dashboard active-provider chip | 1 d |
| **v1.58.56** | UX-A2 | MEDIUM | Promise — Modes Target Roles / Comp Targets field-form | 2 d |
| **v1.58.57** | UX-A4 | MEDIUM | A11y — lang-picker target size | 0.5 d |
| **v1.58.58** | UX-A7 | MEDIUM | UX truthfulness — cost-line tracks `LLM_PROVIDER` | 1 d |
| **v1.58.59** | UX-A10 | LOW | Forms — `beforeunload` for dirty CV | 0.5 d |
| **v1.58.60** | UX-A13 | LOW | Health — "Fix this" CTAs | 0.5 d |
| **v1.58.61** | UX-A12 | LOW | Notifications drawer — Clear all / Dismiss | 1 d |
| **v1.58.62** | UX-A8 | LOW | README first-run cleanup section | 0.5 d |
| **v1.58.63** | UX-A9 | LOW | API-keys tab — active-provider sticky chip | 0.5 d |
| **v1.58.64** | UX-A15 | LOW | Dashboard Quick-actions reorder | 0.5 d |
| **v1.58.65** | UX-A11 | LOW | i18n — native-speaker copy-edit es/pt-BR `*.title` | 0.5 d |
| **v1.59.0** | UX-A14 | MEDIUM (cross-cycle) | Mobile (≤420 px) deep audit | 3 d |

**Estimated total:** ~14 days of focused work, paced over 2–3 weeks per the one-fix-per-release doctrine.

**Cross-repo (NOT this repo — defer):**
- **C-1 prompt-layer** (parent `modes/deep.md`) — UX-A1 here is the defensive workaround; root fix is parent-side.
- **G-005** (parent `modes/oferta.md`).
- **UX-022 stale portals** (parent `portals.yml`).
- **CLI-locale** — deferred to v1.59.x.

---

## §2 — Per-fix detailed spec

---

### FIX v1.58.52 · UX-A5 (NEW-K1) — Help TOC scroll-spy IntersectionObserver lifecycle (Medium)

Full spec already in `FIX-PROMPT-v1.58.52.md §2-FIX-v1.58.52`. Summary:

- **WHERE:** `web-ui/views/help.js` or `lib/help-toc.js`.
- **WHAT:** 18 H2 with ids, 18 TOC links, **0** ever get `.toc-current` after scroll.
- **HOW:** defensive `mountTocSpy()` runs on `hashchange` to `#/help` (with `requestAnimationFrame ×2` for DOM-ready); observer disconnects on route-away.
- **TEST:** `tests/e2e/help-toc-scroll-spy.spec.mjs` scrolls to `#help-h-5`, asserts `.toc-current` on the matching TOC link.

---

### FIX v1.58.53 · UX-A6 (NEW-M4-r1) — Saved-research card render unification (Minor)

Full spec in `FIX-PROMPT-v1.58.52.md §2-FIX-v1.58.53`. Summary:

- **WHERE:** `views/deep.js` saved-research card render path (and shared helper if any).
- **WHAT:** first card `software-engineer-generalyesterday` (no children); second card `story-bank yesterday` (proper structure).
- **HOW:** unified `renderSavedCard({name, isoDate, slug})` helper that always emits `<span>` + `<time>`.
- **TEST:** `tests/saved-card-structure.test.mjs` asserts every card has structural children with `<time datetime>`.

---

### FIX v1.58.54 · UX-A1 — Defensive structure check on Deep saved brief (HIGH-defensive)

**WHERE.** `web-ui/views/deep.js` saved-brief render path. Possibly a shared `renderSavedBrief()`.

**WHAT.** Live verified on v1.58.36 and v1.58.51: opening the `software-engineer-general` saved card shows model meta-narration ("Я запущу глубокое исследование … теперь сохраню брифинг") **without any of the 6 H2 sections** promised in the docs (Company snapshot / Engineering culture / Recent news / Glassdoor / Interview process / Negotiation leverage). The web-ui has shipped `cleanLlmMarkdown` stripper (FIX-C1) but no **content-shape check**.

**WHY.** The user opens what's labeled a "company brief" and gets a process log. Trust collapses. The parent's `modes/deep.md` prompt-layer fix is open (C-1, cross-repo, blocked) — the web-ui's responsibility is to **detect the deficit** and explain it.

**HOW.**

```js
const EXPECTED_DEEP_SECTIONS = [
  'Company snapshot',
  'Engineering culture',
  'Recent news',
  'Glassdoor',
  'Interview process',
  'Negotiation leverage',
];

function looksLikeStructuredBrief(markdown) {
  const found = EXPECTED_DEEP_SECTIONS.filter(s =>
    new RegExp('^##\\s+' + s, 'mi').test(markdown)
  );
  return found.length >= 3;
}

function renderSavedBrief(md, slug) {
  const html = UI.md(cleanLlmMarkdown(md));
  const warning = looksLikeStructuredBrief(md)
    ? ''
    : `<div class="brief-warning" role="status">
         <strong>${I18n.t('deep.briefUnstructured.title')}</strong>
         <p>${I18n.t('deep.briefUnstructured.body')}</p>
         <a href="https://career-ops.org/docs/reference/deep" target="_blank" rel="noopener noreferrer">
           ${I18n.t('deep.docsLink')}
         </a>
       </div>`;
  return warning + html;
}
```

i18n keys × 8 (drafts):
- `deep.briefUnstructured.title`:
  - en: `"This brief doesn't match the canonical 6-section structure"`
  - es: `"Este resumen no coincide con la estructura canónica de 6 secciones"`
  - pt-BR: `"Este resumo não corresponde à estrutura canônica de 6 seções"`
  - ko: `"이 브리프는 표준 6 섹션 구조와 일치하지 않습니다"`
  - ja: `"このブリーフは正規の 6 セクション構成と一致しません"`
  - ru: `"Этот брифинг не соответствует канонической 6-секционной структуре"`
  - zh-CN: `"该简报不符合规范的 6 节结构"`
  - zh-TW: `"此簡報不符合規範的 6 節結構"`
- `deep.briefUnstructured.body`: `"Re-run with `Run live`, or check `modes/deep.md` in your parent project to enforce the final-form output."` (× 8 locales)
- `deep.docsLink`: `"Read the deep-research reference"` (× 8 locales)

```css
.brief-warning {
  background: color-mix(in srgb, var(--warn) 12%, var(--bg));
  border-left: 3px solid var(--warn);
  padding: 12px 16px;
  margin-bottom: 16px;
  border-radius: var(--radius);
}
.brief-warning strong { color: var(--warn); }
.brief-warning p { margin: 4px 0 8px; }
.brief-warning a { color: var(--brand); text-decoration: underline; }
```

**TEST.** `tests/deep-brief-warning.test.mjs`:

```js
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderSavedBrief, looksLikeStructuredBrief } from '../web-ui/views/deep.js';

test('warning when fewer than 3 H2 sections', () => {
  const html = renderSavedBrief('I will now do deep research…');
  assert(/brief-warning/.test(html));
});

test('no warning when 3+ canonical sections present', () => {
  const md = `## Company snapshot\nfoo\n## Engineering culture\nbar\n## Recent news\nbaz`;
  const html = renderSavedBrief(md);
  assert(!/brief-warning/.test(html));
});

test('looksLikeStructuredBrief case-insensitive', () => {
  const md = `## company snapshot\n\n## ENGINEERING CULTURE\n\n## Recent News`;
  assert.equal(looksLikeStructuredBrief(md), true);
});
```

**ACCEPTANCE.**
1. Open `software-engineer-general.md` (existing fixture) → warning ribbon visible at top of brief body with localized title + body + docs link.
2. After parent's C-1 prompt-layer lands, re-run Deep → new brief has 6 H2 sections → no warning ribbon.
3. Test runs green in CI.
4. 8-locale smoke check: warning copy localized on `ru`, `ja`, `zh-TW`.

**CHANGELOG ×8** under `## [1.58.54]`. Example RU:

```md
### UX / promise fidelity
- На странице `#/deep` сохранённый брифинг теперь проверяется на каноническую 6-секционную структуру (Company snapshot / Engineering culture / Recent news / Glassdoor / Interview process / Negotiation leverage). Если найдено меньше 3 секций — над контентом отображается предупреждение со ссылкой на документацию. Защитная мера на стороне web-ui до полного фикса prompt-layer в родительском `modes/deep.md` (C-1). (UX-A1)
```

---

### FIX v1.58.55 · UX-A3 — Dashboard active-provider chip (Medium)

**WHERE.** Dashboard hero area (`web-ui/views/dashboard.js`), near the two P0 CTAs (`Auto-pipeline a URL` + `Scan now`).

**WHAT.** The OR-model is the core trust mechanic but Dashboard doesn't show which provider is active. User must visit Health.

**HOW.**

```js
async function renderActiveProviderChip() {
  const { activeProvider, activeModel, keysConfigured } = await api('/api/status/providers');
  const chip = document.createElement('div');
  chip.className = 'dash-chip dash-chip--provider';

  if (!activeProvider) {
    chip.classList.add('dash-chip--manual');
    chip.innerHTML = `
      <span class="dash-chip__icon" aria-hidden="true">📋</span>
      <span class="dash-chip__label">${I18n.t('dash.provider.manual')}</span>
    `;
  } else {
    chip.innerHTML = `
      <span class="dash-chip__icon" aria-hidden="true">⚡</span>
      <span class="dash-chip__label">${I18n.t('dash.provider.live', { provider: activeProvider, model: activeModel })}</span>
    `;
  }
  return chip;
}

// Re-render on providers-changed (reuses v1.58.41 event)
document.addEventListener('providers-changed', () => {
  const old = document.querySelector('.dash-chip--provider');
  if (old) {
    renderActiveProviderChip().then(c => old.replaceWith(c));
  }
});
```

i18n keys × 8:
- `dash.provider.live`: `"Live evals: {provider} {model}"` (en) → `"Боевые оценки: {provider} {model}"` (ru) — etc.
- `dash.provider.manual`: `"Manual prompt mode (no API key set)"` (en) → `"Ручной режим (API-ключ не задан)"` (ru) — etc.

```css
.dash-chip--provider {
  background: var(--surface-elev1);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.9em;
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dash-chip--manual { color: var(--muted); }
```

**TEST.** `tests/dashboard-active-provider-chip.test.mjs`.

**ACCEPTANCE.**
1. Visit `#/dashboard` with `ANTHROPIC_API_KEY` set → chip reads `⚡ Live evals: Anthropic claude-sonnet-4-6`.
2. Switch `LLM_PROVIDER` to `openrouter` in `#/config` → save → return to Dashboard → chip auto-updates.
3. With no keys set → chip reads `📋 Manual prompt mode (no API key set)`.

---

### FIX v1.58.56 · UX-A2 — Modes Target Roles / Comp Targets as repeatable line-inputs (Medium)

**WHERE.** `#/config → Modes` tab. View module: `web-ui/views/config-modes.js`.

**WHAT.** Spec says §Step-5 should render Target Roles / Adaptive Framing / Comp Targets as "repeatable labelled line-inputs". Live: all 5 sections are raw `<textarea>` with "editing as raw text to avoid data loss" caveat. The promise is partially delivered.

**HOW.** For Target Roles + Comp Targets (the two that ARE simple lists per docs):

```html
<section class="mode-field" data-section="targetRoles">
  <h3>{{ t('mode.targetRoles.title') }}</h3>
  <p class="field-help">{{ t('mode.targetRoles.help') }}</p>

  <ul class="mode-field__items">
    <li class="mode-item">
      <input type="text" class="input mode-item__title" placeholder="Senior Backend Engineer">
      <input type="text" class="input mode-item__note" placeholder="Optional — what employers buy">
      <button type="button" class="btn btn-ghost mode-item__remove" aria-label="{{ t('mode.removeItem') }}">×</button>
    </li>
  </ul>
  <button type="button" class="btn btn-ghost mode-field__add">+ {{ t('mode.addRole') }}</button>

  <details class="mode-field__advanced">
    <summary>{{ t('mode.advanced.summary') }}</summary>
    <textarea class="textarea mode-field__raw">{{ raw }}</textarea>
  </details>
</section>
```

Parse roles from raw markdown table or bullet list; preserve archetypes / Thematic axes / What employers buy columns as named fields.

**Save:**
- New `PUT /api/modes/_profile` with `{ sections: { targetRoles: [{title, note}, …], … } }` does a non-destructive merge.
- Falls back to `{ markdown: …}` rebuild on confirm if structure incompatible.

**Adaptive Framing, Exit Narrative, Location Policy:** keep as `<textarea>` — they ARE prose per docs.

i18n keys × 8:
- `mode.targetRoles.title`: `"Target Roles"` (en) → `"Целевые роли"` (ru) — etc.
- `mode.targetRoles.help`: `"Role types you're applying for. One per line, with a short note on what kind of employer looks for it."` (× 8)
- `mode.addRole`: `"+ Add target role"` (× 8)
- `mode.removeItem`: `"Remove this item"` (× 8)
- `mode.advanced.summary`: `"Advanced — raw markdown for this section"` (× 8)

**TEST.** `tests/modes-field-form.test.mjs`:
- Render with stub fixture → 5 Target Role line-inputs appear; raw textarea collapsed inside `<details>`.
- Add a role → save → `data/applications.md` (no, `modes/_profile.md`) gets the new role merged in, other sections byte-stable.

**ACCEPTANCE.**
1. `#/config → Modes` with existing fixture → Target Roles render as 5 editable line-inputs (title + note + remove).
2. `+ Add target role` button adds a new line-input.
3. Save → server returns 200 → raw view inside `<details>` reflects the new state.
4. The other 3 sections stay as prose textareas (correct).

---

### FIX v1.58.57 · UX-A4 — Lang-picker target size (Medium / a11y)

**WHERE.** Sidebar bottom — `.lang-btn` CSS rules.

**WHAT.** Live measured: 23–25 px tall, 47–72 px wide. WCAG 2.5.8 (AA from WCAG 2.2) requires 24×24 minimum.

**HOW.**

```css
.lang-btn {
  min-height: 28px;       /* was: implicit / line-height bound */
  padding: 6px 10px;      /* was: 4px 8px */
  border-radius: 6px;
  white-space: nowrap;
}
.lang-btn.active {
  background: var(--surface-elev1);
  font-weight: 600;
}
```

**TEST.** `tests/lang-picker-target-size.test.mjs`:

```js
test('lang-picker buttons meet WCAG 2.5.8 minimum 24×24 px', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/dashboard');
  const sizes = await page.$$eval('.lang-btn', els => els.map(e => {
    const r = e.getBoundingClientRect();
    return { txt: e.innerText, w: r.width, h: r.height };
  }));
  for (const s of sizes) {
    expect(s.h).toBeGreaterThanOrEqual(24);
    expect(s.w).toBeGreaterThanOrEqual(24);
  }
});
```

**ACCEPTANCE.** Visual: language buttons feel comfortable to click. Measured: ≥ 28×40 px on every locale.

---

### FIX v1.58.58 · UX-A7 — Cost-line tracks LLM_PROVIDER live (Medium)

**WHERE.** E2E test only. The mechanism (v1.58.41 UX-D-I) is in place.

**WHAT.** Verify end-to-end that switching `LLM_PROVIDER` in `#/config` makes mounted advisor pages re-render their cost line within 2 s.

**HOW.** Pure test:

```js
// tests/e2e/cost-line-tracks-provider.spec.mjs
import { test, expect } from '@playwright/test';

test('cost line auto-updates when LLM_PROVIDER changes', async ({ page, context }) => {
  // Open advisor in tab A
  const advisor = await context.newPage();
  await advisor.goto('http://127.0.0.1:4317/#/deep');
  const initialCost = await advisor.locator('.cost-line').textContent();
  expect(initialCost).toMatch(/claude|anthropic/i);

  // Change LLM_PROVIDER in tab B
  const config = await context.newPage();
  await config.goto('http://127.0.0.1:4317/#/config');
  await config.selectOption('select[name=LLM_PROVIDER]', 'gemini');
  await config.click('button:has-text("Save")');

  // Tab A should re-render cost line
  await advisor.bringToFront();
  await advisor.waitForFunction(() =>
    /gemini/i.test(document.querySelector('.cost-line')?.textContent || '')
  , { timeout: 3000 });

  // Reset
  await config.bringToFront();
  await config.selectOption('select[name=LLM_PROVIDER]', 'claude');
  await config.click('button:has-text("Save")');
});
```

**ACCEPTANCE.** Test green in CI. No code change required unless test fails (then `providers-changed` event needs cross-tab broadcast via `BroadcastChannel`).

---

### FIX v1.58.59 · UX-A10 — `beforeunload` for dirty CV (Low)

**WHERE.** `views/cv.js`.

**WHAT.** CV editor gets `btn-dirty` class on edit (v1.58.33) but no `beforeunload` confirmation. User leaves with unsaved changes silently.

**HOW.**

```js
let cvDirty = false;
editor.addEventListener('input', () => {
  cvDirty = editor.value !== originalValue;
  saveBtn.classList.toggle('btn-dirty', cvDirty);
});
saveBtn.addEventListener('click', async () => {
  await save();
  cvDirty = false;
  saveBtn.classList.remove('btn-dirty');
  originalValue = editor.value;
});

window.addEventListener('beforeunload', e => {
  if (cvDirty) {
    e.preventDefault();
    e.returnValue = '';  // browser shows generic dialog
  }
});

// Also guard SPA navigation
window.addEventListener('hashchange', e => {
  if (cvDirty) {
    const ok = confirm(I18n.t('cv.unsavedConfirm'));
    if (!ok) {
      e.preventDefault();
      location.hash = '#/cv';
    }
  }
});
```

i18n: `cv.unsavedConfirm`: `"You have unsaved CV changes. Leave anyway?"` (× 8)

**TEST.** Playwright: edit CV → try to navigate away → confirm modal appears → click Cancel → still on `#/cv` with dirty state. Click Save → navigate away → no modal.

**ACCEPTANCE.** Cannot lose CV edits silently.

---

### FIX v1.58.60 · UX-A13 — Health rows "Fix this" CTAs (Low)

**WHERE.** `views/health.js` — health-card render.

**WHAT.** All 21 health rows show status only. No actionable next step when something's wrong.

**HOW.** For each `FAIL` or `OPTIONAL` row, append an inline CTA when there's a known fix:

```js
const FIX_TARGETS = {
  'Profile customized': '#/config?tab=profile',
  'GEMINI_API_KEY': '#/config?tab=api-keys',
  'ANTHROPIC_API_KEY': '#/config?tab=api-keys',
  // …
};

function renderHealthCard({ label, status, value }) {
  const fixUrl = (status === 'fail' || status === 'optional') ? FIX_TARGETS[label] : null;
  return `
    <div class="health-card health-card--${status}">
      <div class="health-card__label">${label}</div>
      <div class="health-card__value">${value}</div>
      <span class="health-card__badge">${status.toUpperCase()}</span>
      ${fixUrl ? `<a class="health-card__fix" href="${fixUrl}">${I18n.t('health.fix')}</a>` : ''}
    </div>
  `;
}
```

i18n: `health.fix`: `"Fix →"` (en), `"Исправить →"` (ru), etc.

**TEST.** Snapshot Health with fixture profile → "Fix →" link with `href="#/config?tab=profile"`.

**ACCEPTANCE.** Click "Fix →" → lands on the right tab of `#/config`.

---

### FIX v1.58.61 · UX-A12 — Notifications drawer Clear all + Dismiss (Low)

**WHERE.** `views/notifications-drawer.js`.

**WHAT.** Journal grows up to 50 entries (cap) but user can't manually purge.

**HOW.**

```html
<header class="notif-header">
  <h2>{{ t('notif.title') }}</h2>
  <button type="button" class="btn btn-ghost notif-clear-all">{{ t('notif.clearAll') }}</button>
  <button type="button" class="notif-close" aria-label="{{ t('notif.closeAria') }}">×</button>
</header>
<ul class="notif-list">
  <!-- per entry -->
  <li class="notif-entry">
    <time>...</time>
    <p>...</p>
    <button type="button" class="notif-entry__dismiss" aria-label="{{ t('notif.dismiss') }}">×</button>
  </li>
</ul>
```

i18n × 8: `notif.clearAll`, `notif.dismiss`.

**TEST.** Playwright: add 3 toasts → open drawer → Clear all → drawer empty.

**ACCEPTANCE.** Single-click clear. Per-entry dismiss works without closing drawer.

---

### FIX v1.58.62 · UX-A8 — README first-run cleanup section (Low)

**WHERE.** `web-ui/README.md` (or root).

**WHAT.** Document the `make clean-test-fixtures` step for first-time clones.

**HOW.** Add a "First run" section right after installation:

```md
## First run

After cloning + `npm install`, run:

\`\`\`bash
make clean-test-fixtures   # removes any example.com URLs left from QA fixtures
npm start
\`\`\`

Open http://127.0.0.1:4317. Pipeline count should be 0.
```

**TEST.** Lint pass; README rendering check.

**ACCEPTANCE.** New users on a fresh clone see clean Pipeline.

---

### FIX v1.58.63 · UX-A9 — API-keys tab sticky summary chip (Low)

**WHERE.** `views/config-api-keys.js` top.

**WHAT.** All 5 provider keys shown vertically; user has to scroll to know which is active.

**HOW.** Sticky header inside the tab body:

```html
<div class="api-keys__summary">
  <span class="api-keys__active">{{ t('config.activeProvider', { provider: active }) }}</span>
  <span class="api-keys__keysConfigured">{{ t('config.keysConfigured', { count: count }) }}</span>
</div>
```

i18n: `config.activeProvider`, `config.keysConfigured`.

**TEST.** Render with 2 keys set → summary shows `Active: Anthropic · 2 of 5 keys configured`.

**ACCEPTANCE.** State legible without scrolling.

---

### FIX v1.58.64 · UX-A15 — Dashboard Quick-actions reorder (Low)

**WHERE.** `views/dashboard.js` Quick-actions template.

**WHAT.** No visual distinction between frequently-used and occasional tiles.

**HOW.** Reorder tiles by frequency (Pipeline > Evaluate > Tracker > Reports > Deep research > Patterns > Follow-up > Project > Training). Give the top-left tile (`Pipeline`) a stronger visual weight (slightly larger icon, bolder text).

**TEST.** Snapshot Dashboard layout.

**ACCEPTANCE.** Pipeline tile most prominent. Power users find Tracker / Evaluate first.

---

### FIX v1.58.65 · UX-A11 — Native-speaker copy-edit es/pt-BR `*.title` strings (Low)

**WHERE.** `i18n/{es,pt-BR}/*.json`.

**WHAT.** "Pipeline de vacantes" (es) feels stilted; native ES speakers might prefer "Pipeline de candidaturas" or "Candidaturas en proceso". Similar review pass needed for pt-BR.

**HOW.** Engage a native ES speaker (Latin-American + Iberian) and a native pt-BR speaker. Review all `*.title`, `*.subtitle`, `*.help` strings. Commit corrections.

**TEST.** Snapshot before/after; visual inspection.

**ACCEPTANCE.** Native-speaker LGTM.

---

### FIX v1.59.0 · UX-A14 — Mobile (≤ 420 px) audit (Medium / cross-cycle)

**WHERE.** All routes + media queries.

**WHAT.** Audit deferred since v1.58.4 backlog. No structured mobile pass yet.

**HOW.**
1. Set up Playwright `playwright.config.mjs` with mobile project:
   ```js
   { name: 'mobile-iphone', use: { ...devices['iPhone 13'] } },
   { name: 'tablet-ipad', use: { ...devices['iPad Pro 11'] } },
   ```
2. Run 25-route smoke on each.
3. Fix issues found: toast-over-Save on narrow screens, sidebar hamburger logic, hit-targets.

**TEST.** New `tests/e2e/mobile-smoke.spec.mjs` covering 5 critical routes (Dashboard, Pipeline, Config, Deep, Help) on 3 viewports.

**ACCEPTANCE.** All 25 routes render legibly at 420 px. No CTA covered by toast. Touch targets ≥ 44 px.

---

## §3 — Universal acceptance protocol

```bash
npm ci
npm test
npm run test:e2e
npm run test:e2e:full
npm run test:e2e:browser
node scripts/check-no-also-leftovers.mjs
node scripts/check-changelog-parity.mjs

# Browser smoke on EN + 1 non-EN, light + dark

# Tag
git commit -m "fix(<area>): <one-line> (<TICKET-ID>)"
git tag v1.58.X
git push origin main v1.58.X
# Watch CI to success.
```

---

## §4 — Sign-off (after the last ship — v1.59.0)

| Gate | Pass |
|---|---|
| All 14 releases shipped (v1.58.52 → v1.59.0) | ☐ |
| Parity matrix at final tag | ☐ |
| `npm test` ≥ 900 + new tests | ☐ |
| Playwright e2e + mobile smoke | ☐ |
| MASTER REGRESSION rerun green | ☐ |
| Security envelope unchanged | ☐ |
| `data/pipeline.md` cleared | ☐ |
| `qa/v54-regression/<date>-UX-AUDIT.md` filed (this run) | ☐ |
| Self-rating bumped from 8.5 → 10 | ☐ |

---

## §5 — Out of scope (cross-repo / v1.60+)

- **C-1 prompt-layer** — parent `modes/deep.md` (UX-A1 here is the defensive workaround)
- **G-005** — parent `modes/oferta.md`
- **UX-022 stale portals** — parent `portals.yml`
- **CLI-locale** — parent CLI stdout (v1.59.x+)
- **RTL support** — Arabic / Hebrew (v1.60+)
- **Drag-and-drop reorder** on Pipeline / Tracker (v1.60+)
- **Bulk multi-select + delete** (v1.60+)
- **Offline mode** / PWA install (v1.60+)

---

## §6 — Cheat sheet

```text
MATURITY-10 RELEASE QUEUE — 14 ships

HIGH (1)
  v1.58.54 · UX-A1   Defensive Deep-brief structure warning

MEDIUM (5)
  v1.58.52 · UX-A5   Help TOC scroll-spy lifecycle fix
  v1.58.55 · UX-A3   Dashboard active-provider chip
  v1.58.56 · UX-A2   Modes Target Roles / Comp Targets field-form
  v1.58.57 · UX-A4   Lang-picker target size ≥ 28 px
  v1.58.58 · UX-A7   E2E test: cost-line tracks LLM_PROVIDER
  v1.59.0  · UX-A14  Mobile (≤420 px) audit

LOW (7)
  v1.58.53 · UX-A6   Saved-card render unification
  v1.58.59 · UX-A10  beforeunload for dirty CV
  v1.58.60 · UX-A13  Health "Fix this" CTAs
  v1.58.61 · UX-A12  Notifications drawer Clear all
  v1.58.62 · UX-A8   README first-run cleanup
  v1.58.63 · UX-A9   API-keys sticky summary chip
  v1.58.64 · UX-A15  Dashboard Quick-actions reorder
  v1.58.65 · UX-A11  Native-speaker es/pt-BR copy-edit

CROSS-REPO (deferred, parent-side)
  C-1   prompt-layer in modes/deep.md
  G-005 A-G→A-F in modes/oferta.md
  UX-022 stale portals in portals.yml
  CLI-locale  career-ops doctor / verify-pipeline / cv-sync-check stdout
```

---

## §7 — Maturity scoring after this queue

| Dimension | Before (v1.58.51) | After (v1.59.0) |
|---|---|---|
| Function | 9 | 10 |
| Output quality | 7 (Deep brief weak) | 9 (defensive warning) |
| i18n | 9 | 10 |
| A11y | 9 | 10 |
| UX | 8 | 10 |
| Performance | 9 | 9 |
| Security | 9 | 9 |
| Mobile | 5 (unaudited) | 9 |
| **Overall** | **8.5 / 10** | **10 / 10** |

The remaining 0.5–1.0 gap that prevents a perfect 10 will only be closed when:
1. C-1 prompt-layer lands in the parent (root fix for Deep brief).
2. RTL support is added (post-v1.60).

Until then, **the web-ui itself is at 10 / 10** in everything within its scope.

---

*Hand off to Claude Code or human dev. One fix per release. HIGH → MEDIUM → LOW. Never batch. Never `--no-verify`. `ci.yml` is the hard gate.*
