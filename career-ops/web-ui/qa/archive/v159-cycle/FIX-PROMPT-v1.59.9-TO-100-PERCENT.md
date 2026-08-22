# FIX-PROMPT — career-ops-ui → 100 % maturity · post-v1.59.8

Two-release queue to close **every** remaining open defect after v1.59.8 sign-off:

| Release | Ticket | Severity | Why open |
|---|---|---|---|
| **v1.59.9** | UX-A5-r4 | **HIGH** | 6th consecutive regression — Help TOC scroll-spy never paints `.toc-current` |
| v1.59.10 | NEW-F1-sub-r1 | LOW | `req.originalUrl` traversal bypasses Express path-normalization |

After both ship green with the TDD-first guard, the product reaches **10 / 10 / 100 % production-ready** with zero open UI defects (G-005 parent-blocked, out of scope).

**Doctrine — non-negotiable:**
> ONE fix per release. Bump + CHANGELOG ×8 (parity-gated) + dedicated test that **must fail first** + Playwright-verify + pre-commit AI-review LGTM + `ci.yml` green to tag. Never batch. Never `--no-verify`.

---

## §1 — Why this fix-prompt is different from the last 5 attempts

UX-A5 was previously "closed" at v1.58.45, v1.58.52, v1.59.0, v1.59.3, v1.59.8 — five times. Every closure had:
- a ledger entry
- a CHANGELOG bullet
- "tests green"

But the bug stayed open. **Root cause: the tests never failed when the bug returned.** They asserted the wrong thing — usually "an element with class `.toc-current` exists in the DOM at any time" or "the file `help.js` contains the string `IntersectionObserver`". Neither of those caught: *"after the user scrolls, the active section's TOC link gets the highlight class"* — the actual user promise.

**The v1.59.9 fix MUST start with a failing test that asserts the user promise**, then make it pass. No shortcuts.

---

## §2 — FIX v1.59.9 · UX-A5-r4 — Help TOC scroll-spy (HIGH, must-fail-first)

### Step 1 · DIAGNOSTIC (do this first, paste output in the PR description)

Open `#/help` in Chrome. Open DevTools console. Run each line, **paste the output**:

```js
// 1. Listener inventory
getEventListeners(window).scroll?.map(l => l.type + ':' + l.passive)
// Expect a passive scroll listener; if empty, the v1.59.8 scroll-listener path never bound.

// 2. Function presence
typeof window.computeActiveAndApply ?? 'not-exposed'
// If 'not-exposed', the function is module-private. Run it manually via the next line.

// 3. Manual invocation (if exposed) — should produce a .toc-current if the function logic is sound
window.computeActiveAndApply?.();
document.querySelectorAll('.help-toc a.toc-current').length
// If this becomes 1+ after manual call, the BINDING is broken (listener not attached).
// If still 0, the function LOGIC is broken (wrong selector / wrong class / wrong target).

// 4. DOM sanity
({
  h2s: document.querySelectorAll('main h2[id^="help-h-"]').length,
  links: document.querySelectorAll('.help-toc a[href^="#help-h-"]').length,
  cssRule: [...document.styleSheets].flatMap(s => {
    try { return [...s.cssRules].map(r => r.cssText) } catch(e) { return [] }
  }).find(t => t.includes('.toc-current'))
})
// Expect: h2s===18, links===18, cssRule is non-null AND has visible declarations
// (color/border/background). If cssRule is null OR has no visible decl, the fix
// is invisible to the user even when the class IS applied.
```

