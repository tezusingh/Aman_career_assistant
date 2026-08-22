# FIX-PROMPT — career-ops-ui · post-v1.58.51

Two-fix mini-release queue distilled from the 2026-05-19 verification regression of v1.58.51 (see `2026-05-19-REGRESSION-v1.58.51.md`).

**Doctrine — non-negotiable:**
> **ONE one-fix ship per release** — bump + CHANGELOG ×8 (parity-gated) + a dedicated test + Playwright-verify + pre-commit AI-review LGTM + CI-watch to green. Never batch. HIGH → MEDIUM → LOW. `ci.yml` is the hard gate.

---

## §1 — Release queue

| Release | Ticket | Severity | Class |
|---|---|---|---|
| **v1.58.52** | NEW-K1 | Medium | UX (orientation / scroll-spy regression) |
| **v1.58.53** | NEW-M4-r1 | Minor | UX render consistency |

---

## §2 — Per-fix detailed spec

### FIX v1.58.52 · NEW-K1 — Help TOC scroll-spy not firing (Medium / UX orientation)

**WHERE.** `#/help` page module / view component. Most likely `web-ui/views/help.js` or `web-ui/lib/help-toc.js` — wherever the `IntersectionObserver` from v1.58.45 lives.

**WHAT (verified live on v1.58.51).**

| Probe | Result |
|---|---|
| H2 elements in `main` | 18, **all have ids** (`help-h-0` … `help-h-17`) |
| TOC `<a>` links in `.help-toc` or `main aside` | 18 |
| TOC links' `className` after first paint | `""` (empty, no scroll-spy class applied) |
| After scrolling 12 ticks down (visible scroll movement confirmed in screenshot) | **0** links with `.toc-current` |
| After scrolling 5 more ticks down | **0** links with `.toc-current` or `.active` (selector tried both) |

**Expected** (per §13 closure note v1.58.45): "`IntersectionObserver` on every `.help-article h2[id]` applies `.toc-current` to the matching TOC `<a>` link as the user scrolls (`rootMargin: '-30% 0% -60% 0%'`). Observer disconnects on hashchange."

**Likely causes (rank by probability):**

1. **Observer disconnected and never re-attached.** The spec mentions "Observer disconnects on hashchange" — if the page mounts AFTER the hashchange listener fires, the observer is gone. Race condition.
2. **Wrong scroll-container root.** Default IO root is the viewport. If `main` has `overflow: auto` and its own scroll, the observer never sees the H2s cross the viewport's rootMargin band.
3. **Selector mismatch.** Maybe H2s are inside `<main>` but the observer queries `.help-article h2[id]` and there's no `.help-article` wrapper.
4. **Style not loaded.** `.toc-current` CSS rule loaded but the class never applied because JS errored. (Console clean throughout — unlikely.)

**HOW (fix steps).**

1. Inspect `web-ui/views/help.js` for the IntersectionObserver wiring.
2. Reproduce locally with DevTools open: navigate to `/#/help`, in console:
   ```js
   const h2s = document.querySelectorAll('main h2[id]');
   const links = document.querySelectorAll('.help-toc a[href^="#"]');
   console.log({ h2Count: h2s.length, linkCount: links.length });
   ```
3. Add a defensive observer (run on mount AND on resize / hashchange):
   ```js
   function mountTocSpy() {
     const headings = document.querySelectorAll('main h2[id]');
     const tocLinks = new Map(
       [...document.querySelectorAll('.help-toc a[href^="#"]')]
         .map(a => [a.getAttribute('href').slice(1), a])
     );
     if (!headings.length || !tocLinks.size) return null;

     const observer = new IntersectionObserver(entries => {
       for (const e of entries) {
         if (e.isIntersecting) {
           tocLinks.forEach(a => a.classList.remove('toc-current'));
           tocLinks.get(e.target.id)?.classList.add('toc-current');
         }
       }
     }, {
       root: null,                          // viewport, not main
       rootMargin: '-25% 0% -50% 0%',
       threshold: 0,
     });
     headings.forEach(h => observer.observe(h));
     return observer;
   }

   let helpTocObserver = null;
   function mountHelpView() {
     helpTocObserver?.disconnect();
     helpTocObserver = mountTocSpy();
   }
   window.addEventListener('hashchange', () => {
     if (location.hash.startsWith('#/help')) {
       requestAnimationFrame(() => requestAnimationFrame(mountHelpView));  // 2 rafs to wait for DOM mount
     } else {
       helpTocObserver?.disconnect();
       helpTocObserver = null;
     }
   });
   document.addEventListener('DOMContentLoaded', mountHelpView);
   ```
4. CSS sanity check — make sure `.toc-current` actually paints:
   ```css
   .help-toc a.toc-current {
     color: var(--brand);
     font-weight: 600;
     border-left: 3px solid var(--brand);
     padding-left: 8px;
   }
   ```

**TEST.** Playwright `tests/e2e/help-toc-scroll-spy.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

test('Help TOC scroll-spy highlights current section', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/help');
  // wait for the help body to load
  await page.waitForSelector('main h2[id^=help-h-]');

  // scroll past section 1
  await page.evaluate(() => {
    document.getElementById('help-h-5')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);  // give IO time to fire

  const currentText = await page.evaluate(() => {
    const cur = document.querySelector('.help-toc a.toc-current, main aside a.toc-current');
    return cur?.innerText.trim() || null;
  });
  expect(currentText).toMatch(/Portals/);  // section 5 is "Portals & sources"
});
```

