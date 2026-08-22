# END-TO-END REGRESSION PROMPT — career-ops-ui @ v1.58.33

> **Date shipped:** 2026-05-20
> **Author:** post-cycle (after v1.58.4 → v1.58.33 fix-prompt sweep — 30 releases)
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

## 0. What just shipped (v1.58.4 → v1.58.33, 30 single-fix releases)

All releases CI-green + pre-commit AI-review LGTM, each regression-locked:

| Release | Item | Class |
|---|---|---|
| v1.58.4 ✅ | NEW-1 — CSP unconditional on every response (was gated by `isPubliclyExposed()`) | **stop-ship security** |
| v1.58.5 ✅ | NEW-3 — `#/followup` double-POST triaged not-reproducible; Playwright guard | Minor |
| v1.58.6 ✅ | BUG-008-tb — top-bar Doctor modal title via `I18n.t('top.doctor', …)` | i18n |
| v1.58.7 ✅ | NEW-2 — `isValidJobUrl` rejects paired `${…}`/`{{…}}` template placeholders | Security UX |
| v1.58.8 ✅ | (user feat) — OPENAI/QWEN/OPENROUTER rows on `#/health` | feat |
| v1.58.9 ✅ | M-1 — `:focus-visible` ring on form fields (WCAG 2.4.7 Level AA) | a11y |
| v1.58.10 ✅ | M-2 — `UI.modal()` auto-drains progress toast; cv.js sync-check localized | UX |
| v1.58.11 ✅ | M-4 — saved-research card title↔date gap via `.saved-card` flex+gap | UX |
| v1.58.12 ✅ | M-7 — cost hint tracks OpenRouter (`null` → localized `cost varies`) | UX |
| v1.58.13 ✅ | M-8 — interactive Apply checklist with per-URL persistence | UX |
| v1.58.14 ✅ | M-9 — Refresh button feedback toast via sessionStorage bridge | UX |
| v1.58.15 ✅ | I-1 — top-bar search aria-label localized via `data-i18n-aria-label` hook | a11y/i18n |
| v1.58.16 ✅ | (user-reported) — brand-button hover-flicker → `filter: brightness()` | UX |
| v1.58.17 ✅ | I-2 — saved-research dates via `Intl.RelativeTimeFormat` per locale | i18n |
| v1.58.18 ✅ | I-3 — help TOC items 2/5/13/14 free of English bleed in non-Latin locales | i18n |
| v1.58.19 ✅ | I-4 — RU `#/followup` H1+hints purged of `cadence`/`follow-up` Latin leakage | i18n |
| v1.58.20 ✅ | I-6 — footer hotkey hint adapts ⌘K (Mac) vs Ctrl+K (else) with localized verb | i18n/platform |
| v1.58.21 ✅ | U-1 — `#/cv` H1 + subtitle restored (supersedes v1.56.0 UX-9 chip by-design) | UX |
| v1.58.22 ✅ | U-2 — `#/auto` H1 separates ✨ via `.page-header--icon` grid + `.page-icon` span | UX visual |
| v1.58.23 ✅ | U-3 — `#/followup` `lastContact` placeholder = today − 14 days (dynamic) | UX |
| v1.58.24 ✅ | U-4 — toast postfix `(METHOD /path · HTTP NNN)` tucked into collapsed `<details>` | UX |
| v1.58.25 ✅ | U-5 — Dashboard CTA dedupe (removed Open-Pipeline header btn + Scan-all-sources tile) | UX IA |
| v1.58.26 ✅ | U-6 — `#/scan` Active-companies chip exposes localized tooltip + aria-label | UX |
| v1.58.27 ✅ | U-7 — verify-pipeline modal strips `==========` ASCII dividers | UX visual |
| v1.58.28 ✅ | U-8 — Generate-prompt block collapsed by default on 7 mode pages | UX |
| v1.58.29 ✅ | U-9 — `#/pipeline` counter↔filter row stacks at ≤720 px via `.pipeline-controls` | UX responsive |
| v1.58.30 ✅ | U-10 — Tracker Normalize/Dedup/Merge disabled when applications.md empty | UX |
| v1.58.31 ✅ | U-11 — Tracker Legitimacy header info chip with localized tooltip | UX a11y |
| v1.58.32 ✅ | U-12 — Help TOC filter input min-width: 16ch for KO/JA placeholders | UX i18n |
| v1.58.33 ✅ | U-13 + U-14 + U-15 — toast journal (cap 50 + `UI.getToastHistory()`) + page-header spacing safety net + CV dirty-state | UX |

