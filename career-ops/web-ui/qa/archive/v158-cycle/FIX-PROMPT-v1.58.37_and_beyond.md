# FIX-PROMPT — career-ops-ui · post-v1.58.36 (v1.58.37…)

Final hand-off prompt distilled from the 2026-05-19 deep button-result regression on **v1.58.36** (see `2026-05-19-REGRESSION-FINAL.md`).
Audience: implementer (Claude Code or human dev).

**Doctrine — repeated for clarity:**
> **ONE one-fix ship per release** — bump + CHANGELOG×8 (parity-gated) + a test + Playwright-verify + pre-commit AI-review to LGTM + CI-watch to green. **Never batch. Never `--no-verify`. HIGH → MEDIUM → LOW.** Pre-commit AI review is **advisory**; **`ci.yml` is the hard gate**.

---

## §0 — Hard rules / invariants (must hold every release)

1. **No batching.** Each numbered fix below = its own release, `vX.Y.Z` increments by 1.
2. **Parity at every release:** `package.json::version` ≡ `package-lock.json` ≡ `/api/health.version` ≡ every `CHANGELOG*.md` top entry ≡ README ×8 `release-vX` badge ≡ README ×8 `tests-N` badge ≡ `CLAUDE.md "currently vX"` ≡ `.claude/PROJECT-CONTEXT.md`.
3. **CI gates** — `npm test`, `npm run test:e2e`, `npm run test:e2e:full`, `npm run test:e2e:browser`, `scripts/check-no-also-leftovers.mjs`, `scripts/check-changelog-parity.mjs`, `ci.yml` must finish `success` on Node 18 / 20 / 22 before tagging.
4. **8-locale parity** — every user-visible string change ships keys for `en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`. `tests/i18n-coverage.test.mjs` is the gate.
5. **No parent-project writes from a read path.** Only explicit user POST/PUT/DELETE writes to `data/`, `reports/`, `config/`, `cv.md`, `modes/`. Read-only endpoints stay pure.
6. **Security invariants** (already enforced; do NOT weaken):
   - `isValidJobUrl` rejects loopback / `javascript:` / `file:` / script-char / template-char (`${T}` / `{{T}}` / `<%T%>`) URLs.
   - `safeGet` enforces SSRF guards on every URL-fetch path.
   - `UI.md()` is the XSS boundary (escape-first); `stripDangerousMarkdown` is the CV ingress; `cleanLlmMarkdown` is a declutter step, NOT a sanitizer.
   - `validateConfig` never echoes a `SECRET_KEYS` value.
   - CSP unconditional with `frame-ancestors 'none'`, no `'unsafe-eval'`, no `'unsafe-inline'` for `script-src`.
7. **`PATHS` resolves once per process.** Path-coupled helpers stay statically guarded.
8. **Doc-comment SemVer** — every commit subject: `fix(<area>): <one-line> (<TICKET-ID>)`.
9. **Pre-commit AI review is advisory** but its LGTM is required before push. `ci.yml` is the hard gate.

---

## §1 — Release sequence (one fix per release; HIGH → MEDIUM → LOW)

| Release | Fix | Severity | Class |
|---|---|---|---|
| **v1.58.37** | NEW-D1 — `pip.title` localized on es / pt-BR / ru | Minor | i18n parity |
| **v1.58.38** | NEW-D3 — `aria-label` on `#/tracker` search input × 8 locales | Minor | a11y |
| **v1.58.39** | NEW-D2 — Dashboard top-bar `Refresh` feedback toast | Minor | UX |
| **v1.58.40** | Test-fixture cleanup: `make clean-test-fixtures` target (or equivalent script) | Trivial | tooling |
| **v1.58.41+** | (Spec-policy clarification) — server `Accept-Language` for `/api/pipeline` 400 body if spec changes the by-design rule | Backlog | docs |

---

## §2 — Per-fix detailed spec

### FIX v1.58.37 · NEW-D1 — `#/pipeline` H1 latinization on 3 locales (Minor / i18n parity)

