# G-015 · `/#/config` crashes at runtime — `.also(fn)` polyfill removed in v1.22 but config.js wasn't migrated · BLOCKER

**Severity:** Blocker (the entire App settings page is unreachable — no API key edit, no profile edit, no modes/_profile.md edit, no `🌙` theme switch in settings)
**Module:** `public/js/views/config.js:371`
**Confirmed on:** v1.24.0 live, RU locale, all visible after navigating to `/#/config`

## Symptom

Navigating to `/#/config` produces a page-level error card with:

```
Ошибка
c(...).also is not a function
[Повторить]
```

The 20 other sidebar routes render fine. `/api/health` returns ok+v1.24.0. Console error stack-traces to `public/js/views/config.js:371`.

## Repro

```bash
# Stand: v1.24.0 on 127.0.0.1:4317
open http://127.0.0.1:4317/#/config
# → page renders "Ошибка / c(...).also is not a function / Повторить"
```

## Root cause

v1.22.0 backlog item N-2 dropped `Element.prototype.also` monkey-patch:

```js
// public/js/views/cv.js:189 (the comment v1.22 left when it migrated)
// v1.22.0 (N-2) — was `.also(fn)` via Element.prototype monkey-patch;
// replaced with a free function so we don't pollute the global DOM
// prototype (would conflict with any future library defining `.also`).
```

But the migration **missed `config.js`** — line 371 still calls `.also((root) => …)` on a chained `c(...)`:

```js
// public/js/views/config.js:368-379  (currently broken)
return c('div', null, [
  …
  c('div', { className: 'card', style: {…} }, […]),
  tabsHost,
  panelHost,
]).also((root) => {                              // ← Element.prototype.also undefined since v1.22.0
  const want = tabFromHash();
  const panel = want === modesLabel ? modesPanel
              : want === profileLabel ? profilePanel
              : apiPanel;
  activate(want, panel);
});
```

`.also(fn)` was a custom chain helper that called `fn(this)` then returned `this`. Removing it without migrating all call sites makes the whole expression throw `TypeError`.

## Fix (drop-in)

Mirror the cv.js pattern — call the post-build hook as a free statement after the tree is assembled:

```js
// public/js/views/config.js — replace the broken tail
const root = c('div', null, [
  c('div', { className: 'page-header' }, […]),

  c('div', { className: 'card', style: { background: '#fff8e6', …} }, [
    c('strong', null, 'ℹ ' + t('config.bannerTitle', 'Both projects pick this up')),
    c('p', …),
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

Two-character change in scope; preserves behaviour.

## Tests

```js
test('config view renders without TypeError', async () => {
  // headless via JSDOM or Playwright
  await page.goto(BASE + '/#/config');
  await page.waitForSelector('h1');
  const errCard = await page.$('text=is not a function');
  assert.equal(errCard, null);
});

test('hash deep-link selects the right tab', async () => {
  await page.goto(BASE + '/#/config?tab=modes');
  await page.waitForSelector('textarea[placeholder*="modes/_profile.md"]');
});
```

## CI gate to prevent recurrence

```bash
# scripts/check-no-also-leftovers.mjs
# Fails the build if any public/js/views/*.js still uses `.also(`
grep -rEn "\.also\(" public/js/views/ && exit 1 || exit 0
```

(Today `grep -rn "\.also(" public/js/` finds exactly **2** matches:
`config.js:371` (the bug) + `cv.js:189` (just a comment mentioning the prior pattern). The comment is harmless string match; consider an exact-token regex if the gate flags it.)

## Impact

This single line breaks the canonical workflow paths the user came in for:

- Quick Start §Step-3 (edit `config/profile.yml`) → user can't reach the editor
- Quick Start §Step-5 (edit `modes/_profile.md`) → Modes tab unreachable (the G-008 fix is unverifiable end-to-end while G-015 stands)
- v1.13.0 API-key smoke-test buttons (`▶ Test Anthropic` / `▶ Test Gemini`) → unreachable
- v1.19.0 HH_USER_AGENT removal verification → the page that should show the clean field list won't render

This is exactly the kind of regression v1.22.0 backlog clearout was meant to prevent. Recommend hot-fix as **v1.24.1** before the next planned release.

