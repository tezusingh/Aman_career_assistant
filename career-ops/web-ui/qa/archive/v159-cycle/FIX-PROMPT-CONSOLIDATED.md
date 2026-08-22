# FIX-PROMPT — career-ops-ui · CONSOLIDATED (all open fixes, post-v1.58.36)

The single, exhaustive, hand-off-ready fix specification. Distilled from **every** regression run in this cycle: 2026-05-19 MASTER (v1.58.2/v1.58.3) · 2026-05-19 REGRESSION v1.58.36 · 2026-05-19 REGRESSION-FINAL v1.58.36 (button-result deep-dive).
Audience: implementer (Claude Code or human dev).

**Status of v1.58.36:** browser-verified GREEN on every `qa/REGRESSION-FINAL.md §11–§12` invariant. The list below is the **complete set of open items** as of 2026-05-19 — nothing else is on the floor.

---

## §0 — Doctrine (non-negotiable, repeated for clarity)

> **ONE one-fix ship per release** — bump + CHANGELOG ×8 (parity-gated) + a dedicated test + Playwright-verify + pre-commit AI-review LGTM + CI-watch to green. **Never batch. Never `--no-verify`. HIGH → MEDIUM → LOW.** Pre-commit AI review is **advisory**; **`ci.yml` is the hard gate**.

**Hard rules** (must hold every release):

1. **Parity**: `package.json::version` ≡ `package-lock.json` ≡ `/api/health.version` ≡ every `CHANGELOG*.md` top entry ≡ README ×8 `release-vX` + `tests-N` badges ≡ `CLAUDE.md "currently vX"` ≡ `.claude/PROJECT-CONTEXT.md`.
2. **CI gates**: `npm test` · `npm run test:e2e` · `npm run test:e2e:full` · `npm run test:e2e:browser` · `scripts/check-no-also-leftovers.mjs` · `scripts/check-changelog-parity.mjs` · `ci.yml` — all `success` on Node 18 / 20 / 22 before tagging.
3. **8-locale parity**: every user-visible string change ships keys for `en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`. `tests/i18n-coverage.test.mjs` gates.
4. **No parent-project writes from a read path**. Only explicit user POST/PUT/DELETE.
5. **Security invariants unchanged**:
   - `isValidJobUrl` rejects loopback / `javascript:` / `file:` / script-char / template-char (`${T}`/`{{T}}`/`<%T%>`).
   - `safeGet` SSRF guards.
   - `UI.md()` escape-first (XSS boundary); `stripDangerousMarkdown` is CV ingress; `cleanLlmMarkdown` is declutter, NOT a sanitizer.
   - `validateConfig` never echoes `SECRET_KEYS`.
   - CSP unconditional with `frame-ancestors 'none'`, no `'unsafe-eval'`, no `'unsafe-inline'` for `script-src`.
6. **`PATHS` resolves once per process**.
7. **Commit subjects**: `fix(<area>): <one-line> (<TICKET-ID>)`.

---

## §1 — Open items (release sequence, HIGH → MEDIUM → LOW)

| Release | Ticket | Severity | Class | Origin |
|---|---|---|---|---|
| **v1.58.37** | NEW-D1 | Minor | i18n parity | 2026-05-19 REGRESSION-FINAL |
| **v1.58.38** | NEW-D3 | Minor | a11y | 2026-05-19 REGRESSION-FINAL |
| **v1.58.39** | NEW-D2 | Minor | UX feedback | 2026-05-19 REGRESSION-FINAL |
| **v1.58.40** | TOOL-1 | Trivial | tooling | 2026-05-19 REGRESSION-FINAL |
| **v1.58.41** | DOC-1 | Trivial | docs / policy | 2026-05-19 REGRESSION-FINAL |

**Cross-repo (NOT this repo — blocked or parent-owned):**

| Ticket | Where | Status |
|---|---|---|
| **C-1** prompt-layer | parent `santifer/career-ops :: modes/deep.md` | OPEN, blocked on parent |
| **G-005** | parent `santifer/career-ops :: modes/oferta.md` | OPEN, blocked on parent |
| **UX-022** stale portals | parent `portals.yml` (`Clarity AI` / `Forto` / `Hugging Face`) | parent housekeeping |
| **CLI-locale** | `career-ops doctor` / `verify-pipeline.mjs` / `cv-sync-check.mjs` | defer to v1.59 |