**WHERE.** `i18n/es/pip.json`, `i18n/pt-BR/pip.json`, `i18n/ru/pip.json` (or the consolidated locale file — check `i18n/{locale}/*.json` and grep for `pip.title` or `pipeline.title`).

**WHAT.** Verified v1.58.36 (`/api/health.version === sidebar v1.58.36`):

| Locale | H1 `pip.title` | Sidebar `nav.pipeline` | Match? |
|---|---|---|---|
| en | `Pipeline` | `Pipeline` | ✓ |
| es | **`Pipeline`** ❌ | `Vacantes` | ✗ |
| pt-BR | **`Pipeline`** ❌ | `Vagas` | ✗ |
| ko | `파이프라인` | `파이프라인` | ✓ |
| ja | `パイプライン` | `パイプライン` | ✓ |
| ru | **`Pipeline`** ❌ | `Воронка` | ✗ |
| zh-CN | `流水线` | `流水线` | ✓ |
| zh-TW | `流水線` | `流水線` | ✓ |

5/8 locales correct, 3 inconsistent. Spec-spirit (closed I18N-011) is sidebar nav.* ↔ page-title parity.

**WHY.** Loan word "Pipeline" is widely accepted in Russian dev parlance (and in es/pt-BR too), but inconsistent with what the sidebar advertises. UX cost: users navigate from sidebar `Воронка` and the page H1 reads `Pipeline` — they'd reasonably wonder if it's the wrong page.

**HOW.**
- es: `pip.title = "Vacantes"` (match sidebar) OR `pip.title = "Pipeline de vacantes"` (longer, more contextual). Recommend the longer form for clarity.
- pt-BR: `pip.title = "Pipeline de vagas"` (loan + Portuguese qualifier).
- ru: `pip.title = "Воронка вакансий"` (loan-free, matches sidebar `Воронка`).

Audit other routes for the same pattern — grep:
```bash
grep -E '"(pip|scan|deep|track|cv|conf|prof|help|auto|app)\.title"\s*:\s*"[A-Z][a-z]+"' i18n/{es,pt-BR,ru}/*.json
```
This finds page-title keys that are still in English on those 3 locales.

**TEST.** Add to `tests/i18n-no-latin-leaks.test.mjs`:
```js
const PURE_LATIN = /^[A-Za-z\s\-/]+$/;
for (const loc of ['ru','ja','ko','zh-CN','zh-TW']) {
  const i18n = loadLocale(loc);
  for (const k of Object.keys(i18n)) {
    if (k.endsWith('.title') && PURE_LATIN.test(i18n[k])) {
      // allow short loanwords explicitly
      assert(WHITELIST.has(i18n[k]), `Latin page title ${k}="${i18n[k]}" in ${loc}`);
    }
  }
}
```
Or simpler: snapshot test of `{locale}.pip.title` for all 8 locales — must NOT equal `Pipeline` on `ru`/`es`/`pt-BR` (unless explicitly whitelisted).

**ACCEPTANCE.**
1. `npm test` — new i18n-no-latin-leaks test green.
2. Browser: switch to `ru` → navigate `#/pipeline` → H1 reads localized term (e.g. `Воронка вакансий`).
3. Same on `es` / `pt-BR`.
4. Sidebar `nav.pipeline` still localized.
5. Tab title (`document.title`) localized.
6. No CSP / console violations.

**CHANGELOG (×8 files).** Example RU under `## [1.58.37]`:
```md
### i18n
- `#/pipeline` H1 теперь использует локализованный заголовок (`Воронка вакансий` в ru, `Vacantes` в es, `Pipeline de vagas` в pt-BR) — паритет с `nav.pipeline` в сайдбаре. (NEW-D1)
```

---

### FIX v1.58.38 · NEW-D3 — `#/tracker` search input `aria-label` (Minor / a11y)

**WHERE.** `#/tracker` template — the `<input placeholder="Search by company / role…">` element.