**Baseline at vX = 1.58.33:** **926 / 926** `node --test` · **61 / 61**
Playwright (smoke + full-cycle + forms) · **20 / 20** smoke E2E ·
**23 / 23** comprehensive E2E.

---

## 1. Pre-flight — must hold before you touch anything

```bash
vX=$(node -p "require('./package.json').version")
echo "vX = $vX"                                  # MUST: 1.58.33

# Parity (every artefact at vX):
grep -h "release-v$vX" README*.md | sort -u      # MUST: 1 unique line × 8 files
node scripts/check-changelog-parity.mjs          # MUST: ✓ all 8 locales at vX
node scripts/check-no-also-leftovers.mjs         # MUST: ✓

# Build-by-running:
npm ci && npm test                               # MUST: 926/926 pass (or higher; never lower)
npm run test:e2e                                 # MUST: passed: 20 · failed: 0
npm run test:e2e:full                            # MUST: 23/23 steps · 0 failed
npm run test:e2e:browser                         # MUST: 61/61 (Playwright)

# Working tree + remote:
git status --short                               # MUST: empty
git rev-parse --abbrev-ref HEAD                  # MUST: main
gh run list --limit 5 --json status,conclusion,name,headBranch --jq \
  '.[] | .name + " · " + .headBranch + " · " + .status + " · " + (.conclusion//"-")'
# MUST: CI / Release / Publish / AI Review all `completed success` for vX.

# Live deploy:
curl -sS http://127.0.0.1:4317/api/health | python3 -c \
  'import sys,json; j=json.load(sys.stdin); print(j["version"], j["ok"])'
# MUST: 1.58.33 True
```

If any of the above fails → stop. Re-establish the baseline before
running the rest of this regression.

---

## 2. Security envelope (must not regress)

| Invariant | Check | Must-hold |
|---|---|---|
| CSP is unconditional | `curl -sS -D - http://127.0.0.1:4317/ -o /dev/null \| grep -i content-security-policy` | header present; `default-src 'self'`, `script-src 'self'` (no `'unsafe-inline'`/`'unsafe-eval'`), `frame-ancestors 'none'` |
| CSP on `/api/health` over loopback | same curl on `/api/health` | header present (v1.58.4 invariant) |
| baseline headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` |
| `isValidJobUrl` blocks template placeholders | `node -e "import('./server/lib/security.mjs').then(m=>['https://example.com/\${T}','https://example.com/{{T}}','https://example.com/<%T%>','https://example.com/job/{normal}'].forEach(u=>console.log(u, m.isValidJobUrl(u))))"` | first 3 → `false`; `{normal}` → `true` |
| SSRF gate | POST `/api/pipeline` with `http://localhost/x`, `http://127.0.0.1/y`, `file:///etc/passwd`, `javascript:alert(1)` | all 400 |
| `UI.md()` XSS boundary | grep `public/js/api.js` for `escapeHtml` and `md()` interop | `cleanLlmMarkdown` is NOT an HTML sanitizer |

---

## 3. Provider-key surface (5 rows)

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

