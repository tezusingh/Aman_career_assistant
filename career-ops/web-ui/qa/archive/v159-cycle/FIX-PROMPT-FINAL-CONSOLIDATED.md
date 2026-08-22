# FIX-PROMPT — FINAL CONSOLIDATED · career-ops-ui · post-v1.59.1

Single hand-off document merging **every open finding** from every cycle in this dialog:
- 2026-05-19 MASTER REGRESSION (v1.58.50 → v1.58.51)
- 2026-05-19 v1.58.52 mini-release (NEW-K1 + NEW-M4-r1)
- 2026-05-19 SENIOR UX-DESIGNER AUDIT (UX-A1..UX-A15, maturity-10 cycle to v1.59.0)
- 2026-05-20 REGRESSION-FINAL on v1.59.1 (UX-A5 still open · UX-A6 fixed)
- 2026-05-20 FUNCTIONALITY CHECK on v1.59.1 (NEW-F1 added)
- 2026-05-20 SENIOR DESIGNER EXPORT + KEY-FLOW CRAFT REVIEW (NEW-D2-motion + NEW-D3-cache nits)
- 2026-05-20 OPENROUTER KEY counter-bug probe (NEW-OR1 added — user-reported)

**Doctrine — non-negotiable:**
> **ONE fix per release.** Bump (×8 CHANGELOG, parity-gated) + dedicated test + Playwright-verify + pre-commit AI-review LGTM + CI-watch to green. Never batch. Never `--no-verify`. HIGH → MEDIUM → LOW. `ci.yml` is the hard gate.

---

## §1 — Final release queue (priority order)

| Release | Ticket | Severity | Class | First seen |
|---|---|---|---|---|
| **v1.59.2** | **UX-A5-r2** | **HIGH** | UX orientation regression | UX-D-K (v1.58.45) → re-opened maturity-10 → still open after v1.59.0 |
| **v1.59.3** | **NEW-OR1** | **MEDIUM** | UX trust regression (key counter race) | 2026-05-20 user-reported |
| v1.59.4 | NEW-F1 | LOW | API routing hygiene | 2026-05-20 functionality check |
| v1.59.5 | UX-A2-r1 *(optional)* | LOW | UX form contract (cosmetic) | Maturity-10 cycle |
| v1.59.6 | NEW-D2-motion | LOW | A11y polish | Design export |
| v1.59.7 | NEW-D3-cache | NIT | API headers | Design export |
| — | G-005 | MINOR | Cross-repo (parent) | Parent-blocked, not a UI ship |

---

## §2 — FIX v1.59.2 · UX-A5-r2 — Help TOC scroll-spy **still** not firing (HIGH)

### Verification cycles (4 confirmations across this dialog)
1. 2026-05-19 maturity-10 regression — open.
2. 2026-05-19 post FIX-PROMPT v1.58.52 — flagged for ship.
3. 2026-05-20 REGRESSION-FINAL on v1.59.1 — open after 3rd ship cycle.
4. 2026-05-20 FUNCTIONALITY CHECK — confirmed `scrollY≈21588`, 18 links, all `className=""`, zero `.toc-current` ever applied.

### Root cause hypotheses (ranked)
1. **Observer wired with `root: main`** while the document scrolls (not `main`).
2. **Mount race** — observer attached on app boot but `#/help` mounts via hashchange after teardown.
3. **rootMargin sign** — `'-30% 0% -60% 0%'` puts trigger band off-screen.

### WHERE
```bash
rg -n 'IntersectionObserver|toc-current|mountTocSpy' web-ui/views/help.js web-ui/lib/ 2>/dev/null
```