The diagnostic identifies **which of three failure modes** is the actual cause. Most likely: **binding** (v1.59.8 listener was never added to `window`'s scroll event), since `getEventListeners(window).scroll` should be a 5-second check.

### Step 2 · WRITE THE TEST FIRST (red bar mandatory)

Create `tests/e2e/help-toc-scroll-spy.spec.mjs` and commit it on a branch **before** writing any production code. The test MUST fail on `main` today:

```js
// tests/e2e/help-toc-scroll-spy.spec.mjs
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:4317';

test.describe('Help TOC scroll-spy (UX-A5)', () => {
  test('initial paint: first section is highlighted', async ({ page }) => {
    await page.goto(`${BASE}/#/help`);
    await page.waitForSelector('main h2[id^="help-h-"]');
    await page.waitForFunction(() =>
      document.querySelectorAll('.help-toc a[href^="#help-h-"]').length >= 18,
      { timeout: 5000 });
    // give the listener one rAF tick
    await page.waitForTimeout(100);
    const count = await page.locator('.help-toc a.toc-current').count();
    expect(count).toBeGreaterThan(0);          // ← MUST FAIL on v1.59.8
    expect(count).toBe(1);                      // exactly one highlighted at any time
  });

  test('scroll to middle: highlight follows', async ({ page }) => {
    await page.goto(`${BASE}/#/help`);
    await page.waitForSelector('main h2[id^="help-h-"]');
    await page.evaluate(() =>
      document.getElementById('help-h-5')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600);            // rAF + 1 frame
    const href = await page.locator('.help-toc a.toc-current').getAttribute('href');
    expect(href).toMatch(/^#help-h-[3-7]$/);   // any of the 3 surrounding sections
  });

  test('scroll deeper: highlight advances', async ({ page }) => {
    await page.goto(`${BASE}/#/help`);
    await page.waitForSelector('main h2[id^="help-h-"]');
    await page.evaluate(() =>
      document.getElementById('help-h-10')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600);
    const href = await page.locator('.help-toc a.toc-current').getAttribute('href');
    expect(href).toMatch(/^#help-h-(8|9|10|11|12)$/);
  });

  test('route-back: re-attaches on re-mount', async ({ page }) => {
    await page.goto(`${BASE}/#/help`);
    await page.waitForSelector('main h2[id^="help-h-"]');
    await page.goto(`${BASE}/#/dashboard`);
    await page.waitForSelector('main h1');
    await page.goto(`${BASE}/#/help`);
    await page.waitForSelector('main h2[id^="help-h-"]');
    await page.evaluate(() =>
      document.getElementById('help-h-7')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600);
    const count = await page.locator('.help-toc a.toc-current').count();
    expect(count).toBe(1);
  });

  test('debug marker: <body data-toc-spy="active"> when listener bound', async ({ page }) => {
    await page.goto(`${BASE}/#/help`);
    await page.waitForSelector('main h2[id^="help-h-"]');
    await page.waitForTimeout(200);            // listener has had time to set marker
    const marker = await page.locator('body').getAttribute('data-toc-spy');
    expect(marker).toBe('active');             // a single CSS selector can answer
                                               // "is the spy alive?" forever after
  });

  test('TOC click: highlight updates to clicked target', async ({ page }) => {
    await page.goto(`${BASE}/#/help`);
    await page.waitForSelector('main h2[id^="help-h-"]');
    await page.locator('.help-toc a[href="#help-h-12"]').click();
    await page.waitForTimeout(800);
    const href = await page.locator('.help-toc a.toc-current').getAttribute('href');
    expect(href).toBe('#help-h-12');
  });
});
```

Add a unit-test mirror for the binding contract — `tests/help-toc-binding.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

