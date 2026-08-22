# FIX-PROMPT — career-ops-ui · FINAL CONSOLIDATED

> **Single canonical fix-prompt** as of 2026-05-18, stand at **v1.56.1** (HEAD `b222b7b`).
> Roll forward by appending CLOSED rows as ships land; never re-file a CLOSED finding without live evidence of regression.
> Lives at `qa/FIX-PROMPT-FINAL.md`. Companions: `qa/REGRESSION-FINAL.md`, `qa/FUNCTIONALITY-CHECK.md`, `qa/UX-AUDIT-PROMPT.md`, `qa/G-005-closure-kit.md`.

---

## 0. Project snapshot

| Item | Value |
|---|---|
| Stand version | **v1.56.1** |
| Test suite | 717+ unit + Playwright e2e + sh-files + canonical-docs-coverage all green |
| 8-locale CHANGELOG parity | ✓ @ 1.56.1 |
| Live matrix (latest run) | 8 locales × 24 routes = **192/192 PASS** (0 console errors) |
| Open findings | **2 LOW** (UX-N1, UX-N2) |
| Closed in current cycle | **14** (12 UX + 2 a11y) — see §3 ledger |

**Ship doctrine (CLAUDE.md):** one fix per PR · bump + CHANGELOG ×8 (parity-gated) + test + Playwright-verify + pre-commit AI-review-LGTM + CI-watch. Never batch. Never `--no-verify`. HIGH → MEDIUM → LOW.

---

## 1. Active backlog — what to ship next

### UX-N1 — Per-route browser title (target **v1.56.2**)

**Severity:** LOW
**Lens:** 8 Consistency · 9 Accessibility-as-UX · 12 Aesthetic
**Reference:** `qa/v54-regression/2026-05-18-UX-AUDIT.md`

**Symptom (live, v1.56.1):**
```
location.hash → /dashboard /scan /cv /config /help /auto /evaluate
document.title === "career-ops — command center"   // SAME for all 7
title_unique === 1   // expected: 7
```

**User impact:**
- Multi-tab browsers show identical titles → impossible to pick the right SPA tab.
- Bookmark name is generic.
- Screen-reader "page changed" announcement reads the same on every navigation.

**Patch — `public/js/router.js`:**

```diff
   function focusNewView() {
     const main = document.querySelector('#content');
     const h1 = main?.querySelector('h1.page-title');
     if (h1) {
       h1.setAttribute('tabindex', '-1');
       h1.focus({ preventScroll: false });
     }
+    // v1.56.2 — UX-N1: per-route document.title (multi-tab + a11y).
+    const viewTitle = (h1?.textContent || '').trim();
+    document.title = viewTitle
+      ? `${viewTitle} — career-ops`
+      : 'career-ops — command center';
   }
```

If `focusNewView()` isn't where the route name is canonical, route through `route.viewKey` + `t(viewKey + '.title')` instead. Either approach is fine; the contract is that 24 routes produce 24 distinct titles.