---

## §2 — Per-fix detailed spec

### FIX v1.58.37 · NEW-D1 — `#/pipeline` H1 latinization on 3 locales (Minor / i18n parity)

**WHERE.** `i18n/{es,pt-BR,ru}/pip.json` (or the consolidated locale file — grep for `pip.title` or `pipeline.title`).

**WHAT (verified twice on v1.58.36).**

| Locale | `pip.title` H1 | `nav.pipeline` sidebar | Match |
|---|---|---|---|
| en | `Pipeline` | `Pipeline` | ✓ |
| es | **`Pipeline`** ❌ | `Vacantes` | ✗ |
| pt-BR | **`Pipeline`** ❌ | `Vagas` | ✗ |
| ko | `파이프라인` | `파이프라인` | ✓ |
| ja | `パイプライン` | `パイプライン` | ✓ |
| ru | **`Pipeline`** ❌ | `Воронка` | ✗ |
| zh-CN | `流水线` | `流水线` | ✓ |
| zh-TW | `流水線` | `流水線` | ✓ |

5/8 match, 3 mismatch. Inconsistent with the spirit of the closed `I18N-011` (sidebar nav.* ↔ page-title parity).

**HOW.**
- `es: pip.title = "Pipeline de vacantes"` (longer, contextual)
- `pt-BR: pip.title = "Pipeline de vagas"` (loan + qualifier)
- `ru: pip.title = "Воронка вакансий"` (loan-free, matches sidebar)

Also grep other locales for similar Latin-leak page-titles:

```bash
grep -E '"(pip|scan|deep|track|cv|conf|prof|help|auto|app)\.title"\s*:\s*"[A-Z][a-z]+"' i18n/{es,pt-BR,ru,ko,ja,zh-CN,zh-TW}/*.json
```

**TEST.** `tests/i18n-no-latin-leaks.test.mjs`:

```js
const PURE_LATIN = /^[A-Za-z][A-Za-z\s\-/]*$/;
const WHITELIST = new Set(['CV', 'API', 'URL', 'JD', 'PDF', 'TSV', 'LinkedIn', 'OpenAI', 'OpenRouter', 'Anthropic', 'Gemini', 'Qwen', 'GitHub']);
for (const loc of ['ru', 'es', 'pt-BR']) {
  const i18n = loadLocale(loc);
  for (const key of Object.keys(i18n)) {
    if (/\.title$/.test(key) && PURE_LATIN.test(i18n[key]) && !WHITELIST.has(i18n[key])) {
      assert.fail(`Latin page-title leak: ${loc}.${key} = "${i18n[key]}"`);
    }
  }
}
```

**ACCEPTANCE.**
1. `npm test` — new i18n-no-latin-leaks test green.
2. Browser: ru → `#/pipeline` → H1 reads `Воронка вакансий`; es → `Pipeline de vacantes`; pt-BR → `Pipeline de vagas`.
3. Sidebar `nav.pipeline` still localized.
4. `document.title` updates per locale.
5. 25-route smoke walk on the 3 affected locales — no CSP/console violations.

**CHANGELOG ×8.** Example RU under `## [1.58.37]`:

```md
### i18n
- `#/pipeline` H1 теперь использует локализованный заголовок (`Воронка вакансий` в ru, `Pipeline de vacantes` в es, `Pipeline de vagas` в pt-BR) — паритет с `nav.pipeline` в сайдбаре. (NEW-D1)
```

---

### FIX v1.58.38 · NEW-D3 — `#/tracker` search input `aria-label` (Minor / a11y)

**WHERE.** `#/tracker` template — the `<input placeholder="Search by company / role…">` element. Grep for `Search by company`.

**WHAT.** Live verified v1.58.36: `searchAria: null`. Only `placeholder` provides the accessible name.

**WHY.** WCAG/ARIA best-practice requires explicit `aria-label` on stand-alone search inputs without an associated `<label>`. Screen reader users currently hear only "edit text".

**HOW.**

```html
<input
  type="search"
  class="tracker-search"
  placeholder="{{ t('track.search.placeholder') }}"
  aria-label="{{ t('track.search.aria_label') }}">
```