Plus a unit test on the observer lifecycle that asserts:
- Observer attaches on mount
- Disconnects on unmount
- Re-attaches on re-mount (after route navigation away and back)

**ACCEPTANCE.**
1. Navigate to `#/help`. Open DevTools, scroll body down past section 1.
2. Section "2. App settings & API keys" in the TOC visibly highlights (`.toc-current`).
3. Scroll further to section 12 — TOC item 12 highlights.
4. Navigate away (e.g., `#/dashboard`) and back to `#/help`. Scroll-spy re-attaches and works.
5. Test runs green on `npm run test:e2e:browser`.

**CHANGELOG (×8 files).** Example RU:
```md
## [1.58.52] - 2026-MM-DD

### Fixed
- Восстановлен IntersectionObserver для прокрутки оглавления на `#/help`: текущий раздел снова подсвечивается (`.toc-current`) при прокрутке. Регресс UX-D-K (v1.58.45) после изменений в lifecycle observer'а. (NEW-K1)
```

---

### FIX v1.58.53 · NEW-M4-r1 — Saved-research card structural template inconsistent (Minor / UX)

**WHERE.** `#/deep` page module (most likely `web-ui/views/deep.js`) — the saved-research card renderer. Possibly a shared `renderSavedCard()` helper used by `#/deep`, `#/interview-prep`, and other pages with saved-research lists.

**WHAT (verified live on v1.58.51).**

Two saved-research cards on `#/deep`:

| Card | `innerText` | Structure |
|---|---|---|
| First (`software-engineer-general`, runtime-generated) | `software-engineer-generalyesterday` | `display: flex, gap: 8px, **children: []**` — text concatenated as single text node |
| Second (`story-bank`, fixture) | `story-bank yesterday` | `display: flex, gap: 8px, children: [{tag: 'SPAN', text: 'story-bank'}, {tag: 'TIME', text: 'yesterday'}]` |

Both have the same parent `display: flex; gap: 8px` rule from v1.58.11 — but the first card has no children to space, so the gap does nothing.

**Likely cause:** runtime card creation (after `Run live` saves a new brief) uses a different render path that concatenates `name + relTime` as plain text, while the page-load render path constructs the proper `<span>` + `<time>` children.

**HOW.**

1. Grep for places that render a saved-research card. Look for:
   - `button.saved-card` template
   - `innerHTML = name + relTime` or string concatenation
   - Any `appendChild(document.createTextNode(...))` near saved-card code
2. Unify on a single helper:
   ```js
   function renderSavedCard({ name, isoDate, slug }) {
     const btn = document.createElement('button');
     btn.type = 'button';
     btn.className = 'saved-card';
     btn.dataset.slug = slug;

     const titleEl = document.createElement('span');
     titleEl.className = 'saved-card__title';
     titleEl.textContent = name;

     const dateEl = document.createElement('time');
     dateEl.className = 'saved-card__date';
     dateEl.dateTime = isoDate;
     dateEl.textContent = formatRelative(isoDate, I18n.getLang());

     btn.append(titleEl, dateEl);
     return btn;
   }
   ```
3. Call this helper from both the page-load path AND the post-`Run live` insertion path.

**TEST.** `tests/saved-card-structure.test.mjs`:
```js
test('every saved-research card has structural <span>+<time> children', () => {
  // Render /deep with two cards: one fixture, one created via simulated Run live
  const html = renderDeepWithCards([
    { name: 'story-bank', isoDate: '2026-05-18' },
    { name: 'software-engineer-general', isoDate: '2026-05-18' },
  ]);
  const cards = parseSelector(html, '.saved-card');
  expect(cards.length).toBe(2);
  for (const card of cards) {
    expect(card.querySelector('.saved-card__title')).toBeTruthy();
    expect(card.querySelector('time[datetime]')).toBeTruthy();
    expect(card.children.length).toBe(2);
  }
});
```

**ACCEPTANCE.**
1. Navigate to `#/deep`. Both fixture cards render with visible `gap` between title and date pill.
2. Run live with `Anthropic` / `Senior Backend Engineer` → new card appears with proper `<span>+<time>` structure.
3. Reload page → all cards still structural (state matches re-render).

**CHANGELOG (×8 files).** Example RU:
```md
## [1.58.53] - 2026-MM-DD

### Fixed
- Унифицирован рендер карточек сохранённых исследований: динамически создаваемые карточки (после Run live) теперь используют ту же структурную разметку `<span>` + `<time>`, что и фикстурные. Закрывает регресс M-4 v1.58.11 для нового кода. (NEW-M4-r1)
```

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

# Browser smoke (EN + 1 non-EN): the fix's surface verified

# Tag
git commit -m "fix(<area>): <one-line> (NEW-K1|NEW-M4-r1)"
git tag v1.58.52  # or .53
git push origin main v1.58.52
# Watch CI to success.
```

---

## §4 — Locale matrix

Same 8-locale matrix as prior FIX-PROMPTs. For each release verify the fix on `en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`.

---

## §5 — Sign-off

| Gate | Pass |
|---|---|
| v1.58.52 NEW-K1 — `help-toc-scroll-spy.spec.mjs` green; live verified | ☐ |
| v1.58.53 NEW-M4-r1 — `saved-card-structure.test.mjs` green; both cards structural | ☐ |
| `npm test` ≥ 900 + new tests green | ☐ |
| CI Node 18/20/22 `success` | ☐ |
| MASTER REGRESSION rerun green | ☐ |
| `data/pipeline.md` cleared via `make clean-test-fixtures` | ☐ |

---

*Hand off to Claude Code or human dev. One fix per release.*