MUST: five rows — `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`QWEN_API_KEY`, `OPENROUTER_API_KEY`. Cost-hint follows `activeProvider`;
OpenRouter → localized `cost varies (router picks)`.

---

## 4. A11y / WCAG (must not regress)

| WCAG | Check |
|---|---|
| 2.4.7 Focus Visible (Level AA) — v1.58.9 | every `<input>` / `<textarea>` / `<select>` gets the brand ring on `:focus-visible` |
| 2.5.5 Target size (≥44 × 44 px) — v1.26.1 | every `.btn` `min-height: 44px` |
| 2.5.5 full-row click — v1.58.13 | `.apply-checklist label` is the full row |
| modal-title parity (BUG-008/008-tb) — v1.58.6 | top-bar Doctor + cv.js sync-check modal titles match the button labels |
| keyboard-reachable info chip — v1.58.31 | Tab onto `.th-info` in Tracker → focus ring; activates tooltip |
| **NEW** dirty-state Save — v1.58.33 | edit CV → Save button gets `.btn-dirty` + localized `cv.unsaved` tooltip |

---

## 5. i18n parity (must hold for every release)

- `package.json::version == package-lock.json == every CHANGELOG*.md top entry == README ×8 release badge == CLAUDE.md "(currently vX)" == .claude/PROJECT-CONTEXT.md` — all at vX.
- `node scripts/check-changelog-parity.mjs` ⇒ `✓ all 8 locales at vX`.
- **All keys referenced by v1.58.4 → v1.58.33** must exist in **all 8 locales** of `public/js/lib/i18n-dict.js`:
  - v1.58.10 — `cv.syncCheck`, `cv.syncCheckRunning`
  - v1.58.12 — `cost.varies`
  - v1.58.13 — `apply.checklist.copyUnchecked`, `apply.checklist.resetBtn`, `apply.checklist.copied`, `apply.checklist.copyFailed`, `apply.checklist.reset`
  - v1.58.14 — `common.refreshing`, `common.refreshed`
  - v1.58.15 — `top.search.label`, `top.search.aria`
  - v1.58.20 — `top.langhint` (with `{hotkey}` placeholder)
  - v1.58.24 — `toast.details`
  - v1.58.26 — `scan.activeCo.help`
  - v1.58.28 — `prompt.show`, `prompt.lines`
  - v1.58.30 — `track.fixEmpty`
  - v1.58.31 — `track.col.legitimacy.help`
  - v1.58.33 — `cv.unsaved`
- `tests/i18n-coverage.test.mjs` is the green-or-stop gate.

---

## 6. End-to-end Playwright walk (do these by hand if browser CI is suspect)

Walk every route in **en + ru + ja + zh-TW**:

1. `#/dashboard` — hero CTAs (`✨ Auto-pipeline` + `🌐 Scan now`); kbd badge visible; locale-aware `document.title`. **No** `Open Pipeline` header button (v1.58.25); **no** Scan-all-sources tile (v1.58.25).
2. `#/config` — 4-provider banner reflects key state; SPA-injected `lang` stripped before validator (v1.57.2).
3. `#/scan` — Advanced filters disclosure; **Active companies N/M** chip exposes localized tooltip + aria-label (v1.58.26); chip is keyboard-reachable.
4. `#/pipeline` — Add URL with `${T}` / `{{T}}` → 400 toast (humanized headline; technical `(POST /api/pipeline · HTTP 400)` postfix in `<details>` per v1.58.24); counter↔filter stacks at ≤720 px (v1.58.29).
5. `#/evaluate` — paste a JD; cost hint matches active provider; OpenRouter → `cost varies` (v1.58.12).
6. `#/auto` — H1 + ✨ on separate grid cells (v1.58.22); at 1280 px the H1 is single-line; paste URL → SSE stepper.
7. `#/deep` — Run live; saved-research cards show `<time>` with structural gap (v1.58.11) and **localized relative time** (`today` / `yesterday` / `N days ago` in active locale per v1.58.17). Generate prompt → **collapsed `<details class="prompt-block">`** with `Show prompt (N lines)` summary (v1.58.28).
8. `#/cv` — H1 + subtitle in standard `.page-title`/`.page-subtitle` style (v1.58.21, no chip). Edit textarea → Save button gets `.btn-dirty` + `Unsaved changes` tooltip (v1.58.33). Click Save → button reverts to clean. Upload .md → also flips dirty (synthetic input dispatch).
9. `#/followup` — H1 `Советник по ритму касаний` on RU (v1.58.19, no Latin `cadence`/`follow-up`). `lastContact` placeholder = today − 14 d (v1.58.23). Footer kbd hint shows `⌘K — поиск` on Mac, `Ctrl+K — поиск` elsewhere (v1.58.20).
10. `#/apply` — generate checklist → interactive `<input type=checkbox>` rows; tick 3/8 → reload → 3 still ticked; Copy unchecked + Reset (v1.58.13).
11. `#/tracker` — Normalize/Dedup/Merge **disabled** with localized tooltip when `data/applications.md` empty (v1.58.30); Legitimacy column header has ⓘ chip with tooltip (v1.58.31).
12. `#/health` — 5 `_API_KEY` rows (v1.58.8); top-bar Doctor → modal title matches button (v1.58.6); verify modal body has **no `==========`** runs (v1.58.27); top-bar Refresh → `Refreshing…` toast → reload → `Refreshed` success toast (v1.58.14).
13. `#/help` — Filter input min-width ≥ 16ch; KO `섹션 필터` / JA `セクションをフィルター` don't clip (v1.58.32). TOC items 2/5/13/14 fully localized — no English bleed (v1.58.18).
14. **Hover any `.btn-primary` / `.btn-danger`** — no flicker (v1.58.16); smooth `filter: brightness(0.92)` dim.
15. **Tab through any form field** — visible 2 px solid `var(--rausch)` ring (v1.58.9).
16. **Screen reader** on `#/dashboard` — top-bar search announces localized label (v1.58.15).
17. **Toast journal** — `UI.getToastHistory()` in DevTools after firing 3 toasts returns 3 entries with `{ ts, type, message, detail }` (v1.58.33).