**WHAT.** Live verified: `searchAria: null`. Only `placeholder` provides the accessible name. WCAG / ARIA best practice requires an explicit `aria-label` for stand-alone search inputs that are not associated with a `<label>` via `for`.

**WHY.** Screen reader users hear only "edit text" or "search edit text" depending on UA. With an `aria-label`, they hear the input's purpose.

**HOW.**
```html
<input
  type="search"
  class="tracker-search"
  placeholder="{{ t('track.search.placeholder') }}"
  aria-label="{{ t('track.search.aria_label') }}">
```

i18n keys (× 8 locales):
- `track.search.aria_label`:
  - en: `"Search applications by company name or role title"`
  - es: `"Buscar postulaciones por empresa o rol"`
  - pt-BR: `"Buscar candidaturas por empresa ou cargo"`
  - ko: `"회사 또는 역할로 지원 내역 검색"`
  - ja: `"会社名または役職で応募を検索"`
  - ru: `"Поиск заявок по компании или роли"`
  - zh-CN: `"按公司或职位搜索申请"`
  - zh-TW: `"依公司或職位搜尋申請"`

**TEST.** `tests/tracker-a11y.test.mjs`:
```js
test('tracker search has aria-label in every locale', () => {
  for (const loc of LOCALES) {
    const html = render('/tracker', loc);
    const input = parseSearchInput(html);
    assert(input.getAttribute('aria-label'), `Missing aria-label in ${loc}`);
    assert.notEqual(input.getAttribute('aria-label'), input.getAttribute('placeholder'),
      `aria-label should not equal placeholder in ${loc}`);
  }
});
```

**ACCEPTANCE.** VoiceOver/NVDA on `#/tracker`: focus the search input — screen reader announces the localized purpose. No console warnings.

---

### FIX v1.58.39 · NEW-D2 — Dashboard top-bar `Refresh` feedback toast (Minor / UX)

**WHERE.** Dashboard top-bar `Refresh` button handler. Distinct from the connection-banner `Refresh` (which was fixed in v1.58.14 / M-9). Look for the on-click handler in the Dashboard module or the top-bar utility.

**WHAT.** Click `Refresh` → counters re-fetch silently. No toast. User cannot tell if anything happened.

**WHY.** Symmetry: the connection-banner Refresh shows feedback after v1.58.14; the Dashboard top-right Refresh should too. Currently a UX inconsistency.

**HOW.** Reuse the same `dashboard.refreshed` i18n key (or create `dashboard.topbar.refreshed`).

```js
async function onTopbarRefresh() {
  const counters = await refetchDashboard();
  toast.success(i18n.t('dashboard.refreshed', {
    applications: counters.applications,
    pipeline: counters.pipeline,
    reports: counters.reports,
  }));
}
```

i18n key `dashboard.refreshed`:
- en: `"Refreshed · {applications} applications · {pipeline} pending · {reports} reports"`
- ru: `"Обновлено · заявок: {applications} · в очереди: {pipeline} · отчётов: {reports}"`
- (× 8 locales)

**TEST.** `tests/e2e/dashboard-topbar-refresh-toast.spec.mjs`:
```js
test('Top-bar Refresh produces a feedback toast', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/dashboard');
  await page.click('button:has-text("Refresh")');
  await expect(page.locator('.toast')).toContainText(/Refreshed/);
});
```

**ACCEPTANCE.** Click Refresh → green toast with current counters. No double-fire on rapid clicks (debounce or block while in-flight).

---

### FIX v1.58.40 · Test-fixture cleanup tooling (Trivial)

**WHERE.** `Makefile` (or root `scripts/clean-test-fixtures.mjs`).

**WHAT.** `data/pipeline.md` accumulated **1252 entries** during regression cycles — all `example.com/*` fixtures. Manual cleanup is tedious.

**HOW.**
```bash
# Makefile target
clean-test-fixtures:
	@grep -v -E '(example\.com)' data/pipeline.md > data/pipeline.md.tmp && mv data/pipeline.md.tmp data/pipeline.md
	@echo "Removed example.com fixtures from data/pipeline.md"
```

