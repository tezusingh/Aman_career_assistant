# END-TO-END REGRESSION PROMPT — career-ops-ui @ v1.58.16

> **Date shipped:** 2026-05-20
> **Author:** post-cycle (after v1.58.4 → v1.58.16 fix-prompt sweep)
> **Run as:** senior QA / SRE — read-only against the live deploy; treat
> every assertion below as **must hold** at this version. The next agent
> picks `package.json::version` as `vX` and re-runs §1 to confirm a
> clean baseline before touching anything else.
>
> **Out of scope (do NOT edit):** the parent `career-ops` repo at `..`
> (cv.md, config/, modes/, data/, reports/, portals.yml). The web-ui
> repo's contract is read-mostly against the parent; never weaken
> CSP / SSRF / sanitizer envelopes; never bypass `isValidJobUrl`;
> never use `--no-verify` or `--force-push`.

---

## 0. What just shipped (v1.58.4 → v1.58.16, all single-fix releases)

13 one-fix releases, each CI-green + pre-commit AI-review LGTM, each
regression-locked by a `tests/*.test.mjs`:

| Release | Item | Class |
|---|---|---|
| **v1.58.4** ✅ | NEW-1 — `Content-Security-Policy` is now **unconditional** (was gated behind `isPubliclyExposed()`; over `127.0.0.1` `/` and `/api/health` had no CSP, leaving `UI.md()`'s escape-first contract as the sole XSS defence). | **stop-ship security** |
| **v1.58.5** ✅ | NEW-3 — `#/followup` Run-live double-POST triaged **not-reproducible**; locked with Playwright single-POST guard. | Minor (no code change) |
| **v1.58.6** ✅ | BUG-008-tb — top-bar `Doctor` modal title now uses `I18n.t('top.doctor', 'Doctor')` (was hardcoded English `'doctor'`). Closes BUG-008's second entry-point. | i18n / a11y |
| **v1.58.7** ✅ | NEW-2 — `isValidJobUrl` rejects paired template placeholders `${…}` / `{{…}}` so the rejection message ("contain no script or template characters") matches reality. Single-brace ATS paths preserved. | Security UX |
| **v1.58.8** ✅ | (user-requested feat) — `#/health` surfaces `OPENAI_API_KEY` / `QWEN_API_KEY` / `OPENROUTER_API_KEY` rows analogous to `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`. Same `isUsableKey` gate as `/api/status/providers`. | feat |
| **v1.58.9** ✅ | M-1 — global `:focus-visible` ring restored on form fields (WCAG 2.4.7 Level AA). Form-base `outline: none` was higher specificity than `*:focus-visible`. | a11y |
| **v1.58.10** ✅ | M-2 — `UI.modal()` auto-dismisses any in-flight progress toast as its first executable statement (defence-in-depth at the boundary). `#/cv` sync-check call site localized via `t('cv.syncCheck')` / `t('cv.syncCheckRunning')`. | UX |
| **v1.58.11** ✅ | M-4 — saved-research card title↔date gap is now structural CSS (`.saved-card` flex container + `gap: var(--space-2)` + semantic `<time datetime="…">`). | UX visual |
| **v1.58.12** ✅ | M-7 — cost hint now tracks OpenRouter (`EST.openrouter = null` ⇒ localized `cost varies (router picks)` instead of fabricated `~$0.03/eval`). | UX truthfulness |
| **v1.58.13** ✅ | M-8 — `#/apply` checklist is interactive: real `<input type="checkbox">` rows wrapped in `<label>`, state persisted per-URL in `localStorage['applyChecklist:'+slug]`, **Copy unchecked** + **Reset** buttons. | UX promise vs delivery |
| **v1.58.14** ✅ | M-9 — connection-banner `Refresh` emits a localized feedback toast (synchronous `Refreshing…` + sessionStorage bridge to success `Refreshed` on next boot). | UX |
| **v1.58.15** ✅ | I-1 — top-bar search `aria-label` + visually-hidden `<label>` localized via a new generic `data-i18n-aria-label` hook. | a11y / i18n |
| **v1.58.16** ✅ | (user-reported) — brand-button hover-flicker: `.btn-primary` / `.btn-danger` keep their gradient and dim via `filter: brightness(0.92)` instead of swapping to a solid (CSS can't interpolate gradient↔solid). | UX visual |

**Baseline at vX = 1.58.16:** **912 / 912** `node --test` · **61 / 61**
Playwright (smoke + full-cycle + forms) · **20 / 20** smoke E2E ·
**23 / 23** comprehensive E2E.

---

## 1. Pre-flight — must hold before you touch anything

```bash
vX=$(node -p "require('./package.json').version")
echo "vX = $vX"                                  # MUST: 1.58.16

# Parity (every artefact at vX):
grep -h "release-v$vX" README*.md | sort -u      # MUST: 1 unique line × 8 files
node scripts/check-changelog-parity.mjs          # MUST: ✓ all 8 locales at vX
node scripts/check-no-also-leftovers.mjs         # MUST: ✓

# Build-by-running:
npm ci && npm test                               # MUST: 912/912 pass (or higher; never lower)
npm run test:e2e                                 # MUST: passed: 20 · failed: 0
npm run test:e2e:full                            # MUST: 23/23 steps · 0 failed
npm run test:e2e:browser                         # MUST: 61/61 (Playwright smoke+full-cycle+forms)

# Working tree + remote:
git status --short                               # MUST: empty
git rev-parse --abbrev-ref HEAD                  # MUST: main
gh run list --limit 5 --json status,conclusion,name,headBranch --jq \
  '.[] | .name + " · " + .headBranch + " · " + .status + " · " + (.conclusion//"-")'
# MUST: CI / Release / Publish / AI Review all `completed success` for vX.

# Live deploy:
curl -sS http://127.0.0.1:4317/api/health | python3 -c \
  'import sys,json; j=json.load(sys.stdin); print(j["version"], j["ok"])'
# MUST: 1.58.16 True
```

If any of the above fails → stop. Re-establish the baseline before
running the rest of this regression.

---

## 2. Security envelope (must not regress)

| Invariant | Check | Must-hold |
|---|---|---|
| CSP is unconditional | `curl -sS -D - http://127.0.0.1:4317/ -o /dev/null | grep -i content-security-policy` | header present; contains `default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`; no `'unsafe-inline'` on `script-src`; no `'unsafe-eval'` anywhere |
| CSP on `/api/health` over loopback | `curl -sS -D - http://127.0.0.1:4317/api/health -o /dev/null | grep -i content-security` | same header — was the v1.58.3 MASTER §5 gap |
| baseline headers | same curl | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` |
| `isValidJobUrl` blocks template placeholders | `node -e "import('./server/lib/security.mjs').then(m=>['https://example.com/\${T}','https://example.com/{{T}}','https://example.com/<%T%>','https://example.com/job/{normal}'].forEach(u=>console.log(u, m.isValidJobUrl(u))))"` | first 3 → `false`; `{normal}` → `true` (legit ATS) |
| SSRF gate still alive | POST `/api/pipeline` with `http://localhost/x`, `http://127.0.0.1/y`, `file:///etc/passwd`, `javascript:alert(1)` | all 400 |
| `UI.md()` is still the XSS boundary | grep `public/js/api.js` for `escapeHtml` and `md()` interop | `cleanLlmMarkdown` is NOT an HTML sanitizer (v1.58.3 R-2 hardened it for scaffolding only) |

---

## 3. Provider-key surface (must reflect reality across 5 providers)

```bash
curl -sS http://127.0.0.1:4317/api/health | python3 -c "
import sys, json
j = json.load(sys.stdin)
keys = [c for c in j['checks'] if c['name'].endswith('_API_KEY')]
print(f'{len(keys)} provider rows ⇒ MUST be 5')
for c in keys:
    print(f'  {c[\"name\"]:22} ok={c[\"ok\"]} · {c[\"value\"]}')
"
```

**MUST hold:** five rows — `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `QWEN_API_KEY`, `OPENROUTER_API_KEY`. Each `unset`
row's value matches `/unset \(manual mode\)/`. All `required: false`.

`/api/status/providers` returns `{ activeProvider, activeModel,
keysConfigured[] }`; the cost-hint on `#/auto`, `#/deep`, `#/evaluate`,
`#/<mode>` MUST follow `activeProvider`:

| `activeProvider` | rendered |
|---|---|
| `anthropic` | `Estimated cost: Anthropic claude-sonnet-4-6 · ~$0.05/eval` |
| `gemini` | `Estimated cost: Gemini <model> · ~$0.01/eval` |
| `openai` | `Estimated cost: OpenAI <model> · ~$0.04/eval` |
| `qwen` | `Estimated cost: Qwen <model> · ~$0.01/eval` |
| `openrouter` | `Estimated cost: OpenRouter <model> · cost varies (router picks)` |
| *(no key)* | `No LLM key set — “⚡ Run live” copies a manual prompt (no API cost).` |

---

## 4. A11y / WCAG (must not regress)

| WCAG | Check | Must-hold |
|---|---|---|
| **2.4.7 Focus Visible (Level AA)** — v1.58.9 | Tab onto any `<input>` / `<textarea>` / `<select>` | `getComputedStyle(activeElement).outlineWidth >= 1.5px && outlineStyle !== 'none'` |
| 2.5.5 Target size (≥44 × 44 px) — v1.26.1 | every `.btn` | `min-height: 44px` (`.btn-sm` ≥ 32 px + 8 px row spacing = ≥ 44 px composite) |
| 2.5.5 full-row click target on apply checklist — v1.58.13 | `.apply-checklist label` | `min-height: 32px` + flex full-row |
| modal-title parity (BUG-008) | every `UI.modal(title, …)` site | title equals the localized button label that opened it — top-bar Doctor (v1.58.6) and cv.js sync-check (v1.58.10) verified |
| keyboard focus on managed-route `<h1 tabindex="-1">` | tab through SPA | NO red ring on the synthetic focus (WAI-ARIA APG; suppressed in css/app.css for `[tabindex="-1"]:focus`) |
| keyboard skip-link | Tab from `<body>` start | first focus on `Skip to content` link, then sidebar |

---

## 5. i18n parity (must hold for every release)

- `package.json::version == package-lock.json::version == every CHANGELOG*.md top entry == README ×8 release badge == CLAUDE.md "(currently vX)" == .claude/PROJECT-CONTEXT.md repo-state line`.
- `node scripts/check-changelog-parity.mjs` ⇒ `✓ all 8 locales at vX`.
- All keys referenced by v1.58.4 → v1.58.16 must exist in **all 8 locales** of `public/js/lib/i18n-dict.js`:
  - `cv.syncCheck`, `cv.syncCheckRunning` (v1.58.10)
  - `cost.varies` (v1.58.12)
  - `apply.checklist.copyUnchecked`, `apply.checklist.resetBtn`, `apply.checklist.copied`, `apply.checklist.copyFailed`, `apply.checklist.reset` (v1.58.13)
  - `common.refreshing`, `common.refreshed` (v1.58.14)
  - `top.search.label`, `top.search.aria` (v1.58.15)
  - `top.doctor` (BUG-008-tb, v1.58.6 — must remain non-empty everywhere)
- `tests/i18n-coverage.test.mjs` is the green-or-stop gate.

---

## 6. End-to-end Playwright walk (do these by hand if browser CI is suspect)

Walk every route in **en + ru + ja + zh-TW** (the CJK / non-Latin
spot-check); same key items every locale:

1. `#/dashboard` — hero CTA visible; ⌘K / Ctrl K kbd badge on the
   global search visible; locale-aware `document.title`.
2. `#/config` — 4-provider onboarding banner reflects key state; save
   profile field → 200; SPA-injected `lang` is stripped before the
   server validator (v1.57.2 invariant).
3. `#/scan` — Advanced filters disclosure (v1.55.6); RU portal sources
   listed; Stop button is unmistakable during a multi-minute scan.
4. `#/pipeline` — Add URL with `${T}` / `{{T}}` → 400 toast with the
   exact "contain no script or template characters" message;
   `{normal}` → accepted.
5. `#/evaluate` — paste a JD < 50 chars → action-threshold message;
   ≥ 50 chars → score + action; cost-hint matches active provider.
6. `#/auto` — paste a URL → SSE stepper (validate / fetch / evaluate /
   save / track); invalid URL → step 1 fails inline.
7. `#/deep` — Run live (if key) → research; **rendered brief must be
   clean** — no `<tool_call>` / `<tool_response>` / `<thinking>` /
   `<invoke>` / `antml:*` leakage; blockquote-bold rendered as bold;
   saved-research cards show `<time>` with a visible gap to the title
   (M-4); open older pre-clean file → cleaned on serve (v1.58.3 R-2).
8. `#/cv` — Upload (.md / .pdf / .docx) → preview + Save (dirty
   state); `sync-check` button → progress toast `cv-sync-check.mjs…`
   that **dismisses** when the result modal opens (M-2); modal title
   matches button label (BUG-008 invariant).
9. `#/apply` — Generate checklist → real `<input type=checkbox>` rows
   in a `<ul.apply-checklist>`; tick 3 of 8 → reload → 3 still ticked;
   **Copy unchecked** → clipboard contains markdown bullets matching
   the visible unchecked items; **Reset** clears state for this URL.
10. `#/tracker` — server-side pagination + funnel chips; pipe in a
    company name does not break the table (BF-1 regression-lock).
11. `#/health` — five `_API_KEY` rows (§3 above); Doctor / verify /
    sync-check buttons all show progress toast → result modal with the
    **localized** title; `Refresh` (top-bar connection banner) →
    `Refreshing…` toast → reload → `Refreshed` success toast.
12. `#/reports`, `#/activity`, `#/profile`, `#/help` — render; help
    TOC headings localized in every locale (I18N-011 closure
    re-verified — see §11 backlog).
13. **Hover any `.btn-primary` / `.btn-danger`** — no flicker. The
    button smoothly dims via `filter: brightness(0.92)`. Move the
    cursor on/off rapidly — no flash (v1.58.16).
14. **Tab through any form field** — visible 2 px solid `var(--rausch)`
    ring with offset; not invisible on any of the 88 form fields per
    page (v1.58.9 M-1).
15. **Screen reader** (VoiceOver / NVDA) on `#/dashboard` → top-bar
    search announces a **localized** label (`Поиск компаний…` on RU,
    `グローバル検索…` on JA, etc.). v1.58.15 I-1.
16. Toggle theme (☀ / 🌙) — CSP still present; brand-button gradient
    keeps in dark theme too; focus ring contrast holds (WCAG 1.4.3
    light **and** dark).
17. Language switcher (8 locales) — every route's `<html lang>` flips
    to the chosen code (v1.58.3 FIX-C2 contract — `i18n.js` sets
    `document.documentElement.lang` on setLang + boot; lock at
    `tests/qa-report-fixes.test.mjs`).

For each numbered step: any console error, any visibly broken state,
any string still in English on a non-EN locale → file a new finding
with route + screenshot + computed-style + locale + browser.

---

## 7. Regression matrix — every fix from v1.58.4 → v1.58.16 must still work

| Release | Re-verify recipe |
|---|---|
| v1.58.4 | `curl -sS -D - http://127.0.0.1:4317/api/health -o /dev/null \| grep -i content-security-policy` ⇒ header present |
| v1.58.5 | `#/followup`, fill company/role/notes, leave date empty, click ▶ once → count POSTs to `/api/mode/followup` in DevTools Network → **exactly 1** |
| v1.58.6 | EN/RU/JA top-bar Doctor → modal title == localized button label |
| v1.58.7 | POST `/api/pipeline {"url":"https://example.com/${T}"}` ⇒ 400 with humanized message |
| v1.58.8 | `/api/health.checks[]` includes 5 `_API_KEY` rows |
| v1.58.9 | Tab onto a `#/config` input → `getComputedStyle(activeElement).outline*` ≠ `none / 0px` |
| v1.58.10 | `#/cv` sync-check → during the request, watch the toast → on modal open, toast disappears |
| v1.58.11 | `#/deep` Saved research → each card shows title and date with visible space + `<time datetime=…>` |
| v1.58.12 | Set `LLM_PROVIDER=openrouter` in `.env`, reload → cost hint says `cost varies (router picks)` in current locale |
| v1.58.13 | `#/apply`, generate, tick 3 of 8, reload, **3 still ticked**; Copy unchecked → clipboard non-empty; Reset → all unticked |
| v1.58.14 | Click top-bar `Refresh` → `Refreshing…` toast → page reload → `Refreshed` success toast on the new page |
| v1.58.15 | DevTools: `document.querySelector('#global-search').getAttribute('aria-label')` ≠ English on a non-EN locale |
| v1.58.16 | Hover `.btn-primary` rapidly → no flicker; in DevTools, the computed `background-image` (gradient) is unchanged on hover, `filter` interpolates `brightness(1) ↔ brightness(0.92)` |

---

## 8. Release-doctrine self-check (still in force)

- **One fix = one release.** Never batch. HIGH → MEDIUM → LOW.
- **Every release ships:** version bump + CHANGELOG ×8 (parity-gated)
  + README ×8 badges + a test (unit or Playwright) + pre-commit AI-review
  LGTM + `ci.yml` green + Playwright-verify (where applicable) +
  redeploy + monitor CI/Release/Publish to `success`.
- **Never `--no-verify`, `--force-push`, `git reset --hard`** without
  explicit user approval.
- **Live smoke = GET only.** Write-side endpoints on the deployed
  server write the real parent `.env`/files; never POST during a smoke.
- **Parent-project read-only contract** — never edit anything under `..`.
- **The `ci.yml` workflow is the hard gate; pre-commit AI review is
  advisory.** A green pre-commit + red CI is possible (v1.58.0 lesson).
- **A `cancelled` CI is benign concurrency only if a newer commit's CI
  is green**; a `failure` is stop-ship.

---

## 9. Remaining backlog (post-v1.58.16, in §1-table order)

`qa/v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md` §1 still has:

- **v1.58.17 — I-2** Intl.RelativeTimeFormat for `today` / `yesterday`
  / `N days ago` (saved-research / activity / tracker / pipeline).
- **v1.58.18 — I-3** Help TOC items 2 / 5 / 13 / 14 localized.
- **v1.58.19 — I-4** RU `#/followup` H1 & subtitle (no Latin
  `cadence` / `follow-up`).
- **v1.58.20 — I-6** footer hotkey `⌘K` vs `Ctrl+K` per platform.
- **v1.58.21…v1.58.35 — U-1…U-15** UX-polish series (cv H1 + subtitle,
  auto H1 emoji-wrap, followup date placeholder, pipeline-400 detail,
  dashboard CTA dedupe, scan "Active companies N/M" tooltip, …).

Cross-repo / out-of-scope for this repo (do **not** implement here):

- **C-1** prompt-layer drift in parent `modes/deep.md`.
- **G-005** parent `modes/oferta.md` A-G → A-F (cross-repo, deferred
  since v1.27).
- **CLI-locale** — `career-ops doctor` / `verify-pipeline.mjs` /
  `cv-sync-check.mjs` stdout localization (server diagnostics
  English-by-policy; only the modal **chrome** localizes).
- Stale `portals.yml` entries — parent-owned.

---

## 10. Sign-off

A run of this prompt is a sign-off if and only if every section §1 →
§7 holds, the test baseline matches §0, and there are zero new
findings outside the backlog in §9. Otherwise: write the findings as
`qa/v158-regression/<YYYY-MM-DD>-FOLLOWUP.md` with route + screenshot
+ computed style + locale + browser per finding, and file the
single-fix prompt for the next release.

---

🤖 Generated as the v1.58.4 → v1.58.16 end-to-end regression prompt at
the close of the 13-release cycle. Linked artefacts:
[CHANGELOG.md](../CHANGELOG.md) · [docs/ROADMAP.md](../docs/ROADMAP.md) ·
[qa/v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md](v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md) ·
[.claude/PROJECT-CONTEXT.md](../.claude/PROJECT-CONTEXT.md).
