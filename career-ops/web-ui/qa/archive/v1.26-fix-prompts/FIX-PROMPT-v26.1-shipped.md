# career-ops-ui v1.26.0 → v1.26.1 · CURRENT FIX-PROMPT

> **Stand state:** v1.26.0 verified live via Chrome + curl against `127.0.0.1:4317` on 2026-05-14.
> See `qa/v24-regression/01-LIVE-8-LOCALES-WORKFLOWS.md` + `qa/v26-regression/2026-05-14-REGRESSION.md` for the full evidence.
> Most of the v1.10–v1.24 backlog **closed** (24 of 26 findings). Outdated fix-prompts → `qa/archive/`.

## ✅ Closed in v1.24.1 → v1.26.0 (since last fix-prompt)

| ID | Closed in | How verified |
|---|---|---|
| **G-015** `/#/config` crash | v1.24.1 | After cache-bust, `/#/config` renders 3 tabs (API keys / Profile / Modes), `crashed:false` |
| **G-014** auto-pipeline `mode:'manual'` ignored | v1.25.0 | `POST /api/auto-pipeline {mode:'manual'}` returns in **3 ms** with `mode/prompt` in body |
| **G-012** CHANGELOG locale parity | v1.25.0/26.0 | All 8 CHANGELOGs at `## [1.26.0] — 2026-05-14` |
| **Cosmetic double-✨** | v1.25.0 | Dashboard button text = `✨ Auto-pipeline a URL` (single ✨) |
| **v1.26.0 test pyramid** | v1.26.0 | `docs/architecture/TESTING.md` + `tests/acceptance/` + 2 CI gates + `test:ci` script all present |

## ⚠ Still open at v1.26.0

| ID | Severity | Title | Target |
|---|---|---|---|
| **WCAG-2.5.5-btn-height** | **HIGH** | 5 `.btn:not(.btn-sm)` in header render at 39-41 px high (WCAG 2.5.5 violation) | **v1.26.1** |
| G-005 | Minor (docs) | Report blocks A-G (`C=Risks, F=Verdict, G=Legitimacy`) vs canonical career-ops.org A-F (`C=Strategy, F=STAR`) | v1.27.0 (coordinated parent commit) |
| G-003 | Minor (cosmetic) | `README.cn.md` should be `README.zh-CN.md` for naming consistency | v1.27.0 |
| **Sidebar dup `#/dashboard` × 2** | Trivial | Brand logo + nav item both link `#/dashboard` | nice-to-have, no UX impact |

---

# v1.26.1 hot-fix (the only HIGH-severity item)

## PR-A · `fix(css): restore 44 px min-height on header .btn` (WCAG 2.5.5)

### Symptom (live measurement on v1.26.0)

| Button | id / class | Width × Height |
|---|---|---|
| Doctor | `#btn-doctor.btn.btn-ghost` | 88 × **39** px |
| Quick scan | `#btn-quick-scan.btn.btn-primary` | 117 × **39** px |
| Open Pipeline | `.btn.btn-ghost` | 136 × **39** px |
| 🌐 Scan now | `.btn.btn-primary` | 126 × **41** px |
| ✨ Auto-pipeline a URL | `.btn.btn-primary` | 194 × **41** px |

All 5 are `.btn` (NOT `.btn-sm`). Per WCAG 2.5.5 and the v1.18.0 / v1.20.0 contract, every `.btn:not(.btn-sm)` must be ≥ 44 × 44 px.

### Root cause

`public/css/app.css:391-405` sets `.btn { min-height: 44px; padding: ...; }` correctly. But the header container (`.page-header`, `.banner` or similar) clamps the row height with `height` or `align-items: center` + a too-tight outer dimension. The header buttons end up at the row height (~39-41 px), overriding `min-height` because `box-sizing` inheritance + flex shrink prefers the parent.

Two-line fix:

```diff
- .btn {
-   min-height: 44px;
+   padding: 10px 14px;            /* or whatever current padding is */
- }

+ .btn {
+   min-height: 44px;
+   line-height: 1.2;
+   /* override parent flex squashing */
+   flex-shrink: 0;
+ }
```

OR (preferred — fix the parent instead so the row grows):

```diff
.banner, .page-header {
  display: flex;
  align-items: center;
- height: 56px;            /* or whatever the current squashing value is */
+ min-height: 56px;        /* let .btn 44 + padding push the row taller if needed */
}
```

Pick whichever pattern matches the existing codebase. The smell is in the header banner row, not in `.btn` itself.

### Test

```js
// tests/wcag-target-size.test.mjs (new)
test('.btn:not(.btn-sm) height >= 44 px on every public route', async () => {
  for (const route of ['/dashboard','/scan','/pipeline','/evaluate','/batch','/reports',
                        '/tracker','/activity','/cv','/profile','/config','/health','/help']) {
    await page.goto(BASE + '/#' + route);
    await page.waitForLoadState('networkidle');
    const bad = await page.$$eval('.btn:not(.btn-sm)', els =>
      els.filter(b => b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)
         .map(b => ({ text: b.textContent.trim().slice(0,30), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
    assert.deepEqual(bad, [], `route ${route} has small .btn:\n${JSON.stringify(bad, null, 2)}`);
  }
});
```

Wire into `npm run test:e2e:full`.

### Risk

Zero — adding `min-height` and `flex-shrink: 0` to existing classes only grows the header on Safari/Firefox where padding was being clamped. No layout regression on Chrome (where it already renders at 41-44 px range).

---

# v1.27.0 (next regular release)

## PR-B · `fix(evaluate): realign report blocks A-F per canonical career-ops.org/docs` (G-005)

Coordinated parent + web-ui commit. See `qa/archive/v1.25-fix-prompts/FIX-PROMPT-v24.1-shipped.md → PR-D` for full spec. Summary:

- Parent: rewrite `modes/oferta.md` to emit **A-F** (drop G-Legitimacy, move score to header, rename C→Strategy, E→Personalization, F→STAR).
- web-ui: update `SCAFFOLD_STRINGS` in `prompts.mjs` + `docs/help/<locale>.md` §9 × 8 locales.
- Renderer must still display pre-v1.27 A-G reports as-is (graceful degrade).

## PR-C · `chore: rename README.cn.md → README.zh-CN.md` (G-003)

```bash
git mv README.cn.md README.zh-CN.md
sed -i.bak 's|README\.cn\.md|README.zh-CN.md|g' README.md docs/*.md
rm README.md.bak docs/*.bak 2>/dev/null
```

Update the language picker line in `README.md`. Verify with `ls README*.md` — 8 files with canonical names.

## PR-D · `fix(sidebar): dedupe #/dashboard entry` (cosmetic)

Currently the brand logo and the first nav item both link to `#/dashboard`. Drop the `<a href="#/dashboard">` wrapper on the brand logo (let it be a plain title) OR drop the nav item entry (less preferred). Risk: zero.

---

# Final acceptance before tag

```bash
cd /Users/sergejemelanov/Projects/career-ops/web-ui
npm test                                              # all green
npm run test:ci                                       # incl. check-no-also-leftovers + check-changelog-parity gates
npm run test:e2e:full
npm run test:coverage                                 # ≥ 93/83 (current baseline)

# Manual smoke after v1.26.1 deploy
1. Open #/dashboard → measure header .btn heights — all ≥ 44 px (DevTools getBoundingClientRect)
2. Switch through ru/ja/ko/zh-CN — config + tracker + reports render on all
3. POST /api/auto-pipeline { mode:'manual' } → ≤ 2 s (regression gate from v1.25.0)
4. Tab key on dashboard → skip link visible → Enter → focus #content
```

Tag and ship.