Or `scripts/clean-test-fixtures.mjs`:
```js
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.env.CAREER_OPS_ROOT || '..', 'data/pipeline.md');
const lines = readFileSync(path, 'utf8').split('\n');
const filtered = lines.filter(l => !/example\.com/.test(l));
writeFileSync(path, filtered.join('\n'));
console.log(`Removed ${lines.length - filtered.length} example.com fixtures.`);
```

**TEST.** Dry-run the script; assert it removes only `example.com` lines and leaves real ATS URLs intact (`boards.greenhouse.io`, `apply.lever.co`, etc.).

**ACCEPTANCE.** After running, `data/pipeline.md` no longer contains `example.com` lines; real entries untouched.

---

### FIX v1.58.41 (backlog, awaiting spec clarification) — Server `Accept-Language` for `/api/pipeline` 400

**WHY backlog:** spec `AI-review §3` explicitly says: *"server `details` English-by-policy (consistent w/ all server errors)."* My regression verified this is the current behavior — all 8 locales get the EN error body.

**Action:** confirm spec intent with the maintainer. If the policy is "English by design", close NEW-D4 as `not-a-finding`. If the policy should change, open a new fix:
- Server reads `Accept-Language` and returns `{ error, errorLocalized }` (or just `error` in the requested locale).
- SPA already wraps in localized chrome (`Details` summary etc.), so the change is backward-compatible.

Defer. **Do not ship until spec policy is clarified.**

---

## §3 — Universal acceptance protocol (per release)

```bash
# 1. Build & boot
npm ci
npm run build  # if applicable
node web-ui/server.mjs

# 2. Tests
npm test
npm run test:e2e
npm run test:e2e:full
npm run test:e2e:browser
node scripts/check-no-also-leftovers.mjs
node scripts/check-changelog-parity.mjs

# 3. Browser smoke (EN + 1 non-EN, light + dark)
# - Dashboard renders, 0 console errors
# - The specific fix's surface verified
# - 25-route exhaustive sweep clean

# 4. Pipelines
# CI · Release · AI-Review · Publish — all `success` for vX.Y.Z

# 5. Cleanup
# Wipe test-fixture entries from data/pipeline.md (after v1.58.40 ships, just run `make clean-test-fixtures`)

# 6. Tag
git add -A
git commit -m "fix(<area>): <one-line> (<TICKET-ID>)"
git tag vX.Y.Z
git push origin main vX.Y.Z

# 7. Watch CI to success on the tag.
```

---

## §4 — Locale matrix (every release)

For each fix, confirm behaviour on **all 8 locales** for the page(s) touched:

| Locale | BCP-47 | RTL? | Routes to smoke |
|---|---|---|---|
| English | `en` | LTR | the page touched |
| Spanish | `es` | LTR | same |
| Portuguese (Brazil) | `pt-BR` | LTR | same |
| Korean | `ko` | LTR | same |
| Japanese | `ja` | LTR | same |
| Russian | `ru` | LTR | same |
| Simplified Chinese | `zh-CN` | LTR | same |
| Traditional Chinese | `zh-TW` | LTR | same |

For each locale: `<html lang>` updates, `document.title` localizes, sidebar item highlights, 0 console errors, the changed string is correct, no Latin leak in non-Latin locales (per `tests/i18n-no-latin-leaks.test.mjs`).

---

## §5 — Sign-off (after the LAST release in the chain)

| Gate | Pass criterion | ☐ |
|---|---|---|
| Every fix above shipped as its own version | ☐ |
| Parity matrix at vX.Y.Z (last shipped) | ☐ |
| `npm test` (≥ 900) + new tests green | ☐ |
| `npm run test:e2e` 20/20 | ☐ |
| `npm run test:e2e:full` 23/23 | ☐ |
| `npm run test:e2e:browser` 58/58 | ☐ |
| Playwright `notif-drawer` 7-step contract green | ☐ |
| `scripts/check-no-also-leftovers.mjs` ✓ | ☐ |
| `scripts/check-changelog-parity.mjs` ✓ | ☐ |
| CI Node 18/20/22 `success` for every tag in the chain | ☐ |
| MASTER REGRESSION rerun (`qa/REGRESSION-FINAL.md` umbrella) — green | ☐ |
| Security invariants (§0.6) unchanged | ☐ |
| `data/pipeline.md` cleared of test fixtures | ☐ |

