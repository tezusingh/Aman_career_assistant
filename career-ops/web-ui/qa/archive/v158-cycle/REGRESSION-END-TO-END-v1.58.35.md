# END-TO-END REGRESSION PROMPT — career-ops-ui @ v1.58.35

> **Date shipped:** 2026-05-20
> **Author:** post-cycle (after v1.58.4 → v1.58.35 — 32 releases over the v1.58.x window)
> **Run as:** senior QA / SRE — read-only against the live deploy; treat every
> assertion below as **must hold** at this version.
>
> **Out of scope (do NOT edit):** the parent `career-ops` repo at `..`
> (cv.md, config/, modes/, data/, reports/, portals.yml). Never weaken CSP /
> SSRF / sanitizer envelopes; never bypass `isValidJobUrl`; never use
> `--no-verify` or `--force-push`.

---

## 0. What's shipped (v1.58.4 → v1.58.35 — 32 single-fix releases)

All releases CI-green + pre-commit AI-review LGTM, each regression-locked.
See [REGRESSION-END-TO-END-v1.58.33.md](REGRESSION-END-TO-END-v1.58.33.md) for the
first 30 (v1.58.4 → v1.58.33). New since v1.58.33:

| Release | Item | Class |
|---|---|---|
| v1.58.34 ✅ | (U-13 follow-up) Notifications drawer chrome on top of the v1.58.33 toast-journal capture: bell 🔔 + red unread badge in top-bar, right-slide `<aside role="dialog">` listing entries newest-first with localized timestamp + message + technical postfix from U-4. `UI.onToast(fn)` pub/sub layered on the v1.58.33 capture. 4 new i18n keys (`notif.title`, `notif.empty`, `notif.bellAria`, `notif.closeAria`) × 8 locales. | feat / UX |
| v1.58.35 ✅ | (user-reported) — drawer auto-open bug fix + new help **§18 Notifications** in all 8 locales. (1) `.notif-drawer { display: flex }` shadowed UA `[hidden] { display: none }` → drawer was visible on every page load and × did nothing. Fix: explicit `.notif-drawer[hidden] { display: none }` + `.notif-badge[hidden] { display: none }` overrides. Static guard asserts exactly one `open()` call site in `app.js` (the bell click ternary) — no auto-open path can be added by accident. (2) New §18 in `docs/help/{en,es,ja,ko-KR,pt-BR,ru,zh-CN,zh-TW}.md` documents 3 categories (Success / Error / Info-progress), what's NOT a notification (modals, SSE log lines, spinner-only), keyboard contract. H2 baseline 17 → 18; H3 baseline 70 → 73. | UX bug + docs |

**Baseline at vX = 1.58.35:** **928 / 928** `node --test` · **62 / 62**
Playwright (smoke + full-cycle + forms — includes the new drawer end-to-end
test) · **20 / 20** smoke E2E · **23 / 23** comprehensive E2E.

---

## 1. Pre-flight — must hold before you touch anything

```bash
vX=$(node -p "require('./package.json').version")
echo "vX = $vX"                                  # MUST: 1.58.35

# Parity (every artefact at vX):
grep -h "release-v$vX" README*.md | sort -u      # MUST: 1 unique line × 8 files
node scripts/check-changelog-parity.mjs          # MUST: ✓ all 8 locales at vX
node scripts/check-no-also-leftovers.mjs         # MUST: ✓

# Build-by-running:
npm ci && npm test                               # MUST: 928/928 pass
npm run test:e2e                                 # MUST: passed: 20 · failed: 0
npm run test:e2e:full                            # MUST: 23/23 steps · 0 failed
npm run test:e2e:browser                         # MUST: 62/62 Playwright

# Working tree + remote:
git status --short                               # MUST: empty
git rev-parse --abbrev-ref HEAD                  # MUST: main
gh run list --limit 5 --json status,conclusion,name --jq \
  '.[] | .name + " · " + .status + " · " + (.conclusion//"-")'
# MUST: CI / Release / Publish / AI Review all `completed success` for vX.

# Live deploy:
curl -sS http://127.0.0.1:4317/api/health | python3 -c \
  'import sys,json; j=json.load(sys.stdin); print(j["version"], j["ok"])'
# MUST: 1.58.35 True
```

If any of the above fails → stop. Re-establish the baseline before running §2-§9.

---

## 2. Security envelope (must not regress)

Same as v1.58.33 sign-off (unchanged in v1.58.34 / v1.58.35): CSP unconditional,
SSRF guard alive, `isValidJobUrl` rejects template placeholders, `UI.md()` is the
escape-first XSS boundary. Inherit verbatim from `REGRESSION-END-TO-END-v1.58.33.md` §2.

---

## 3. Provider-key surface — unchanged from v1.58.33 §3

Five `_API_KEY` rows on `/api/health`. OpenRouter → localized `cost varies`.

---

## 4. A11y / WCAG — unchanged from v1.58.33 §4 + new drawer contract