i18n keys × 8:
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
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
test('tracker search has aria-label in every locale', () => {
  for (const loc of LOCALES) {
    const html = render('/tracker', loc);
    const input = parseSearchInput(html);
    assert(input.getAttribute('aria-label'), `Missing aria-label in ${loc}`);
    assert.notEqual(
      input.getAttribute('aria-label'),
      input.getAttribute('placeholder'),
      `aria-label should not equal placeholder in ${loc}`
    );
  }
});
```

**ACCEPTANCE.** VoiceOver / NVDA on `#/tracker`: focus search input → screen reader announces the localized purpose. No console warnings.

---

### FIX v1.58.39 · NEW-D2 — Dashboard top-bar `Refresh` feedback toast (Minor / UX)

**WHERE.** Dashboard top-bar `Refresh` button handler. **Distinct** from the connection-banner `Refresh` (already fixed in v1.58.14 / M-9).

**WHAT.** Click → counters re-fetch silently. No toast. User cannot tell if anything happened. Inconsistent with the banner-Refresh.

**HOW.** Reuse the existing `dashboard.refreshed` i18n key OR create `dashboard.topbar.refreshed`.

```js
async function onTopbarRefresh() {
  const before = snapshotCounters();
  await refetchDashboard();
  const after = snapshotCounters();
  toast.success(i18n.t('dashboard.refreshed', after));
}
```

i18n key `dashboard.refreshed`:
- en: `"Refreshed · {applications} applications · {pipeline} pending · {reports} reports"`
- es: `"Actualizado · {applications} solicitudes · {pipeline} pendientes · {reports} informes"`
- pt-BR: `"Atualizado · {applications} candidaturas · {pipeline} pendentes · {reports} relatórios"`
- ko: `"새로 고침됨 · 지원 {applications}건 · 대기 {pipeline}건 · 보고서 {reports}건"`
- ja: `"更新済み · 応募 {applications} 件 · 待機中 {pipeline} 件 · レポート {reports} 件"`
- ru: `"Обновлено · заявок: {applications} · в очереди: {pipeline} · отчётов: {reports}"`
- zh-CN: `"已刷新 · 申请 {applications} 项 · 待处理 {pipeline} 项 · 报告 {reports} 项"`
- zh-TW: `"已重新整理 · 申請 {applications} 件 · 待處理 {pipeline} 件 · 報告 {reports} 件"`

**TEST.** `tests/e2e/dashboard-topbar-refresh-toast.spec.mjs`:

```js
test('Top-bar Refresh produces feedback toast', async ({ page }) => {
  await page.goto('http://127.0.0.1:4317/#/dashboard');
  await page.click('button:has-text("Refresh")');
  await expect(page.locator('.toast')).toContainText(/Refreshed|Обновлено/);
});
```

**ACCEPTANCE.** Click Refresh → green toast with current counters. Debounce or in-flight block on rapid clicks. Toast appears in active locale. 8-locale smoke check.

---

### FIX v1.58.40 · TOOL-1 — `make clean-test-fixtures` (Trivial / tooling)

**WHERE.** Root `Makefile` (or `scripts/clean-test-fixtures.mjs` standalone).

**WHAT.** `data/pipeline.md` accumulated **≥1252 entries** during regression cycles — all `example.com/*` fixtures. Manual cleanup is tedious.

**HOW.**

Makefile target:

```makefile
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

**TEST.** Dry-run: removes only `example.com` lines; preserves real ATS URLs (`boards.greenhouse.io`, `apply.lever.co`, `ashbyhq.com`, `jobs.workable.com`, `hh.ru`, `career.habr.com`).

**ACCEPTANCE.** After run: `data/pipeline.md` has 0 `example.com` lines; real entries unchanged; `#/pipeline` queue count drops to real-only.

---

### FIX v1.58.41 · DOC-1 — Spec-clarification: server `Accept-Language` policy for `/api/pipeline` 400 (Trivial / docs)

**WHY backlog:** spec `AI-review §3` says: *"server `details` English-by-policy (consistent w/ all server errors)."* Verified live across all 8 locales — `/api/pipeline` 400 body is always English.

**Two paths:**

**A. Confirm "by design".** Add a sentence to `qa/REGRESSION-FINAL.md §5` (or wherever the policy lives):

