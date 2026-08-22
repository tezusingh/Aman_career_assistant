# FIX-PROMPT — career-ops-ui · post-v1.59.1

One-fix queue derived from the 2026-05-20 maturity-10 regression of v1.59.1
(see `2026-05-20-REGRESSION-FINAL-v1.59.1.md`).

**Doctrine — non-negotiable:**
> **ONE one-fix ship per release** — bump + CHANGELOG ×8 (parity-gated) + a dedicated test
> + Playwright-verify + pre-commit AI-review LGTM + CI-watch to green.
> Never batch. HIGH → MEDIUM → LOW. `ci.yml` is the hard gate.

---

## §1 — Release queue

| Release | Ticket | Severity | Class |
|---|---|---|---|
| **v1.59.2** | UX-A5-r2 | **HIGH** | UX orientation regression (scroll-spy never fires) |
| v1.59.3 | UX-A2-r1 (optional) | LOW | Strict-class invariant (cosmetic — behaviour already shipped) |

---

## §2 — Per-fix detailed spec

### FIX v1.59.2 · UX-A5-r2 — Help TOC scroll-spy **STILL** not firing (HIGH / UX orientation)

**Status going into v1.59.2:** Despite the FIX-PROMPT v1.58.52 spec being shipped under release flags through v1.59.0, the live state on v1.59.1 still fails the invariant.

**Live verification (2026-05-20 against v1.59.1).**

| Probe | Result |
|---|---|
| `main h2[id]` count on `#/help` | **18** (`help-h-0` … `help-h-17`) |
| `.help-toc a[href^="#"]` count | **18** |
| TOC `<a>` classNames at rest | all `""` |
| After `getElementById('help-h-5').scrollIntoView({block:'center'})` (Y reached 21588) | **Still all `""`** — no `.toc-current` ever applied |
| `document.querySelector('a.toc-current')` | `null` |
| `document.querySelector('a.active')` matched | the **left side-nav** "Help" link (`href="#/help"`), not in-page TOC |
| Console errors | 0 |

**Conclusion.** The IntersectionObserver from FIX v1.58.52 is either:
1. **Not mounted at all** — no listener wiring on `#/help` route mount; or
2. **Mounted but observing wrong root** — `root: main` while `main` doesn't actually scroll (the **document** scrolls; window.scrollY=21588), so the IO never fires `isIntersecting=true`.
3. **Wrong rootMargin sign** — `'-30% 0% -60% 0%'` may put every heading outside the trigger band.

**WHERE.** Search the repo for the route handler for `#/help` and find the IO wiring:

```bash
rg -n 'IntersectionObserver' web-ui/views/help.js web-ui/lib/help-toc.js \
   web-ui/lib/router.js web-ui/views/  2>/dev/null
rg -n 'toc-current'  web-ui/styles/  web-ui/views/help.js 2>/dev/null
rg -n 'mountTocSpy\\|hashchange.*help\\|#/help' web-ui/ 2>/dev/null
```

**HOW (canonical implementation that *must* work).**

```js
// web-ui/views/help.js or web-ui/lib/help-toc.js
let helpTocObserver = null;
let helpTocRaf = 0;

function mountHelpToc() {
  helpTocObserver?.disconnect();
  cancelAnimationFrame(helpTocRaf);

  // Two rAFs — wait for both DOM-mount and font/style settle
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

    // Observer — use viewport as root (document scrolls, NOT main)
    helpTocObserver = new IntersectionObserver(entries => {
      // Pick the first heading currently intersecting; if multiple, the topmost wins.
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) apply(visible.target.id);
    }, {
      root: null,
      rootMargin: '-20% 0% -55% 0%',
      threshold: 0,
    });

    headings.forEach(h => helpTocObserver.observe(h));

    // Initial state: pick the highest heading currently above the viewport
    requestAnimationFrame(() => {
      const yScroll = window.scrollY + window.innerHeight * 0.2;
      let chosen = headings[0];
      for (const h of headings) {
        if (h.getBoundingClientRect().top + window.scrollY <= yScroll) chosen = h;
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

// Wire it
function onRoute() {
  if (location.hash.startsWith('#/help')) mountHelpToc();
  else unmountHelpToc();
}
window.addEventListener('hashchange', onRoute);
document.addEventListener('DOMContentLoaded', onRoute);
```

**CSS sanity (must paint).** `web-ui/styles/help.css` or equivalent:
```css
.help-toc a {
  display: block;
  padding: 4px 8px;
  border-left: 3px solid transparent;
  color: var(--fg-2);
}
.help-toc a.toc-current {
  color: var(--brand);
  font-weight: 600;
  border-left-color: var(--brand);
  background: var(--brand-soft);
}
```

**TEST.** `tests/e2e/help-toc-scroll-spy.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

test('Help TOC scroll-spy highlights current section', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/help');
  await page.waitForSelector('main h2[id^="help-h-"]');
  await page.waitForFunction(() =>
    document.querySelectorAll('.help-toc a[href^="#help-h-"]').length >= 5
  );

  // Scroll a known mid section into view
  await page.evaluate(() => {
    document.getElementById('help-h-5')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(600);  // IO + rAF settle

  const result = await page.evaluate(() => {
    const cur = document.querySelector('.help-toc a.toc-current');
    return {
      hasCurrent: !!cur,
      href:  cur?.getAttribute('href') ?? null,
    };
  });
  expect(result.hasCurrent).toBe(true);
  expect(result.href).toMatch(/#help-h-[3-7]/);
});

test('Scroll-spy re-attaches after navigating away and back', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/help');
  await page.waitForSelector('main h2[id^="help-h-"]');
  await page.goto('http://127.0.0.1:4317/#/dashboard');
  await page.waitForSelector('h1');
  await page.goto('http://127.0.0.1:4317/#/help');
  await page.waitForSelector('main h2[id^="help-h-"]');

  await page.evaluate(() => {
    document.getElementById('help-h-10')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(600);

  const ok = await page.evaluate(() =>
    !!document.querySelector('.help-toc a.toc-current')
  );
  expect(ok).toBe(true);
});
```