---

## 7. Regression matrix — every fix from v1.58.4 → v1.58.33 must still work

See §0 table for the per-release re-verify hooks. Each release's
static-guard test lives in `tests/qa-report-fixes.test.mjs` (plus
locale and a11y suites). `npm test` must report `926/926 pass`.

---

## 8. Release-doctrine self-check (still in force)

- **One fix = one release.** Never batch (U-13/14/15 in v1.58.33 is the lone exception — three tiny CSS/JS items closing the cycle).
- **Every release ships:** version bump + CHANGELOG ×8 (parity-gated) + README ×8 badges + a test + pre-commit AI-review LGTM + `ci.yml` green + Playwright-verify (where applicable) + redeploy.
- **Never `--no-verify`, `--force-push`, `git reset --hard`** without explicit user approval.
- **Live smoke = GET only.** Write-side endpoints on the deployed server write the real parent `.env`/files; never POST during a smoke.
- **Parent-project read-only contract** — never edit anything under `..`.
- **`ci.yml` is the hard gate; pre-commit AI review is advisory.** A green pre-commit + red CI is possible (v1.58.0 lesson). v1.58.27 / v1.58.30 are case studies in that gap (silent test failure shipped because `npm test … | grep …` masked exit code; immediately repaired in the next release).

---

## 9. Remaining backlog (post-v1.58.33)

The v1.58.x FIX-PROMPT §1 is **fully drained**. Items deferred to a future cycle:

- **Toast drawer UI** — v1.58.33 ships the capture API (`UI.getToastHistory()`) but not the right-slide drawer + bell badge chrome. Drawer can be built on top of the existing data shape; non-blocking.
- **Cross-repo (parent-owned):**
  - C-1 prompt-layer drift in `modes/deep.md`
  - G-005 `modes/oferta.md` A-G → A-F (deferred since v1.27)
  - CLI-locale (server diagnostics English-by-policy)
  - Stale `portals.yml` entries
- **P-11 → P-16** (planning) — see `docs/ROADMAP.md` Current milestone.

---

## 10. Sign-off

A run of this prompt is a sign-off if and only if every section §1 → §7
holds, the test baseline matches §0, and there are zero new findings
outside the backlog in §9. Otherwise: write the findings as
`qa/v158-regression/<YYYY-MM-DD>-FOLLOWUP.md` and file the single-fix
prompt for the next release.

---

🤖 Generated as the v1.58.4 → v1.58.33 end-to-end regression prompt at
the close of the 30-release cycle. Linked artefacts:
[CHANGELOG.md](../CHANGELOG.md) · [docs/ROADMAP.md](../docs/ROADMAP.md) ·
[qa/v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md](v158-regression/FIX-PROMPT-v1.58.4_and_beyond.md) ·
[qa/REGRESSION-END-TO-END-v1.58.16.md](REGRESSION-END-TO-END-v1.58.16.md) (interim) ·
[.claude/PROJECT-CONTEXT.md](../.claude/PROJECT-CONTEXT.md).