### HOW — canonical fix
```js
// web-ui/lib/help-toc.js
let helpTocObserver = null;
let helpTocRaf = 0;

function mountHelpToc() {
  helpTocObserver?.disconnect();
  cancelAnimationFrame(helpTocRaf);

  helpTocRaf = requestAnimationFrame(() => requestAnimationFrame(() => {
    const headings = [...document.querySelectorAll('main h2[id^="help-h-"]')];
    const links = new Map(
      [...document.querySelectorAll('.help-toc a[href^="#help-h-"]')]
        .map(a => [a.getAttribute('href').slice(1), a])
    );
    if (!headings.length || !links.size) return;

    const apply = (id) => {
      links.forEach(a => a.classList.remove('toc-current'));
      links.get(id)?.classList.add('toc-current');
    };

    helpTocObserver = new IntersectionObserver(entries => {
      const top = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) apply(top.target.id);
    }, {
      root: null,                           // viewport, NOT main
      rootMargin: '-20% 0% -55% 0%',
      threshold: 0,
    });

    headings.forEach(h => helpTocObserver.observe(h));

    requestAnimationFrame(() => {
      const triggerY = window.scrollY + window.innerHeight * 0.2;
      let chosen = headings[0];
      for (const h of headings) {
        if (h.getBoundingClientRect().top + window.scrollY <= triggerY) chosen = h;
      }
      if (chosen) apply(chosen.id);
    });
  }));
}

function unmountHelpToc() {
  helpTocObserver?.disconnect();
  helpTocObserver = null;
  cancelAnimationFrame(helpTocRaf);
}

function onRoute() {
  if (location.hash.startsWith('#/help')) mountHelpToc();
  else unmountHelpToc();
}
window.addEventListener('hashchange', onRoute);
document.addEventListener('DOMContentLoaded', onRoute);
```

### CSS
```css
.help-toc a {
  display: block;
  padding: 4px 8px;
  border-left: 3px solid transparent;
  color: var(--foggy);
  transition: var(--transition);
}
.help-toc a.toc-current {
  color: var(--rausch);
  font-weight: 600;
  border-left-color: var(--rausch);
  background: color-mix(in srgb, var(--rausch) 8%, transparent);
}
```

### TEST · `tests/e2e/help-toc-scroll-spy.spec.mjs`
```js
import { test, expect } from '@playwright/test';

test('Help TOC scroll-spy highlights current section', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/help');
  await page.waitForSelector('main h2[id^="help-h-"]');
  await page.waitForFunction(() =>
    document.querySelectorAll('.help-toc a[href^="#help-h-"]').length >= 5);
  await page.evaluate(() =>
    document.getElementById('help-h-5')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const cur = document.querySelector('.help-toc a.toc-current');
    return { has: !!cur, href: cur?.getAttribute('href') ?? null };
  });
  expect(r.has).toBe(true);
  expect(r.href).toMatch(/#help-h-[3-7]/);
});

test('Scroll-spy re-attaches on route-back', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/help');
  await page.waitForSelector('main h2[id^="help-h-"]');
  await page.goto('http://127.0.0.1:4317/#/dashboard');
  await page.waitForSelector('h1');
  await page.goto('http://127.0.0.1:4317/#/help');
  await page.waitForSelector('main h2[id^="help-h-"]');
  await page.evaluate(() =>
    document.getElementById('help-h-10')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() =>
    !!document.querySelector('.help-toc a.toc-current'))).toBe(true);
});
```

### ACCEPTANCE
1. `#/help` · scroll past section 1 → TOC item ≥2 paints `.toc-current` with brand color + border-left.
2. Scroll to section 12 → 12 highlights, 1 unhighlights.
3. `#/dashboard` → back to `#/help` → spy still works (re-mount).
4. Both Playwright specs green.
5. EN + 1 non-EN (RU) verified.

### CHANGELOG ×8 (RU example)
```md
## [1.59.2] - 2026-MM-DD

### Fixed
- Восстановлен IntersectionObserver для прокрутки оглавления на `#/help`:
  текущий раздел снова подсвечивается (`.toc-current`) при прокрутке.
  Повторная регрессия UX-A5 после релизов v1.58.52 / v1.59.0 — окончательный
  rewire с `root: null`, корректным rootMargin и initial-state. (UX-A5-r2)