| WCAG | New at v1.58.34 / v1.58.35 |
|---|---|
| 4.1.2 Name, Role, Value | bell button declares `aria-haspopup="dialog"` + `aria-controls="notif-drawer"`; `aria-expanded` toggles `true ↔ false` on open/close |
| 2.1.1 Keyboard | bell activates with Enter / Space; Esc closes the drawer; focus returns to the bell on close |
| 2.4.7 Focus Visible | `.notif-bell:focus-visible` + `.notif-drawer__close:focus-visible` paint the brand ring |
| 1.3.1 Info & Relationships | drawer is `<aside role="dialog" aria-labelledby="notif-title">`; entries use `<time datetime=ISO>` + `<p class="notif-item__msg">` |

---

## 5. i18n parity at v1.58.35

All keys from v1.58.33 §5 still required, plus:

- **v1.58.34** — `notif.title`, `notif.empty`, `notif.bellAria`, `notif.closeAria`
- **v1.58.35** — new **§18 Notifications** section in all 8 help bundles (3 H3
  subsections per bundle). H2 parity lock: **18** (was 17). H3 parity lock:
  **73** (was 70).

---

## 6. End-to-end Playwright walk — incl. the new drawer test

Walk every route in **en + ru + ja + zh-TW** (same as v1.58.33), then:

**Drawer (new at v1.58.35 — `tests/playwright-smoke.mjs::notifications drawer is hidden at boot, opens only via bell, …`):**

1. On `#/dashboard` load → drawer must be `getComputedStyle(d).display === 'none'`. **Must NOT be visible at boot.** This is the user-reported v1.58.34 bug fixed in v1.58.35.
2. `aria-expanded` on the bell must be `'false'` at boot.
3. Click bell → drawer becomes visible; `aria-expanded` flips to `'true'`.
4. With empty journal, the `.notif-drawer__empty` paragraph must show.
5. Click `×` (or Esc, or click the bell again) → drawer hides.
6. Fire a toast via `window.UI.toast('test', 'success')` with drawer closed → `#notif-badge` becomes visible with text `"1"`.
7. Open the drawer → at least one `.notif-item` is listed; badge re-hides (unread cleared).
8. The entry's `.notif-item__msg` text must match the fired toast.

**Help §18 (new at v1.58.35):**
- `#/help` shows H2 `Notifications` (or localized equivalent) in every locale; the TOC contains it; the 3 H3 subsections are present (Notification categories / What is NOT a notification / Keyboard) — all localized.

---

## 7. Regression matrix

`npm test` must report `928/928 pass`. The static-guard suite in
`tests/qa-report-fixes.test.mjs` covers every release from v1.58.4
through v1.58.35. The Playwright contract in `tests/playwright-smoke.mjs`
ships the new drawer end-to-end test as test #20 in that file.

---

## 8. Release-doctrine self-check (still in force)

- **One fix = one release.** Lone exception: v1.58.33 batched U-13/14/15 (three
  small CSS/JS items closing the cycle). v1.58.34 / v1.58.35 followed the
  one-fix-per-release pattern.
- **Lesson from v1.58.34 → v1.58.35:** never trust `[hidden]` alone if the
  element has an explicit `display:` rule. The browser cascade puts author CSS
  above UA, so `[hidden]` is a no-op against author `display`. Always pair an
  explicit `display: none` for the `[hidden]` state, or use a class toggle.
- **Lesson from v1.58.27 / v1.58.30:** `npm test 2>&1 | grep …` masks the test
  process exit code (grep returns 0 on a match even if npm test exited non-zero).
  Future scripts should split the check: run `npm test` first, capture `$?`,
  then grep separately.
- **`ci.yml` is the hard gate; pre-commit AI review is advisory.**

---

## 9. Remaining backlog

The v1.58.x FIX-PROMPT §1 is **fully drained.**

Cross-repo / parent-owned (deferred indefinitely from this repo):

- C-1 prompt-layer drift in `modes/deep.md`
- G-005 `modes/oferta.md` A-G → A-F (deferred since v1.27)
- CLI-locale (server diagnostics English-by-policy)
- Stale `portals.yml` entries

In-repo deferrals — none. The toast drawer was the last deferred item and
shipped in v1.58.34 / v1.58.35.

**P-11 → P-16** (planning) — see `docs/ROADMAP.md` Current milestone.

---

## 10. Sign-off

A run of this prompt is a sign-off if and only if every section §1 → §7 holds,
the test baseline matches §0, and there are zero new findings outside the
backlog in §9. Otherwise: write the findings as
`qa/v158-regression/<YYYY-MM-DD>-FOLLOWUP.md` and file the single-fix prompt for
the next release.

---

🤖 Generated as the v1.58.4 → v1.58.35 end-to-end regression prompt at the close
of the 32-release cycle. Linked artefacts:
[CHANGELOG.md](../CHANGELOG.md) · [docs/ROADMAP.md](../docs/ROADMAP.md) ·
[qa/v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md](v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md) ·
[qa/REGRESSION-END-TO-END-v1.58.16.md](REGRESSION-END-TO-END-v1.58.16.md) (interim) ·
[qa/REGRESSION-END-TO-END-v1.58.33.md](REGRESSION-END-TO-END-v1.58.33.md) (interim) ·
[.claude/PROJECT-CONTEXT.md](../.claude/PROJECT-CONTEXT.md).