> Server-side error bodies are **English-by-policy**. The SPA wraps them in localized chrome (toast severity, `Details` summary). Tests in `tests/i18n-coverage.test.mjs` exempt server-error strings from the locale-key parity check.

Close NEW-D4 as `not-a-finding`.

**B. Change policy: localize server errors.** Server reads `Accept-Language` (or query param `lang`); returns `{ error: <localized>, error_en: <fallback>, code: <stable> }`. SPA prefers `error` for toast text; `error_en` goes into the `<details>` postfix.

i18n: server-side resource bundle in `web-ui/server/i18n/` × 8.

**Recommend A (least disruption, keeps tests stable).** B is a v1.59 feature.

**Defer until maintainer decides.**

---

## §3 — Cross-repo / out-of-scope items (parent project)

| Ticket | What | Why blocked here |
|---|---|---|
| **C-1 prompt-layer** | Make Deep research saved brief render with 6 H2 sections (`## Company snapshot` etc.) — stripper-layer (FIX-C1) already strips orphan `</tool_response>` etc.; the prompt-layer enforcement (`modes/deep.md` final-form requirement) lives in the parent CLI repo. | `modes/deep.md` is parent-owned. |
| **G-005** | A-G → A-F header migration | Parent `modes/oferta.md` must flip first; web-ui renderer is schema-tolerant. |
| **UX-022 stale portals** | `Clarity AI` / `Forto` (lever) and `Hugging Face` (workable) return HTTP 404. | Parent `portals.yml` housekeeping. |
| **CLI-locale** | `career-ops doctor` / `verify-pipeline.mjs` / `cv-sync-check.mjs` stdout is English. | Modal **chrome** localizes (per v1.58.6); CLI stdout localization is parent-CLI work, deferred to v1.59. |

---

## §4 — Universal acceptance protocol (per release)

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
#    - the fix's surface verified
#    - 25-route exhaustive sweep clean

# 4. Pipelines: CI · Release · AI-Review · Publish → all `success` for vX.Y.Z

# 5. Cleanup: `make clean-test-fixtures` (after v1.58.40 ships)

# 6. Tag
git add -A
git commit -m "fix(<area>): <one-line> (<TICKET-ID>)"
git tag vX.Y.Z
git push origin main vX.Y.Z