Plus a unit test on `mountHelpToc/unmountHelpToc` lifecycle (Jest/Vitest):

```js
test('mountHelpToc disconnects previous observer on re-mount', () => {
  document.body.innerHTML = `
    <main><h2 id="help-h-0">A</h2><h2 id="help-h-1">B</h2></main>
    <nav class="help-toc"><a href="#help-h-0"></a><a href="#help-h-1"></a></nav>`;
  // Spy on IO disconnect
  // ...assert that calling mountHelpToc twice creates 1 active observer
});
```

**ACCEPTANCE.**
1. Navigate to `#/help`. DevTools, scroll past section 1 (`window.scrollY ≥ 4000`).
2. Section ≥2 in the TOC visibly highlights (`.toc-current`, brand color, border-left).
3. Scroll to section 12 — TOC item 12 highlights, item 1 unhighlights.
4. Navigate to `#/dashboard`, then back to `#/help`. Repeat scroll. Highlight still works.
5. `tests/e2e/help-toc-scroll-spy.spec.mjs` green on `npm run test:e2e:browser`.
6. Per-locale verification on `en` + 1 non-EN (e.g. `ru`) — spy works regardless of localized H2 text.

**CHANGELOG (×8 files).** Example RU:
```md
## [1.59.2] - 2026-MM-DD

### Fixed
- Восстановлен IntersectionObserver для прокрутки оглавления на `#/help`:
  текущий раздел снова подсвечивается (`.toc-current`) при прокрутке.
  Повторная регрессия UX-A5 после v1.58.52 / v1.59.0 — окончательный
  rewire с `root: null`, корректным rootMargin и initial-state. (UX-A5-r2)
```

---

### FIX v1.59.3 (optional · LOW) · UX-A2-r1 — Mode pages `.mode-field` class invariant

**Context.** UX-A2 behaviour is shipped: every mode page (`#/project`, `#/training`, `#/followup`, `#/interview-prep`, `#/contacto`) renders proper `<label>` + `<input>/<textarea>` pairs (no raw textareas). The audit's strict invariant of `.mode-field` / `.mode-item` classes + `+ Add` repeat button was a stronger styling/data-attribute contract that wasn't adopted.

**Decision.** Two paths:

1. **Adopt class invariant** (recommended for visual regression test stability): add `.mode-field` wrapper around each label+input pair; tests assert against the class instead of placeholder.
2. **Update the invariant** to the actual delivered contract: tests assert `<main label> + <main input/textarea>` parity.

If path 1, the diff is small: wrap each `mode-*` field in:
```html
<div class="mode-field">
  <label for="mode-followup-company">Company</label>
  <input id="mode-followup-company" name="mode-followup-company" type="text" placeholder="Stripe">
</div>
```
Add `.mode-field { display: grid; gap: 4px; }` to styles.

If path 2, just update `tests/mode-pages.spec.mjs` accordingly.

**CHANGELOG.** Either way:
```md
## [1.59.3] - 2026-MM-DD

### Improved
- Унифицирована разметка форм советников (`#/project`, `#/training`,
  `#/followup`, `#/interview-prep`, `#/contacto`): каждое поле
  обёрнуто в `.mode-field`. Закрывает регресс-инвариант UX-A2-r1. (UX-A2-r1)
```

---

## §3 — Universal acceptance protocol

```bash
npm ci
npm test
npm run test:e2e
npm run test:e2e:browser
node scripts/check-no-also-leftovers.mjs
node scripts/check-changelog-parity.mjs

# Browser smoke (EN + 1 non-EN): the fix's surface verified
# Tag
git commit -m "fix(help): rewire TOC scroll-spy IO with root=null (UX-A5-r2)"
git tag v1.59.2
git push origin main v1.59.2
# Watch CI to success.
```

---

## §4 — Locale matrix

Same 8-locale matrix as prior FIX-PROMPTs. For v1.59.2 verify on `en` + `ru` minimum (IO is locale-agnostic; H2 ids are stable across locales — confirmed in this regression).

---

## §5 — Sign-off

| Gate | Pass |
|---|---|
| v1.59.2 UX-A5-r2 — `help-toc-scroll-spy.spec.mjs` × 2 specs green; live verified across EN+RU | ☐ |
| v1.59.3 UX-A2-r1 (optional) — `.mode-field` wrapper or invariant updated | ☐ |
| `npm test` ≥ 900 + new tests green | ☐ |
| CI Node 18/20/22 `success` | ☐ |
| MASTER REGRESSION re-run green; UX-A5 closes; UX-A2 either closes or invariant moved to delivered contract | ☐ |
| `data/pipeline.md` cleared via `make clean-test-fixtures` | ☐ |

---

## §6 — Out-of-scope but worth tracking

These are **not** regressions vs the audit, just observations from this run:

1. **Pipeline empty-state guard.** After `make clean-test-fixtures` the pipeline rows go to 0; the empty-state message wasn't matched against the `no jobs|paste|empty` regex on the just-cleaned page. Confirm empty-state copy is intentional/localized.
2. **`/api/badurl` 404 body in HTML.** Express default HTML 404 leaks server stack info via title `Error`. Consider a tiny middleware that returns JSON `{error:"Not Found"}` for `/api/*` 404s. Not a security regression, but a polish item for DOC-1.

---

*Hand off to Claude Code or human dev. One fix per release.*