**Test — `tests/document-title-per-route.test.mjs`:**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('every SPA route sets a distinct, locale-aware document.title', async () => {
  const routes = [
    '/dashboard','/scan','/pipeline','/auto','/evaluate','/batch','/deep',
    '/apply','/tracker','/reports','/cv','/profile','/config','/health',
    '/activity','/help','/settings','/portals','/contacto','/followup',
    '/interview-prep','/patterns','/project','/training'
  ];
  const titles = new Set();
  for (const r of routes) {
    await navigate(r);
    const t = document.title;
    assert.ok(t.length > 0 && t !== 'career-ops — command center' || r === '/dashboard',
      `route ${r} kept the default title: "${t}"`);
    titles.add(t);
  }
  // 24 routes, ≥ 20 distinct titles (aliases #/portals→#/config and #/settings→#/profile may share)
  assert.ok(titles.size >= 20, `expected ≥20 distinct titles, got ${titles.size}: ${[...titles].join(' | ')}`);
});
```

**Acceptance:**
- ✅ `document.title` updates on every `router.focusNewView()` call
- ✅ 24 routes → ≥ 20 distinct titles (aliases may share)
- ✅ Each title is localized (Russian/Chinese/etc.) when locale is non-en
- ✅ `tests/document-title-per-route.test.mjs` PASS

**CHANGELOG ×8 entry:** `feat(a11y): UX-N1 — per-route document.title for multi-tab orientation + screen-reader page-change announcement`

---

### UX-N2 — Visible Cmd/Ctrl+K hint on global search (target **v1.56.3**)

**Severity:** LOW
**Lens:** 3 Information scent · 12 Aesthetic

**Symptom (live, v1.56.1):**
```
#global-search.aria-label === "Global search — Cmd+K to focus, paste a …"
#global-search.placeholder === "Find a company, role or URL…"
visible_hint_with_shortcut === false   // no <kbd> badge anywhere
```

**User impact:** Sighted users discover the Cmd+K shortcut only by reading source or aria. The app feels slower than it actually is.

**Patch — `public/index.html` (sidebar global-search wrapper):**

```diff
- <input id="global-search" type="text" placeholder="Find a company, role or URL…"
-        aria-label="Global search — Cmd+K to focus, paste a job URL, or pick a route">
+ <div class="global-search-wrapper">
+   <input id="global-search" type="text" placeholder="Find a company, role or URL…"
+          aria-label="Global search — Cmd+K to focus, paste a job URL, or pick a route">
+   <kbd class="kbd-shortcut" aria-hidden="true" data-mac="⌘K" data-other="Ctrl K"></kbd>
+ </div>
```

**Patch — `public/js/app.js` or where boot runs (one-liner):**

```js
// v1.56.3 — UX-N2: platform-aware Cmd/Ctrl K hint
(function setupKbdHint() {
  const kbd = document.querySelector('.kbd-shortcut');
  if (!kbd) return;
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  kbd.textContent = isMac ? kbd.dataset.mac : kbd.dataset.other;
})();
```

**Patch — `public/css/app.css` (small):**

```css
.global-search-wrapper { position: relative; }
.global-search-wrapper .kbd-shortcut {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--foggy);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
  pointer-events: none;
  user-select: none;
}
.global-search-wrapper input { padding-right: 56px; } /* leave space for the badge */
```

**Test — `tests/cmdk-hint-visible.test.mjs`:**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('global-search has a visible kbd hint reflecting the platform', async () => {
  const kbd = doc.querySelector('.global-search-wrapper .kbd-shortcut');
  assert.ok(kbd, 'kbd-shortcut element missing');
  // text content is one of the two platform variants
  const text = kbd.textContent.trim();
  assert.ok(/^⌘K$|^Ctrl K$/.test(text), `unexpected kbd text: "${text}"`);
  // visually present (not display:none)
  const cs = getComputedStyle(kbd);
  assert.notStrictEqual(cs.display, 'none', 'kbd-shortcut is hidden');
  // aria-hidden so screen readers don't double-announce (aria-label already covers it)
  assert.strictEqual(kbd.getAttribute('aria-hidden'), 'true');
});
```

**Acceptance:**
- ✅ Sighted user sees `⌘K` (mac) or `Ctrl K` (win/linux) badge inside the input
- ✅ `aria-hidden="true"` prevents screen-reader double-announce
- ✅ Cmd+K (or Ctrl+K on non-mac) still focuses the search input (existing keybinding intact)
- ✅ `tests/cmdk-hint-visible.test.mjs` PASS

**CHANGELOG ×8 entry:** `feat(ui): UX-N2 — visible platform-aware ⌘K/Ctrl K hint on global search input`

---

## 2. Ship sequence

| # | Version | Finding | File touched | Test added |
|---|---|---|---|---|
| 1 | **v1.56.2** | UX-N1 | `public/js/router.js` | `tests/document-title-per-route.test.mjs` |
| 2 | **v1.56.3** | UX-N2 | `public/index.html` + `public/js/app.js` + `public/css/app.css` | `tests/cmdk-hint-visible.test.mjs` |

After v1.56.3 ships:
- 192/192 routes still PASS
- `npm run test:ci` count = current + 2
- This fix-prompt is fully closed.

---

## 3. Closed baseline (do NOT re-file without live regression evidence)

Per `qa/UX-AUDIT-PROMPT.md` baseline section. All confirmed live on v1.56.1.

### Closed in v1.54.x

| ID | Sev | Closed | Live evidence |
|---|---|---|---|
| F-V54-A | MEDIUM | v1.54.1 | `/cv` h1Count=1 in all 8 locales; user's `# Name` → `<h2>` |
| F-V54-B | MEDIUM | v1.54.4 | pipeline ▶ `aria-label="Evaluate: job-boards.greenhouse.io/…/jobs/5165641008"` |
| F-V54-C | MEDIUM | v1.54.5 | batch-tsv `aria-label="Batch TSV — one offer per line: …"` |
| S-7 | LOW | v1.54.6 | help back-to-top `className="… back-to-top"` |
| W-001 | LOW | v1.54.7 | `Cache-Control: no-store` on JS/CSS/SPA shell |

### Closed in v1.55.x→v1.56.0