---

## §6 — Out of scope (defer to v1.59 / cross-repo)

- **C-1 prompt-layer** — `modes/deep.md` final-form enforcement → parent project `santifer/career-ops`.
- **G-005** — A-G → A-F header migration → parent `modes/oferta.md`.
- **UX-022 stale portals** — `Clarity AI` / `Forto` / `Hugging Face` 404 in `portals.yml` → parent housekeeping.
- **CLI-locale** — `career-ops doctor` / `verify-pipeline.mjs` / `cv-sync-check.mjs` stdout localization. Only modal **chrome** localizes.
- **Mobile (≤ 420 px) deep audit** — needs a dedicated mobile pass.
- **Drag-and-drop reordering** on Pipeline / Tracker.
- **Bulk multi-select + delete** on Pipeline / Tracker.
- **RTL** (Arabic / Hebrew) — `dir` attribute is set but no full audit done.

---

## §7 — Commit hygiene (per release)

- One PR per release. Subject:
  `fix(<area>): <one-line> (NEW-DN | M-N | I-N | U-N | BUG-XXX)`
- Commit body cross-references this file:
  > Closes FIX v1.58.X (per `FIX-PROMPT-v1.58.37_and_beyond.md` §1).
- `CHANGELOG.md` ×8 — every locale updated under `## [Unreleased]`, promoted to `## [1.58.X]` on tag.
- Tag `v1.58.X` on `origin/main` only after CI ends `success`.
- AI-review LGTM **before** push (advisory). `ci.yml` is the hard gate.

---

## §8 — Quick reference / cheat sheet

```text
HIGH (none currently — security envelope clean, a11y essentials green)

MEDIUM
  v1.58.37 · NEW-D1  #/pipeline H1 localized on es/pt-BR/ru
  v1.58.38 · NEW-D3  Tracker search aria-label × 8
  v1.58.39 · NEW-D2  Dashboard top-bar Refresh feedback toast

LOW / TRIVIAL
  v1.58.40 · Test-fixture cleanup tooling

BACKLOG (spec clarification)
  v1.58.41 · Server Accept-Language for /api/pipeline 400 — pending spec policy decision
```

---

## §9 — Status of every prior backlog item (re-verified this run)