```

---

## §3 — FIX v1.59.3 · NEW-OR1 — Key counter race on `#/config` (MEDIUM, user-reported)

### Reported symptom
> «Active: anthropic · Keys: 0 / 5 — при вставке ключа от OpenRouter, такая штука, по-моему, там не работает.»

### Live evidence
- `/api/config.values` contains 2 set keys: `ANTHROPIC_API_KEY` + `OPENROUTER_API_KEY` (both length > 0, masked as `sk-a…qAAA`).
- `/api/status/providers.keysConfigured = ['anthropic','openrouter']`.
- `<span class="api-keys__count">` rendered text:
  - After full page reload → **`Keys: 2 / 5`** ✓ correct
  - After SPA-nav `#/dashboard` → `#/config` → **`Keys: 2 / 5`** ✓ correct
  - During one observed Save flow (right after pasting a fake 74-char OR key and clicking Save) → **`Keys: 0 / 5`** ← BUG
- After clicking Save with new value pasted into already-set OR field: toast `Settings saved` shown · counter stays `Keys: 2 / 5` · `OPENROUTER_API_KEY✓ set` label remains · `/api/status/providers` unchanged. So the key DID save server-side, but for ~1 frame the counter snapped to 0/5 mid-update.

### Root cause (most likely)
The `api-keys__count` span is recomputed from a **local snapshot** that's cleared at the start of `onSaveConfig()` (set to `{}` or `[]` while waiting for the POST `/api/config` to resolve and the GET `/api/config` to re-fetch). During that resolve window the counter renders `0 / 5`.

Secondary contributor: the masked value (`sk-a…qAAA`) returns from `GET /api/config` and is parsed as "set" by `length > 0`; but if the post-Save **refetch** is debounced or skipped (e.g. assumes the just-POSTed values are the truth), the local state may include only the keys that were *just typed* (not the masked existing ones), leading to a transient 0 or 1.

### HOW — three-part fix

1. **Don't clear the counter source-of-truth until the new state is ready.** Compute the displayed count from the *previous* state during the in-flight Save, only swap on resolve:
   ```js
   // before
   state.values = {};         // ← causes 0/5 flash
   await fetch('/api/config', { method:'POST', ... });
   state.values = await fetch('/api/config').then(r=>r.json()).then(j=>j.values);
   renderCounter();
   ```
   ```js
   // after
   const next = await fetch('/api/config', { method:'POST', ... body });
   if (!next.ok) { /* show toast.error, do NOT mutate state */ return; }
   state.values = await fetch('/api/config').then(r=>r.json()).then(j=>j.values);
   renderCounter();   // swap only here
   ```

2. **Make the counter derive from `keysConfigured`, not from `values`.** `/api/status/providers.keysConfigured` is the **server's** authoritative list of providers with non-empty masked keys. The counter should be:
   ```js
   const ALL_PROVIDERS = ['anthropic','gemini','openai','qwen','openrouter'];
   const setCount = (j) => j.keysConfigured.length;
   const label = t('config.keys', { set: setCount(j), total: ALL_PROVIDERS.length });
   ```
   This eliminates the case where the local `values` object is temporarily empty mid-Save while the server-side state is fine.

3. **Re-fetch `/api/status/providers` on the `providers-changed` event** (already emitted by UX-D-I, v1.58.41). The cost-hint uses this; the counter should subscribe to the same event for parity:
   ```js
   document.addEventListener('providers-changed', () => {
     fetch('/api/status/providers').then(r => r.json()).then(j => {
       document.querySelector('.api-keys__count').textContent =
         t('config.keys', { set: j.keysConfigured.length, total: 5 });
       document.querySelector('.api-keys__active').textContent =
         t('config.active', { provider: j.activeProvider });
     });
   });
   ```