# 7. Watch CI to `success` on the tag.
```

---

## §5 — Locale matrix (every release)

For each fix, confirm behaviour on **all 8 locales** for the page(s) touched:

| Locale | BCP-47 | RTL? | Routes to smoke |
|---|---|---|---|
| English | `en` | LTR | the page touched + Dashboard + Pipeline + Help |
| Spanish | `es` | LTR | same |
| Portuguese (Brazil) | `pt-BR` | LTR | same |
| Korean | `ko` | LTR | same |
| Japanese | `ja` | LTR | same |
| Russian | `ru` | LTR | same |
| Simplified Chinese | `zh-CN` | LTR | same |
| Traditional Chinese | `zh-TW` | LTR | same |

For each locale: `<html lang>` updates · `document.title` localizes · sidebar item highlights · 0 console errors · changed string correct · no Latin leak in non-Latin locales.

---

## §6 — Sign-off (after the last release in the chain — v1.58.40 / DOC-1)

| Gate | Pass criterion | ☐ |
|---|---|---|
| Every fix above shipped as its own version (v1.58.37 / .38 / .39 / .40) | ☐ |
| Parity matrix at the final tag | ☐ |
| `npm test` ≥ 900 + new tests green | ☐ |
| `npm run test:e2e` 20/20 | ☐ |
| `npm run test:e2e:full` 23/23 | ☐ |
| `npm run test:e2e:browser` 58/58 (or current baseline + new tests) | ☐ |
| Playwright `notif-drawer` contract green | ☐ |
| `tests/i18n-no-latin-leaks.test.mjs` green (new) | ☐ |
| `tests/tracker-a11y.test.mjs` green (new) | ☐ |
| `tests/e2e/dashboard-topbar-refresh-toast.spec.mjs` green (new) | ☐ |
| `scripts/check-no-also-leftovers.mjs` ✓ | ☐ |
| `scripts/check-changelog-parity.mjs` ✓ | ☐ |
| CI Node 18 / 20 / 22 `success` for every tag | ☐ |
| MASTER REGRESSION rerun (`qa/REGRESSION-FINAL.md` umbrella) — green | ☐ |
| Security invariants (§0.5) unchanged | ☐ |
| `data/pipeline.md` cleared of test fixtures | ☐ |
| `qa/v54-regression/<DATE>-REGRESSION.md` filed | ☐ |
| DOC-1 spec clarification merged or NEW-D4 closed as `not-a-finding` | ☐ |

---

## §7 — Full ledger of fixed items @ v1.58.36 (do NOT re-open)

Verified GREEN in the 2026-05-19 regression runs:

| Ticket | Fix release | Class | Status |
|---|---|---|---|
| BUG-001 | v1.58.x | ISO date validation `#/followup` | ✅ |
| BUG-002 | v1.58.x | Acceptance Test profile → OPTIONAL flag | ✅ |
| BUG-003 | v1.58.x | `**bold**` in blockquotes × 8 locales | ✅ |
| BUG-004 | v1.58.x | `#/outreach` alias | ✅ |
| BUG-005 | v1.58.x | Pipeline dup → "Already in the queue — skipped" | ✅ |
| BUG-006 | v1.58.x | Humanized invalid-URL toast | ✅ |
| BUG-007 | v1.58.x | Progress toast drained on modal | ✅ |
| BUG-008 | v1.58.x + v1.58.6 (top-bar) | Modal title == button label, both entry-points | ✅ |
| BUG-010 | v1.58.x | Reports subtitle | ✅ |
| I18N-011 | v1.58.x + v1.58.18 | Help TOC localized | ✅ |
| I18N-012/013 | v1.58.x | RU deep.title / subtitle / dash CTA | ✅ |
| FIX-C1 stripper | v1.58.x | cleanLlmMarkdown strips `<tool_call>` / `</tool_response>` / `<thinking>` / `<invoke>` / `<final-brief>` | ✅ |
| FIX-C2 | v1.58.x | `<html lang>` + autodetect + persist | ✅ |
| v1.57.x #/config | v1.57.x | OpenRouter, masked secrets, per-field 400 | ✅ |
| NEW-1 / v1.58.4 | v1.58.4 | CSP unconditional | ✅ |
| NEW-2 / v1.58.7 | v1.58.7 | Template-placeholder rejection | ✅ |
| v1.58.8 | v1.58.8 | 5 provider rows on `#/health` | ✅ |
| M-1 / v1.58.9 | v1.58.9 | `:focus-visible` ring on form fields | ✅ |
| M-2 / v1.58.10 | v1.58.10 | UI.modal drains progress toast | ✅ |
| M-4 / v1.58.11 | v1.58.11 | Saved-card title↔date gap | ✅ |
| M-7 / v1.58.12 | v1.58.12 | Cost line tracks OpenRouter (`cost.varies`) | ✅ |
| M-8 / v1.58.13 | v1.58.13 | Apply checklist interactive + Reset + Copy unchecked | ✅ |
| M-9 / v1.58.14 | v1.58.14 | Connection-banner Refresh feedback | ✅ |
| I-1 / v1.58.15 | v1.58.15 | Top-bar search aria-label localized × 8 | ✅ |
| I-2 / v1.58.17 | v1.58.17 | Saved-research rel-time (Intl.RelativeTimeFormat) | ✅ |
| I-3 / v1.58.18 | v1.58.18 | Help TOC items 2/5/13/14 localized | ✅ |
| I-4 / v1.58.19 | v1.58.19 | RU `#/followup` H1/hints | ✅ (per static guard) |
| I-6 / v1.58.20 | v1.58.20 | Footer hotkey ⌘K/Ctrl+K per platform | ✅ |
| U-1 / v1.58.21 | v1.58.21 | `#/cv` H1 + subtitle (proper page-title) | ✅ |
| U-2 / v1.58.22 | v1.58.22 | `#/auto` emoji as sibling | ✅ |
| U-3 / v1.58.23 | v1.58.23 | `#/followup` placeholder = today − 14 d | ✅ |
| U-4 / v1.58.24 | v1.58.24 | Toast detail in `<details>` | ✅ |
| U-5 / v1.58.25 | v1.58.25 | Dashboard CTA dedupe | ✅ |
| U-6 / v1.58.26 | v1.58.26 | Scan active-companies tooltip | ✅ |
| U-7 / v1.58.27 | v1.58.27 | Verify-pipeline ASCII `===` stripped | ✅ |
| U-8 / v1.58.28 | v1.58.28 | Generate prompt collapsed by default (Project/Training/Patterns/Followup/Interview prep) | ✅ |
| U-9 / v1.58.29 | v1.58.29 | Pipeline counter↔filter responsive stack | ✅ |
| U-10 / v1.58.30 | v1.58.30 | Tracker actions disabled @ 0 rows | ✅ |
| U-11 / v1.58.31 | v1.58.31 | Tracker LEGITIMACY Ⓘ tooltip + tabindex | ✅ |
| U-12 / v1.58.32 | v1.58.32 | Help TOC filter min-width | ✅ |
| U-13 / v1.58.33 | v1.58.33 | Toast journal API | ✅ |
| U-14 / v1.58.33 | v1.58.33 | Page-header spacing safety-net | ✅ |
| U-15 / v1.58.33 | v1.58.33 | CV editor dirty-state | ✅ |
| Notifications drawer | v1.58.34 | Bell + drawer chrome + capture | ✅ |
| Drawer hidden-at-boot + `aria-expanded` contract | v1.58.35 | + Playwright 7-step contract + Help §18 | ✅ |