| Item | Source | Status @ v1.58.36 |
|---|---|---|
| BUG-001 ISO date | Ledger | ✓ closed v1.58.x |
| BUG-002 fixture profile | Ledger | ✓ closed |
| BUG-003 markdown in blockquote | Ledger | ✓ closed on 8 locales |
| BUG-004 `#/outreach` alias | Ledger | ✓ closed |
| BUG-005 pipeline dup | Ledger | ✓ closed |
| BUG-006 humanized 400 | Ledger | ✓ closed (with U-4 details wrapper v1.58.24) |
| BUG-007/008 Doctor modal | Ledger | ✓ closed (both Health-page AND top-bar after v1.58.6) |
| BUG-010 Reports subtitle | Ledger | ✓ closed |
| I18N-011 Help TOC | Ledger | ✓ closed for items 3/4/6–12; items 2/5/13/14 closed v1.58.18 |
| I18N-012/013 RU deep | Ledger | ✓ closed |
| FIX-C1 stripper | Ledger | ✓ closed |
| FIX-C2 `<html lang>` | Ledger | ✓ closed |
| v1.57.x #/config | Ledger | ✓ all rows verified |
| AI-review §3 | Ledger | ✓ by design (NEW-D4 is the same policy, not a regression) |
| M-1 focus-ring | v1.58.4 backlog | ✓ closed v1.58.9 |
| M-2 progress toast drain | v1.58.4 backlog | ✓ closed v1.58.10 |
| M-3 navigator lang autodetect | v1.58.4 backlog | ✓ closed (FIX-C2) |
| M-4 saved-card gap | v1.58.4 backlog | ✓ closed v1.58.11 |
| M-5 Tracker action label loc | v1.58.4 backlog | ✓ closed v1.58.5/.6 chain |
| M-6 CLI modal chrome | v1.58.4 backlog | ✓ closed v1.58.6 |
| M-7 cost line ↔ LLM_PROVIDER | v1.58.4 backlog | ✓ closed v1.58.12 |
| M-8 Apply checklist interactive | v1.58.4 backlog | ✓ closed v1.58.13 |
| M-9 banner Refresh feedback | v1.58.4 backlog | ✓ closed v1.58.14 (top-bar Refresh = NEW-D2 follow-up) |
| I-1 aria-label search | v1.58.4 backlog | ✓ closed v1.58.15 |
| I-2 today rel-time | v1.58.4 backlog | ✓ closed v1.58.17 |
| I-3 Help TOC 2/5/13/14 | v1.58.4 backlog | ✓ closed v1.58.18 |
| I-4 RU `cadence/follow-up` | v1.58.4 backlog | ✓ closed v1.58.19 (per spec; static guard governs) |
| I-5 RU `smart questions` | v1.58.4 backlog | ✓ closed |
| I-6 `⌘K/Ctrl+K` per platform | v1.58.4 backlog | ✓ closed v1.58.20 |
| U-1 CV H1 + subtitle | v1.58.4 backlog | ✓ closed v1.58.21 |
| U-2 `#/auto` H1 emoji | v1.58.4 backlog | ✓ closed v1.58.22 |
| U-3 date placeholder relative | v1.58.4 backlog | ✓ closed v1.58.23 |
| U-4 toast details collapsible | v1.58.4 backlog | ✓ closed v1.58.24 |
| U-5 Dashboard CTA dedupe | v1.58.4 backlog | ✓ closed v1.58.25 |
| U-6 Scan active-companies tooltip | v1.58.4 backlog | ✓ closed v1.58.26 |
| U-7 ASCII divider | v1.58.4 backlog | ✓ closed v1.58.27 |
| U-8 Prompt collapse | v1.58.4 backlog | ✓ closed v1.58.28 |
| U-9 Pipeline queue-chip gap | v1.58.4 backlog | ✓ closed v1.58.29 |
| U-10 Tracker actions disabled@0 | v1.58.4 backlog | ✓ closed v1.58.30 |
| U-11 LEGITIMACY tooltip | v1.58.4 backlog | ✓ closed v1.58.31 |
| U-12 Help filter placeholder | v1.58.4 backlog | ✓ closed v1.58.32 |
| U-13 Notifications drawer | v1.58.4 backlog | ✓ closed v1.58.33–v1.58.35 |
| U-14 H1↔subtitle spacing | v1.58.4 backlog | ✓ closed v1.58.33 |
| U-15 CV dirty-state | v1.58.4 backlog | ✓ closed v1.58.33 |
| NEW-D1 | This run | OPEN — fix at v1.58.37 |
| NEW-D2 | This run | OPEN — fix at v1.58.39 |
| NEW-D3 | This run | OPEN — fix at v1.58.38 |
| NEW-D4 | This run | by-design (per spec AI-review §3) |
| G-005 | Cross-repo | OPEN — blocked on parent |
| C-1 prompt-layer | Cross-repo | OPEN — parent-owned `modes/deep.md` |
| UX-022 stale portals | Cross-repo | parent `portals.yml` housekeeping |

---

*Produced from `2026-05-19-REGRESSION-FINAL.md`. Hand off to Claude Code or human dev. One fix per release. HIGH → MEDIUM → LOW. Never batch. Never `--no-verify`. `ci.yml` is the hard gate.*