### TEST · `tests/config-keys-counter.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('counter never flashes 0/5 during Save when keys already configured', async () => {
  // Boot with 2 keys set
  // Open #/config
  // Spy on textContent mutations of .api-keys__count
  // Trigger Save with a new OR key value
  // Assert: NO observed value of textContent matches /Keys:\s*0\s*\/\s*5/
});
```

Playwright variant `tests/e2e/config-keys-counter.spec.mjs`:
```js
import { test, expect } from '@playwright/test';

test('Keys counter remains correct across Save', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/config');
  await page.waitForSelector('.api-keys__count');
  const before = await page.locator('.api-keys__count').textContent();
  await page.fill('#cfg-openrouter-api-key', 'sk-or-v1-' + 'a'.repeat(60));
  // Watch for the value reaching 0/5 — should NEVER happen
  const racePromise = page.waitForFunction(() =>
    /Keys:\s*0\s*\/\s*5/.test(document.querySelector('.api-keys__count')?.textContent || ''),
    { timeout: 2500 }).catch(() => null);
  await page.locator('button:has-text("Save")').click();
  const raced = await racePromise;
  expect(raced).toBeNull();              // FAIL the test if the 0/5 flash ever appeared
  const after = await page.locator('.api-keys__count').textContent();
  expect(after).toMatch(/Keys:\s*2\s*\/\s*5/);
});
```

### ACCEPTANCE
1. `#/config` with 1+ keys set → counter shows the correct count immediately on first paint after SPA nav and after full reload.
2. Paste a new value into any `_API_KEY` field and click Save → counter **never displays `0 / 5`** at any frame; it either stays the same or increments.
3. Add a brand-new key (e.g. paste Gemini) → counter increments from 2/5 → 3/5 atomically.
4. Server-side `keysConfigured` matches the counter at all times (verify via console probe).
5. Active-provider chip in topbar updates on `providers-changed` event.

### CHANGELOG (RU)
```md
## [1.59.3] - 2026-MM-DD

### Fixed
- Счётчик ключей на `#/config` ("Keys: N / 5") больше не мерцает в `0 / 5`
  во время Save. Источник истины — `keysConfigured` из
  `/api/status/providers`, обновляется на событии `providers-changed`.
  Закрывает пользовательский отчёт о потере OpenRouter-ключа. (NEW-OR1)
```

---

## §4 — FIX v1.59.4 · NEW-F1 — `/api/<name>/../path` routing hygiene (LOW)

### What
- `/api/jds/../../../etc/passwd` → **200 + SPA HTML** (no file leak).
- `/api/interview-prep/../../../package.json` → **200 + SPA HTML**.
- Encoded traversal (`%2e%2e%2f`) correctly returns 404 JSON.

### HOW
Add a JSON-404 guard middleware **before** the SPA static fallback:

```js
// server/index.js
app.use('/api', (_req, res) => {
  res.status(404).type('application/json').json({ error: 'not found' });
});
// then static + SPA catch-all
```

### TEST · `tests/api-404-json.test.mjs`
```js
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://127.0.0.1:4317';
test('/api/<anything> path-traversal returns 404 JSON, not HTML', async () => {
  for (const p of [
    '/api/jds/../../../etc/passwd',
    '/api/interview-prep/../../../package.json',
    '/api/no-such-endpoint',
  ]) {
    const r = await fetch(BASE + p);
    assert.equal(r.status, 404, `${p} → expected 404, got ${r.status}`);
    assert.ok((r.headers.get('content-type') || '').includes('application/json'));
    assert.equal((await r.json()).error, 'not found');
  }
});
```

### CHANGELOG (RU)
```md
## [1.59.4] - 2026-MM-DD

### Fixed
- `/api/*` пути с непрочитаемыми сегментами больше не возвращают HTML SPA
  shell — теперь корректный 404 JSON `{"error":"not found"}`. (NEW-F1)