test('mountHelpToc attaches a passive scroll listener and sets data-toc-spy', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html><body>
      <main>
        <h2 id="help-h-0">A</h2><h2 id="help-h-1">B</h2><h2 id="help-h-2">C</h2>
      </main>
      <nav class="help-toc">
        <a href="#help-h-0">A</a><a href="#help-h-1">B</a><a href="#help-h-2">C</a>
      </nav>
    </body></html>
  `, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  const listeners = [];
  const origAdd = window.addEventListener.bind(window);
  window.addEventListener = (type, fn, opts) => {
    listeners.push({ type, passive: !!opts?.passive });
    return origAdd(type, fn, opts);
  };

  const { mountHelpToc } = require('../public/js/help-toc.js');
  mountHelpToc();

  assert.ok(listeners.some(l => l.type === 'scroll' && l.passive),
    'passive scroll listener must be attached to window');
  return new Promise(r => setTimeout(() => {
    assert.equal(document.body.getAttribute('data-toc-spy'), 'active',
      'body must carry data-toc-spy="active" after mount');
    r();
  }, 30));
});
```

**Run both tests on `main` before writing the fix. They MUST fail.** Commit the failing tests on the fix branch with a screenshot of the red bar in the PR description.

### Step 3 · THE CANONICAL FIX

`public/js/help-toc.js` (new module, or rewrite the existing scroll-spy section of `help.js`):

```js
// public/js/help-toc.js
// UX-A5-r4 — single canonical scroll-spy implementation.
// Replaces every previous attempt (IO, modified IO, rAF-listener v1.59.8 broken).
// PROMISE: while #/help is active, the TOC entry matching the section closest to
// 30% from the viewport top carries class .toc-current.

let bound = null;            // { onScroll, onResize, raf }
let heads = [];
let linkByHref = new Map();

function computeActiveAndApply() {
  if (!heads.length || !linkByHref.size) return;
  const triggerY = window.scrollY + window.innerHeight * 0.30;

  // Linear scan — 18 H2s is trivial; no need for binary search.
  let active = heads[0];
  for (const h of heads) {
    const top = h.getBoundingClientRect().top + window.scrollY;
    if (top <= triggerY) active = h;
    else break;            // heads is in document order
  }

  linkByHref.forEach(a => a.classList.remove('toc-current'));
  linkByHref.get('#' + active.id)?.classList.add('toc-current');
}

export function mountHelpToc() {
  unmountHelpToc();

  // Two rAFs — wait for both DOM-mount and font/style settle.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    heads = [...document.querySelectorAll('main h2[id^="help-h-"]')];
    linkByHref = new Map(
      [...document.querySelectorAll('.help-toc a[href^="#help-h-"]')]
        .map(a => [a.getAttribute('href'), a])
    );

    if (!heads.length || !linkByHref.size) return;

    // rAF-throttle the scroll handler — at most one apply per frame.
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        computeActiveAndApply();
      });
    };
    const onResize = onScroll;       // same shape

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    bound = { onScroll, onResize, raf };

    // Initial paint — fire once explicitly.
    computeActiveAndApply();

    // Debug marker — single CSS selector to answer "is the spy alive?" forever.
    document.body.setAttribute('data-toc-spy', 'active');
  }));
}

export function unmountHelpToc() {
  if (!bound) return;
  window.removeEventListener('scroll', bound.onScroll);
  window.removeEventListener('resize', bound.onResize);
  if (bound.raf) cancelAnimationFrame(bound.raf);
  bound = null;
  heads = [];
  linkByHref = new Map();
  document.body.removeAttribute('data-toc-spy');
}

// Route wiring — single source of truth.
function onRoute() {
  if (location.hash.startsWith('#/help')) mountHelpToc();
  else unmountHelpToc();
}
window.addEventListener('hashchange', onRoute);
document.addEventListener('DOMContentLoaded', onRoute);
```

CSS — `public/css/help.css` (must paint visibly even if cascading style sheets reorder):

```css
.help-toc a {
  display: block;
  padding: 6px 10px;
  border-left: 3px solid transparent;
  color: var(--foggy);
  text-decoration: none;
  transition: var(--transition);
}
.help-toc a:hover {
  color: var(--hof);
  background: color-mix(in srgb, var(--foggy) 10%, transparent);
}
.help-toc a.toc-current {
  color: var(--rausch);
  font-weight: 600;
  border-left-color: var(--rausch);
  background: color-mix(in srgb, var(--rausch) 10%, transparent);
}
```

### Step 4 · WIRE INTO THE BUILD

In `public/js/help.js` (or the file that loads when `#/help` is mounted), **replace any existing scroll-spy code** with a single import:

```js
import { mountHelpToc, unmountHelpToc } from './help-toc.js';
// Remove every old IntersectionObserver / scroll-listener / mountTocSpy block.
// help-toc.js's hashchange + DOMContentLoaded listeners handle lifecycle.
```

Audit `git grep -nE 'IntersectionObserver|toc-current|mountTocSpy|computeActiveAndApply'` — **only `help-toc.js` should match**. If any other file references these symbols, delete it (it's dead code from a previous attempt).

### Step 5 · LOCAL VERIFICATION (must be green before push)

```bash
npm test                                      # 973+ pass, 0 fail (new unit included)
npm run test:e2e:browser                      # all 6 scroll-spy Playwright cases pass
node --test tests/help-toc-binding.test.mjs   # binding contract green

# Live smoke (verify the red-bar→green transition with your own eyes)
npm start &
SERVER=$!
sleep 2
open http://127.0.0.1:4317/#/help
# Open DevTools console. Scroll down. Confirm a TOC entry shows brand color + left border.
# Run: document.body.getAttribute('data-toc-spy')      → "active"
# Run: document.querySelectorAll('.help-toc a.toc-current').length    → 1
kill $SERVER
```

### Step 6 · ACCEPTANCE (mechanical, no subjective wording)

A QA tester running `tests/e2e/help-toc-scroll-spy.spec.mjs` sees **6 / 6 green**. Independent of that:

1. `document.body.getAttribute('data-toc-spy') === 'active'` on `#/help`.
2. `document.querySelectorAll('.help-toc a.toc-current').length === 1` always, never 0, never 2.
3. After `scrollIntoView('help-h-5')` + 600 ms wait → `document.querySelector('.help-toc a.toc-current').getAttribute('href')` matches `/^#help-h-[3-7]$/`.
4. After `#/dashboard` → `#/help` round-trip, all 3 above still hold.
5. `getComputedStyle(document.querySelector('.help-toc a.toc-current')).borderLeftColor` matches `var(--rausch)` (i.e. the class **paints**, not just attaches).

### Step 7 · CHANGELOG ×8 (parity-gated)

EN example:
```md
## [1.59.9] - 2026-MM-DD

### Fixed
- Help TOC scroll-spy now actually highlights the active section
  (`#help-h-N` link gets `.toc-current` as the user scrolls). Replaces the
  five previous attempts with a single canonical scroll-listener
  implementation + `<body data-toc-spy="active">` debug marker for permanent
  regression visibility. Lock-tested by 6 Playwright cases that fail without
  the fix. (UX-A5-r4)
```

RU translation (one of 8):
```md
## [1.59.9] - 2026-MM-DD

### Fixed
- Скролл-spy в оглавлении `#/help` теперь действительно подсвечивает
  активный раздел (ссылка `#help-h-N` получает класс `.toc-current` при
  прокрутке). Заменяет пять предыдущих попыток единственной канонической
  реализацией + debug-маркер `<body data-toc-spy="active">` для постоянной
  видимости регрессий. Заблокирован 6 Playwright-тестами, которые красят
  при отсутствии фикса. (UX-A5-r4)
```

Run `node scripts/check-changelog-parity.mjs` — all 8 locales must show `v1.59.9` at top.

### Step 8 · GUARD RAILS — make the 7th regression impossible

After the fix lands:
1. Add `tests/e2e/help-toc-scroll-spy.spec.mjs` to `npm run test:e2e:browser` default config — it MUST run on every CI build.
2. Add a static guard in `tests/qa-report-fixes.test.mjs`:
   ```js
   test('UX-A5-r4 module is the only scroll-spy source', () => {
     const grep = require('child_process').execSync(
       'git grep -lE "IntersectionObserver|computeActiveAndApply|toc-current" public/',
       { encoding: 'utf-8' });
     const files = grep.trim().split('\n').filter(Boolean);
     assert.deepEqual(files.sort(), [
       'public/css/help.css',
       'public/js/help-toc.js',
     ]);
   });
   ```
   Any future attempt to introduce a second scroll-spy implementation fails this test.
3. Add a runtime assertion (dev-mode only) in `help-toc.js`:
   ```js
   if (process.env.NODE_ENV === 'development') {
     console.assert(
       document.body.getAttribute('data-toc-spy') === 'active',
       '[UX-A5] scroll-spy not mounted — check route wiring'
     );
   }
   ```

---

## §3 — FIX v1.59.10 · NEW-F1-sub-r1 — un-encoded `../` traversal (LOW)

### Root cause
v1.59.8 mounted `app.all('/api/*', JSON-404)` to catch unknown API paths. It works for unknown verbs / unknown endpoints, but Express **normalises the path before route matching**. So `GET /api/jds/../../../etc/passwd` becomes a request for a path that **no longer starts with `/api`**, falls through to `express.static(...)`, returns the SPA shell with `200 OK`. No file leak (the static handler serves `index.html`, not `/etc/passwd`), but the API contract is broken.

### Fix
Mount a `req.originalUrl`-inspecting middleware **before** `express.static` and **before** all route handlers:

```js
// server/index.mjs (or wherever the app pipeline is assembled)

app.use((req, res, next) => {
  // Inspect the RAW URL — Express has not normalised this yet.
  if (/^\/api(\/|$)/.test(req.originalUrl) && /\.\.\//.test(req.originalUrl)) {
    return res.status(404)
      .type('application/json')
      .json({ error: 'invalid path' });
  }
  next();
});

// ... existing /api routes ...

app.all('/api/*', (_req, res) => {
  res.status(404).type('application/json').json({ error: 'unknown api' });
});

// ... static + SPA fallback ...
```

### Test · `tests/api-path-traversal.test.mjs` (must fail first)

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://127.0.0.1:4317';

test('un-encoded path traversal on /api/* returns 404 JSON', async () => {
  const cases = [
    '/api/jds/../../../etc/passwd',
    '/api/interview-prep/../../../package.json',
    '/api/reports/../../config/profile.yml',
  ];
  for (const path of cases) {
    const r = await fetch(BASE + path);
    assert.equal(r.status, 404, `${path} → got ${r.status}, expected 404`);
    const ct = r.headers.get('content-type') || '';
    assert.ok(ct.includes('application/json'),
      `${path} → got ${ct}, expected application/json`);
    const body = await r.json();
    assert.equal(body.error, 'invalid path');
  }
});

test('encoded path traversal still returns 404 JSON (regression lock)', async () => {
  const r = await fetch(BASE + '/api/jds/%2e%2e%2fetc%2fpasswd');
  assert.equal(r.status, 404);
  assert.ok((r.headers.get('content-type') || '').includes('application/json'));
});

test('valid /api/health still works', async () => {
  const r = await fetch(BASE + '/api/health');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.ok);
});
```

### Acceptance

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --path-as-is \
  "http://127.0.0.1:4317/api/jds/../../../etc/passwd"
# Expect: 404 application/json
```

### CHANGELOG (EN example)
```md
## [1.59.10] - 2026-MM-DD

### Fixed
- Un-encoded path traversal segments under `/api/*` (e.g.
  `/api/jds/../../../etc/passwd`) now correctly return a JSON 404 instead of
  falling through to the SPA shell. Express normalises the path before route
  matching, which made the v1.59.5 `app.all` guard ineffective for this
  sub-case; the new middleware inspects `req.originalUrl` before any
  normalisation. No file leak existed (the static handler returned `index.html`,
  not the requested file), but the API contract is now consistent. (NEW-F1-sub-r1)
```

---

## §4 — Universal acceptance protocol (per release)

```bash
git status                                       # clean
npm ci
node scripts/check-changelog-parity.mjs          # all 8 at vX
node scripts/check-no-also-leftovers.mjs
npm test                                         # >= 973 + new tests, 0 fail
npm run test:coverage                            # line >= 93%, branch >= 83%
npm run test:e2e                                 # 20 smoke green
npm run test:e2e:full                            # 23 comprehensive green
npm run test:e2e:browser                         # 62+ Playwright (new + existing)

# Browser smoke
npm start
# verify the fix's surface live in EN + 1 non-EN (ru) — paste evidence in PR

# Tag
git commit -m "fix(<area>): <one-line> (TICKET-ID)"
git tag v1.59.<N>
git push origin main v1.59.<N>
# Watch CI Node 18 / 20 / 22 to success on every job.
```

---

## §5 — Locale matrix per fix

| Fix | Locales to verify |
|---|---|
| UX-A5-r4 | EN + RU (IO-free implementation is locale-agnostic; H2 ids are stable; verify class+border paint in both light and dark themes) |
| NEW-F1-sub-r1 | server-side; locale-irrelevant (DOC-1 EN by-policy on 4xx) |

---

## §6 — Sign-off matrix (the gate to 10 / 10)

| Gate | Pass |
|---|---|
| v1.59.9 — `tests/e2e/help-toc-scroll-spy.spec.mjs` (6 cases) all green | ☐ |
| v1.59.9 — `tests/help-toc-binding.test.mjs` binding contract green | ☐ |
| v1.59.9 — `<body data-toc-spy="active">` present on `#/help`, absent elsewhere | ☐ |
| v1.59.9 — `git grep -lE 'IntersectionObserver\|computeActiveAndApply\|toc-current' public/` returns exactly 2 files: `public/css/help.css` + `public/js/help-toc.js` | ☐ |
| v1.59.9 — visual smoke: scroll past section 5 → TOC entry paints brand color + left border in EN+RU on both themes | ☐ |
| v1.59.10 — `tests/api-path-traversal.test.mjs` (3 cases) all green | ☐ |
| v1.59.10 — `curl --path-as-is "/api/jds/../../../etc/passwd"` returns `404 application/json` | ☐ |
| v1.59.10 — `/api/health` still returns 200 ok (regression lock) | ☐ |
| `npm test` >= 975 + 2 new tests green | ☐ |
| CI Node 18 / 20 / 22 `success` × 2 ships | ☐ |
| MASTER REGRESSION rerun green; UX-A5 + NEW-F1-sub both close | ☐ |
| `data/pipeline.md` cleared via `make clean-test-fixtures` before Playwright | ☐ |

---

## §7 — Why this fix-prompt closes the loop forever

1. **TDD-first.** The Playwright + unit tests are committed BEFORE the fix on the branch — the red bar is recorded in the PR, the green bar is the merge condition. No "ship + ledger entry, no test failure on regression" path remains.
2. **Debug marker.** `<body data-toc-spy="active">` is a single-selector check that a future tester can use, in any locale, in any theme, from anywhere in the app: open DevTools, type `$('body').dataset.tocSpy === 'active'`. Either the spy is alive (and the user sees the highlight) or it isn't.
3. **Static guard.** `git grep` test fails if anyone re-adds an IntersectionObserver path or a second `toc-current` writer. Only one source of truth.
4. **Visual acceptance.** Step-6 includes a `getComputedStyle().borderLeftColor` check — the class is **painted**, not just attached. (One of the previous attempts attached the class but the CSS rule was overridden by `.help-toc a { border-left: 0 }` further down the cascade.)
5. **Same-doctrine routing fix.** v1.59.10 follows the same pattern: failing test → middleware → test green → ship. No more "shipped at v1.59.5" while the fix is incomplete.

---

## §8 — Out of scope (will remain open after 100 %)

| ID | Owner | Status |
|---|---|---|
| G-005 (parent `modes/oferta.md` A-G nomenclature) | parent project | blocked — schema-tolerant render in place |
| C-1 (parent `modes/deep.md` prompt layer) | parent project | blocked — UX-A1 defensive workaround in place |
| UX-022 (parent `portals.yml` stale URLs) | parent project | blocked |
| CLI locale (parent stdout) | parent | post v1.60 |
| RTL support (Arabic / Hebrew) | this repo | post v1.60 |
| Drag-and-drop reorder · bulk delete · PWA / offline | this repo | post v1.60 |

These are **not regressions** — they're either parent-owned (the web-ui's read-only contract forbids editing parent files) or explicitly v1.60+ scope. They do **not** count against the 100 % bar.

---

## §9 — Ship order

1. **Day 1:** branch `fix/ux-a5-r4`, commit the 6 Playwright cases + the binding unit test. Push, watch CI go red. **Screenshot the red bar.**
2. **Day 1:** implement `public/js/help-toc.js` + the CSS rule + the import in `help.js`. Delete every other scroll-spy reference. Run tests locally → green. Push, watch CI go green.
3. **Day 1:** pre-commit AI review LGTM. Tag `v1.59.9`. Push tag. CI matrix green. Deploy.
4. **Day 2:** branch `fix/new-f1-sub-r1`, commit the 3 path-traversal tests. Push red. Implement middleware. Push green. Tag `v1.59.10`.
5. **Day 2 evening:** rerun the v1.59.8 SIGN-OFF walkthrough against v1.59.10. Both §4 and §1.4 must now PASS. Sign-off matrix all ✓.

After Day 2, **the product is 100 % production-ready** within the web-ui scope. Maturity 10 / 10 across every dimension. The next ledger has only out-of-scope (parent / v1.60) items.

---

*Generated 2026-05-21 against v1.59.8. Hand to Claude Code or a human dev. Two fixes, two releases, doctrine respected, regression impossible.*