---

## §8 — Commit hygiene

- One PR per release. Subject: `fix(<area>): <one-line> (<TICKET-ID>)`.
- Body cross-references this file: `> Closes FIX v1.58.X (per FIX-PROMPT-CONSOLIDATED.md §2).`
- `CHANGELOG.md` ×8 — every locale updated under `## [Unreleased]`, promoted to `## [1.58.X]` on tag.
- Tag `v1.58.X` on `origin/main` only after CI ends `success`.
- AI-review LGTM **before** push (advisory). `ci.yml` is the hard gate.

---

## §9 — Out of scope (defer to v1.59 or later)

- **C-1 prompt-layer** — parent `modes/deep.md` (cross-repo)
- **G-005** — parent `modes/oferta.md` (cross-repo)
- **UX-022** — stale portals in parent `portals.yml`
- **CLI-locale** — `career-ops doctor` / `verify-pipeline.mjs` / `cv-sync-check.mjs` stdout
- **Mobile (≤ 420 px)** deep audit
- **Drag-and-drop reorder** on Pipeline / Tracker
- **Bulk multi-select + delete** on Pipeline / Tracker
- **RTL** (Arabic / Hebrew) — `dir` already set, but no full audit done

---

## §10 — Cheat sheet

```text
RELEASE QUEUE (post-v1.58.36)

  v1.58.37 · NEW-D1   #/pipeline H1 localized on es / pt-BR / ru        (Minor, i18n)
  v1.58.38 · NEW-D3   Tracker search aria-label × 8                     (Minor, a11y)
  v1.58.39 · NEW-D2   Dashboard top-bar Refresh feedback toast          (Minor, UX)
  v1.58.40 · TOOL-1   make clean-test-fixtures                          (Trivial)
  v1.58.41 · DOC-1    spec policy: server Accept-Language on /api/*     (Trivial / docs)

CROSS-REPO (parent project, NOT this repo)

  C-1 prompt-layer    modes/deep.md final-form enforcement
  G-005               A-G→A-F header migration in modes/oferta.md
  UX-022              stale portals in portals.yml
  CLI-locale          stdout localization for career-ops doctor / verify-pipeline / cv-sync-check
```

---

## §11 — How to run the perennial regression after the queue lands

```bash
# inside web-ui/
node web-ui/server.mjs &
SERVER_PID=$!

# paste FIX-PROMPT-CONSOLIDATED.md §4 → run all gates
# then open the browser and verify per §5 across 8 locales

# at the end:
qa_file="qa/v54-regression/$(date +%F)-REGRESSION.md"
echo "Filed at $qa_file"

kill $SERVER_PID
```

If the umbrella `qa/REGRESSION-FINAL.md` finds zero new findings AND the §7 ledger items are still all green AND §5 locale matrix passes — the queue is **shipped clean**.

---

*Single hand-off document. Every open item is in §1 / §2. Every shipped item is in §7. Cross-repo items in §3. Doctrine in §0. One fix per release. HIGH → MEDIUM → LOW. Never batch. Never `--no-verify`. `ci.yml` is the hard gate.*