```

---

## §5 — FIX v1.59.5 (optional · LOW) · UX-A2-r1 — `.mode-field` class invariant

Behaviour is shipped; the strict `.mode-field` wrapper class is missing. Pick one:

1. **Adopt the class.** Wrap every `mode-*` field:
   ```html
   <div class="mode-field">
     <label for="mode-followup-company">Company</label>
     <input id="mode-followup-company" name="mode-followup-company" type="text" placeholder="Stripe">
   </div>
   ```
   + `.mode-field { display: grid; gap: 4px; }`.
2. **Update the invariant.** `tests/mode-pages.spec.mjs` asserts `<main label> + <main input/textarea>` pairs (the actual delivered contract).

```md
## [1.59.5] - 2026-MM-DD

### Improved
- Унифицирована разметка форм советников: каждое поле в `.mode-field`. (UX-A2-r1)
```

---

## §6 — FIX v1.59.6 (LOW) · NEW-D2-motion — `prefers-reduced-motion`

```css
/* public/css/app.css append */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```js
// tests/reduced-motion.test.mjs (Playwright)
test('prefers-reduced-motion neutralises transitions', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4317/#/dashboard');
  const dur = await page.evaluate(() =>
    getComputedStyle(document.querySelector('button.btn-primary')).transitionDuration);
  expect(['0s','0.01ms','0ms']).toContain(dur.split(' ')[0]);
});
```

```md
## [1.59.6] - 2026-MM-DD

### Improved
- Уважение `prefers-reduced-motion: reduce`. (NEW-D2-motion)
```

---

## §7 — FIX v1.59.7 (NIT) · NEW-D3-cache — `/api/cv` Cache-Control

Add explicit `Cache-Control: no-store` to `/api/cv` (and any other markdown-bearing GET) for parity with `/app.js`. ETag-only revalidation remains.

---

## §8 — Universal acceptance protocol (per release)

```bash
npm ci
npm test
npm run test:e2e
npm run test:e2e:browser
node scripts/check-no-also-leftovers.mjs
node scripts/check-changelog-parity.mjs

# Browser smoke (EN + 1 non-EN) — the fix's surface verified
git commit -m "fix(<area>): <one-line> (TICKET-ID)"
git tag v1.59.<N>
git push origin main v1.59.<N>
# Watch CI to success.
```

---

## §9 — Locale matrix per fix

| Fix | Locales to verify |
|---|---|
| UX-A5-r2 | EN + 1 non-EN (RU). IO is locale-agnostic; H2 ids stable across locales. |
| NEW-OR1 | EN + RU + ZH-CN — counter must be localized: `Keys` / `Ключей` / `密钥`. Verified live: RU shows "Ключей: 2 / 5", ZH-CN shows "密钥: 2 / 5", EN shows "Keys: 2 / 5". |
| NEW-F1 | server-side; locale-irrelevant (DOC-1 EN by-policy on 4xx). |
| UX-A2-r1 | all 8 locales (label translations matter). |
| NEW-D2-motion | locale-agnostic; OS-level setting. |
| NEW-D3-cache | locale-agnostic. |

---

## §10 — CLOSURE LEDGER · everything closed across this entire dialog