| ID | Sev | Closed | Locked by |
|---|---|---|---|
| F-V55-E / UX-1 | MEDIUM | v1.55.1 | `auto-stepper-prerender.test.mjs` — 5 stages render on mount |
| F-V55-H / UX-5 | MEDIUM | v1.55.2 | `cv-editor-a11y.test.mjs` — `#cv-editor` aria-label |
| UX-2 | HIGH | v1.55.3 | `onboarding-key-banner.test.mjs` — 4-provider OR banner/chip + `/api/status/providers` |
| UX-6 | MEDIUM | v1.55.4 | `auto-eta-stop.test.mjs` — `⏱ ~1–2 min` + scan Stop prominence |
| UX-3 | MEDIUM | v1.55.5 | `dashboard-hero.test.mjs` — hero CTAs + status chips |
| UX-4 | MEDIUM | v1.55.6 | `scan-advanced-disclosure.test.mjs` |
| UX-7 | MEDIUM | v1.55.7 | `pipeline-virtualize.test.mjs` — btns 2778→40 at 1385 rows |
| UX-8 | MEDIUM | v1.55.8 | `tracker-server-paged.test.mjs` — server pagination + funnel chips |
| UX-9 | LOW | v1.56.0 | `cv-breadcrumb.test.mjs` — `.cv-breadcrumb` chip |
| UX-10 | LOW | v1.56.0 | `run-cost-line.test.mjs` — ⚡ Run live cost hint |
| UX-11 | LOW | v1.56.0 | `help-toc-autoscroll.test.mjs` |
| UX-12 | LOW | v1.56.0 | `dashboard-initial-focus.test.mjs` — h1 focus, aria-live |

### Senior-obs ledger

`S-1 → UX-3` · `S-2 → UX-7` · `S-3 → UX-4` · `S-4 → UX-1` · `S-5 → UX-9` · `S-6 → UX-8` · `S-7 → v1.54.6` · `W-001 → v1.54.7`

All 8 senior observations from prior cycle resolved or rolled into UX-* numbered findings.

---

## 4. Definition of Done (DoD)

This fix-prompt is fully closed when ALL of the following are true:

- [ ] **v1.56.2** UX-N1 shipped — per-route `document.title` live + test asserting ≥ 20 distinct titles across 24 routes
- [ ] **v1.56.3** UX-N2 shipped — platform-aware `<kbd>⌘K | Ctrl K</kbd>` badge live + test asserting badge visible + aria-hidden
- [ ] `qa/REGRESSION-FINAL.md` §11 ledger updated with UX-N1 + UX-N2 rows (CLOSED in vX.Y.Z)
- [ ] `qa/UX-AUDIT-PROMPT.md` baseline section updated — UX-N1 + UX-N2 added to "already-closed findings (do NOT re-file)"
- [ ] All 8 CHANGELOG locales at v1.56.3 (parity gate)
- [ ] `npm run test:ci` count = current + 2 (one per fix)

Once all checkboxes ticked, file this prompt under `qa/archive/v1.56-fix-prompts/`.

---

## 5. Test-runner cheat sheet

```bash
# Pre-flight (run before every fix PR)
vX=$(node -p "require('./package.json').version")
npm ci && npm run test:ci          # must end "✓ no .also( · ✓ CHANGELOG parity all 8 @ $vX"
node --test tests/sh-files.test.mjs               # 10/10
node scripts/check-changelog-parity.mjs            # ✓ all 8 @ $vX
node scripts/check-no-also-leftovers.mjs           # ✓

# Per-fix verify
node --test tests/<the-new-test>.test.mjs          # PASS
npm run test:ci                                    # N+1 / N PASS (one new test)
node tests/e2e.mjs                                 # failed: 0
node tests/e2e-comprehensive.mjs                   # 0 failed
npm run test:e2e:browser                           # 32/32

# Stand probes (post-fix verification)
curl -fsS http://127.0.0.1:4317/api/health | python3 -m json.tool   # ok=true, version=$vX

# UX-N1 verify: titles per route
for r in dashboard scan pipeline auto evaluate batch deep apply tracker reports cv profile config health activity help; do
  echo -n "/#/$r → "
  # Open in browser, check document.title; or use Playwright snapshot
done

# UX-N2 verify: visible kbd badge
# Open in browser, inspect .global-search-wrapper .kbd-shortcut, confirm display !== 'none'

# Locale rotation (8-locale gate stays green)
for lc in en es pt-BR ko ja ru zh-CN zh-TW; do
  curl -fsS "http://127.0.0.1:4317/api/help/$lc" \
    | python3 -c "import sys,json,re; md=json.load(sys.stdin)['markdown']; print(f'$lc: {len(re.findall(r\"^## [^#]\", md, re.M))} H2 / {len(re.findall(r\"^### \", md, re.M))} H3')"
done
# expected: every line shows "17 H2 / 70 H3"
```

---

## 6. Files this prompt references

- `qa/REGRESSION-FINAL.md` — perennial regression spec (§11 has the v1.55.x→v1.56.0 closures regression-locked)
- `qa/FUNCTIONALITY-CHECK.md` — perennial functional-correctness spec
- `qa/UX-AUDIT-PROMPT.md` — perennial UX-audit spec (with anti-replay baseline section)
- `qa/v54-regression/2026-05-18-UX-AUDIT.md` — current audit findings (UX-N1, UX-N2)
- `qa/v54-regression/2026-05-18-v1.56.1-BROWSER-EXHAUSTIVE.md` — exhaustive 8-locale × 24-route × every-button live evidence
- `public/js/router.js`, `public/index.html`, `public/js/app.js`, `public/css/app.css` — files touched by UX-N1 + UX-N2
- `public/js/i18n-dict.js` — no new keys required (router uses existing view titles)