### v1.57.2 → v1.58.2 — Original 32 bugs (BUG / I18N / UX-032 / FIX-C cycle)
BUG-001 (followup ISO), BUG-002 (Acceptance Test fixture), BUG-003 (markdown in blockquote), BUG-004 (#/outreach alias), BUG-005 (pipeline dedup toast), BUG-006 (pipeline humanized 400), BUG-007 (Doctor parity), BUG-008 (Reports subtitle), BUG-010 (Doctor body), UX-032 (template profile), I18N-011/012/013 (Help TOC + Deep RU), FIX-C1 (cleanLlmMarkdown), FIX-C2 (`<html lang>` + autodetect).

### v1.58.4 → v1.58.35 — Doctrine one-fix cycle (29 ships)
v1.58.4 NEW-1 CSP unconditional · v1.58.6 BUG-008-tb top-bar Doctor modal title × 8 · v1.58.7 NEW-2 `isValidJobUrl` rejects paired `${}/{{}}` · v1.58.8 5 provider rows on `#/health` (Anthropic / Gemini / OpenAI / Qwen / OpenRouter) · v1.58.9 M-1 `:focus-visible` ring · v1.58.10 M-2 `UI.modal()` auto-dismisses progress toast · v1.58.11 M-4 saved-card title↔date gap · v1.58.12 M-7 OpenRouter `cost varies` · v1.58.13 M-8 Apply checklist interactive + per-URL persist · v1.58.14 M-9 connection-banner Refresh toast · v1.58.15 I-1 top-bar search aria-label localized · v1.58.16 brand-button hover-flicker · v1.58.17 I-2 `Intl.RelativeTimeFormat` for saved-research · v1.58.18 I-3 Help TOC English-bleed strip · v1.58.19 I-4 RU `#/followup` no Latin · v1.58.20 I-6 footer hotkey ⌘K/Ctrl K platform-aware · v1.58.21 U-1 `#/cv` H1 + subtitle · v1.58.22 U-2 `#/auto` H1 emoji-wrap · v1.58.23 U-3 `#/followup` date placeholder today − 14d · v1.58.24 U-4 toast endpoint postfix in `<details>` · v1.58.25 U-5 Dashboard CTA dedupe · v1.58.26 U-6 Scan Active-companies tooltip · v1.58.27 U-7 verify-pipeline `===` divider strip · v1.58.28 U-8 Generate-prompt block collapsed by default · v1.58.29 U-9 Pipeline controls stack ≤720px · v1.58.30 U-10 Tracker actions disabled when empty · v1.58.31 U-11 Tracker Legitimacy info chip + aria · v1.58.32 U-12 Help TOC filter min-width 16ch · v1.58.33 U-13/14/15 toast journal capture + page-header safety + CV dirty-state · v1.58.34/35 Notifications drawer + `[hidden]` CSS override + Help §18 × 8 + Playwright end-to-end.

### v1.58.37 → v1.58.50 — Re-regression closure cycle (14 ships)
NEW-D1 `pipe.title` × es/pt-BR/ru + Latin-leak guard · NEW-D3 Tracker search `aria-label` × 8 · NEW-D2 Dashboard Refresh + toast · UX-D-H External docs links lock · UX-D-I Cost-hint live re-fetch · UX-D-J Advisor ETA parity · UX-D-F Empty Evaluate `eval.emptyJd` toast · UX-D-L `#/deep` saved-research inline + close · UX-D-K Help TOC scroll-spy IO *(later regressed → re-opened as UX-A5)* · UX-D-D Apply slug substitution · UX-D-C Top-bar Quick scan → Open Scan · UX-D-B Dashboard fixture banner · TOOL-1 `make clean-test-fixtures` · DOC-1 Server EN-by-policy doctrine.

### v1.58.52 → v1.59.0 — Maturity-10 cycle (15 invariants)
UX-A1 dashboard empty-state CTA + hint · UX-A2 mode-page label/input pairs (cosmetic class still open) · UX-A3 provider chip visible · UX-A4 dashboard 6 quick-actions · **UX-A5 Help TOC scroll-spy — STILL OPEN** · UX-A6 saved-research card structure (FIXED) · UX-A7 Quick scan → Vacancy search · UX-A8 scan portal links · UX-A9 Pipeline inline `+ Add` · UX-A10 Pipeline empty-state · UX-A11 Profile/Health fixture banner · UX-A12 theme-toggle ☀️/🌙 swap · UX-A13 Reports H1+subtitle · UX-A14 skip-link · UX-A15 Notifications drawer aria-expanded/aria-controls.

### Senior-obs / pre-cycle baseline (locked, do not re-file)
F-V55-E / UX-1 stepper pre-render · UX-5 CV editor accessible name · UX-2 4-provider OR banner · UX-6 Auto ETA + Scan Stop · UX-3 Dashboard hero · UX-4 Scan Advanced disclosure · UX-7 Pipeline virtualization · UX-8 Tracker server pagination · UX-9 CV breadcrumb · UX-10 Run-live cost hint · UX-11 Help TOC 1-match autoscroll · UX-12 Dashboard first-paint a11y · a11y managed-focus ring · UX-N1 document.title per route · key-detection placeholder rejection · UX-N2 ⌘K hint visible.

### Open after EVERY cycle in this dialog

| ID | Severity | Source cycle | Status |
|---|---|---|---|
| **UX-A5** (scroll-spy) | **HIGH** | Maturity-10 + Functionality | OPEN — v1.59.2 (§2) |
| **NEW-OR1** (key counter race) | **MEDIUM** | User-reported 2026-05-20 | OPEN — v1.59.3 (§3) |
| NEW-F1 (API traversal → HTML) | LOW | Functionality | OPEN — v1.59.4 (§4) |
| UX-A2 (`.mode-field` invariant) | LOW | Maturity-10 | OPEN — v1.59.5 (§5) |
| NEW-D2-motion (`prefers-reduced-motion`) | LOW | Design export | OPEN — v1.59.6 (§6) |
| NEW-D3-cache (`/api/cv` Cache-Control) | NIT | Design export | OPEN — v1.59.7 (§7) |
| G-005 (`modes/oferta.md` parent) | MINOR | Parent | OPEN — parent-blocked |

---

## §11 — Sign-off matrix

| Gate | Pass |
|---|---|
| v1.59.2 UX-A5-r2 — both Playwright specs + live EN+RU | ☐ |
| v1.59.3 NEW-OR1 — `config-keys-counter.test.mjs` + Playwright; counter never flashes 0/5 | ☐ |
| v1.59.4 NEW-F1 — `api-404-json.test.mjs` green | ☐ |
| v1.59.5 UX-A2-r1 (optional) | ☐ |
| v1.59.6 NEW-D2-motion — `reduced-motion.test.mjs` green | ☐ |
| v1.59.7 NEW-D3-cache | ☐ |
| `npm test` ≥ 900 + new tests green | ☐ |
| CI Node 18/20/22 `success` × every ship | ☐ |
| `data/pipeline.md` cleared via `make clean-test-fixtures` before Playwright | ☐ |
| MASTER REGRESSION rerun green; UX-A5 + NEW-OR1 close | ☐ |

---

## §12 — Long-tail observations (not regressions, context for next cycle)

1. **`/api/pipeline` has 1256+ URLs in `data/pipeline.md`** from accumulated test runs. Run `make clean-test-fixtures` before any Playwright suite.
2. **`/api/help/:lang` parity is 18 H2 / 73 H3** — newer than the prompt's `17/70`. Locale-symmetric (the real invariant). Consider updating the doc.
3. **`/api/cv` lacks `Cache-Control`** — covered by NEW-D3-cache.
4. **Design token naming is Airbnb-themed** (`rausch`, `hof`, `babu`, …). Adding a semantic alias layer would help a designer/rebuild — future polish.
5. **Z-index layers are implicit** (no `--z-*` tokens). Consider adding `--z-modal: 100; --z-drawer: 90; --z-toast: 110`.
6. **Counter state-source** — even after NEW-OR1 fix, consider deriving ALL configuration display chrome (counter, active chip, model labels) from a single immutable snapshot of `/api/status/providers` to prevent future races.

---

*Hand off to Claude Code or human dev. **Ship order: v1.59.2 UX-A5-r2 (HIGH) → v1.59.3 NEW-OR1 (MEDIUM) → rest by priority.** One fix per release.*
