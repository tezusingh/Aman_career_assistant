# FIX-PROMPT — career-ops v1.58.3

Comprehensive fix specification produced from the deep regression of **v1.58.2** (see `career-ops_deep-regression-v1.58.2.md`).
Audience: implementer (Claude Code / human dev). Each item is self-contained — file hints, exact problem, acceptance test, locale matrix.

---

## 0. Hard rules (must hold for every fix)

1. **Do NOT modify the parent project files** (`config/profile.yml`, `cv.md`, `data/applications.md`, `data/pipeline.md`, `modes/*.md`) from code paths. Only explicit user actions through the existing endpoints (`POST /api/pipeline`, `POST /api/tracker`, `PUT /api/cv|profile`, etc.) may write to disk.
2. **No secrets in logs / toasts** — `validateConfig` must never echo a `SECRET_KEYS` value.
3. **Security invariants** stay (see `tests/url-validation.test.mjs`):
   - `isValidJobUrl` rejects loopback / `javascript:` / `file:` / script-char URLs.
   - CSP / `X-Frame-Options` / `Referrer-Policy` headers unchanged.
   - `UI.md()` keeps escape-first contract; `cleanLlmMarkdown` is a scaffolding stripper, not an HTML sanitizer.
4. **Locale parity** — every user-visible string change ships with all 8 locale keys: `en`, `es`, `pt-BR`, `ko`, `ja`, `ru`, `zh-CN`, `zh-TW`. If a key is missing for one locale, add it (fallback EN string is acceptable as a placeholder; mark `// TODO i18n`).
5. **CI gates** — `npm test`, `npm run test:e2e`, `npm run test:e2e:browser`, `npm run test:e2e:full` must remain green on Node 18 / 20 / 22.

---

## 1. CRITICAL fixes (block release)

### FIX-C1. Deep research output is meta-narration, not a structured brief
- **Symptoms (verified):** `#/deep` → Run live → file saved to `reports/<slug>.md`. Open it from "Saved research" — the body contains
  > Я запущу глубокое исследование по запросу. Поскольку вакансия указана как "Software Engineer" без конкретной компании, я подготовлю универсальный брифинг-шаблон.
  > Сначала прочитаю нужные файлы.
  > Хорошо, профиль кандидата считан. Теперь проведу поиск по рынку труда Senior PHP/Go инженеров.
  > **`</tool_response>`**
  > Теперь создам директорию и сохраню брифинг.
  And then the file ends. No `## Company snapshot`, no `## Engineering culture`, no `## Recent news` — none of the promised sections.
- **Root causes (likely):**
  1. The model's tool-orchestration trace is being saved AS the brief — i.e., `deep-research.mjs` writes the entire streamed response to disk instead of the final markdown deliverable that follows the last tool round-trip.
  2. `cleanLlmMarkdown` strips paired `<tool_call>…</tool_call>` blocks but leaves an orphan closing `</tool_response>` when the model produces an unbalanced trace.
  3. The prompt does not enforce a final-form sentinel ("write the brief between `<final-brief>` and `</final-brief>` and nothing else").
- **Fix (three layers):**
  1. **Stripper layer** — extend `cleanLlmMarkdown` (`web-ui/lib/clean-llm-markdown.mjs` or wherever it lives):
     ```js
     text = text.replace(/<\/?(?:tool_call|tool_response|thinking|final-brief|antml:[a-z_]+)>/gi, '');
     text = text.replace(/```(?:tool_call|tool_response|thinking)[\s\S]*?```/g, '');
     ```
     Add a unit test in `tests/llm-output.test.mjs` for: orphan `</tool_response>`, orphan `<thinking>`, paired blocks, mixed runs.
  2. **Saver layer** — in `scripts/deep-research.mjs` (or `web-ui/api/mode/deep.mjs`): keep only the substring **after the last** `</tool_response>` / `</tool_call>`. If the result is shorter than 500 chars or lacks at least 2 `## ` headings, fail with a localized toast: `deep.errors.empty_brief = "The model returned an empty brief — try again or use Copy prompt."`.
  3. **Prompt layer** — in `modes/deep.md`: append a final-form enforcement:
     ```
     OUTPUT FORMAT (strict):
     Start with "## Company snapshot" and produce exactly these six sections in this order:
     1. ## Company snapshot
     2. ## Engineering culture
     3. ## Recent news
     4. ## Glassdoor / Levels.fyi / Blind sentiment
     5. ## Interview process intel
     6. ## Negotiation leverage points
     Do NOT include tool-call traces or meta-narration in the final response.
     ```
- **Acceptance test (manual):**
  1. `#/deep` → Company `Anthropic`, Role `Senior Backend Engineer` → Run live.
  2. Open the saved card. Body must start with `## Company snapshot` and contain all 6 H2 headings.
  3. `outerHTML` of the rendered area must NOT contain literals `tool_call`, `tool_response`, `thinking`, `final-brief`, `<`.
  4. Re-open a brief from **before** the fix that contained leaked scaffolding — it must also render clean (stripper applies on-serve at `GET /api/deep/:name`).
  5. Repeat on `ru` — sections may be in Russian, but the structure must be present.

### FIX-C2. `<html lang>` doesn't update when the locale is switched
- **Symptoms:** `document.documentElement.lang === "en"` on first load even though `navigator.language === "ru-RU"`. Switching to ja/ru/zh-CN via the bottom-of-sidebar picker keeps `lang="en"`.
- **Effect:** Screen readers (VoiceOver, NVDA, TalkBack) will read RU/JA text with EN pronunciation rules.
- **Fix:**
  1. **First load** — in `web-ui/app.js` boot path, BEFORE rendering, run:
     ```js
     const saved = localStorage.getItem('career-ops:lang');
     const browserBest = navigator.languages?.find(l => SUPPORTED.includes(normalizeLocale(l))) || 'en';
     const initial = saved || browserBest;
     document.documentElement.lang = initial;
     i18n.setLocale(initial);
     ```
     `SUPPORTED = ['en','es','pt-BR','ko','ja','ru','zh-CN','zh-TW']`.
  2. **On langchange** — in the lang-switcher handler:
     ```js
     document.documentElement.lang = newLocale;
     document.documentElement.dir = ['ar','he','fa','ur'].includes(newLocale) ? 'rtl' : 'ltr'; // future-proof
     ```
  3. Persist choice to `localStorage['career-ops:lang']`.
- **Acceptance:**
  - Reload page → `<html lang>` matches saved choice (or `navigator.languages` if no saved).
  - Click "Русский" → `document.documentElement.lang === 'ru'`.
  - Add a unit test in `tests/i18n-coverage.test.mjs`: assert `<html lang>` updates on `i18n.setLocale()`.

---

## 2. MAJOR fixes

### FIX-M1. Focus-ring is invisible (WCAG 2.4.7 Focus Visible violation)
- **Verified:** `getComputedStyle(focusedButton)` → `outline: rgb(255,255,255) none 1.5px`, `boxShadow: none`, `border: 0px none`. `none` keyword in outline shorthand wipes the visible ring.
- **Fix:** global stylesheet (`web-ui/css/base.css` or similar):
  ```css
  :focus { outline: none; } /* already there — keep for mouse users */
  :focus-visible {
    outline: 2px solid var(--ring, #2563eb);
    outline-offset: 2px;
    border-radius: var(--radius, 6px);
  }
  /* dark theme override */
  [data-theme="dark"] :focus-visible { outline-color: var(--ring-dark, #93c5fd); }
  ```
- **Acceptance:** Tab through the page; every focusable element shows a 2 px ring. Repeat in dark mode. Verify on Mac Safari (which honors `:focus-visible` differently) — same behavior expected on Chrome 148.

### FIX-M2. Lingering `Running …mjs` toast when result modal opens (sync-check, doctor parity)
- **Symptoms:** click `sync-check` (CV page) — modal opens but the dark toast `Running cv-sync-check.mjs…` stays bottom-right. Doctor was fixed in v1.58.2; the same pattern is missing on `sync-check` (and likely `verify-pipeline` if you watch the timing).
- **Fix:** Centralize via a helper. Wherever a button does
  ```js
  const t = toast.info('Running script.mjs…');
  await runScript(...);
  modal.show(...);
  ```
  replace with
  ```js
  const t = toast.info('Running script.mjs…');
  try {
    const result = await runScript(...);
    modal.show(result);
  } finally {
    toast.dismiss(t);
  }
  ```
  Or even simpler — make `modal.show()` automatically dismiss all toasts tagged with `kind: 'progress'`.
- **Acceptance:** open `#/cv` → click `sync-check` → modal opens → no `Running …` toast visible. Repeat on `Doctor`, `Verify pipeline`, `Normalize`, `Dedup`, `Merge TSV`.

### FIX-M3. Locale not auto-detected from `navigator.language(s)`
- See FIX-C2 above (same change set covers it).

### FIX-M4. Saved-research card title and `today` chip slam together
- **Symptoms:** rendered HTML for a saved card shows `software-engineer-generaltoday`, `story-banktoday` — no whitespace between name and date.
- **Fix:** in the card template (`web-ui/components/saved-research-card.html` or the JSX/template equivalent):
  ```html
  <button class="saved-card">
    <span class="saved-card__title">{{name}}</span>
    <time class="saved-card__date">{{date}}</time>
  </button>
  ```
  CSS:
  ```css
  .saved-card { display: inline-flex; align-items: center; gap: .5rem; }
  .saved-card__date { color: var(--muted); font-size: .85em; }
  ```
- **Acceptance:** open `#/deep` — every saved card shows a visible gap (≥ 6 px) between filename and date.

### FIX-M5. Tracker confirm-modal leaks English operator name (`"normalize"` etc.) on non-EN locales
- **Symptoms:** RU click `Trекер → Нормализовать` → modal body: `Это запустит "normalize" и перепишет data/applications.md …`. The operator name stays English.
- **Fix:** in `i18n/<lang>.json` add keys per action:
  ```json
  "tracker.confirm.normalize.title": "Переписать applications.md?",
  "tracker.confirm.normalize.body": "Это запустит «нормализацию» и перепишет data/applications.md в родительском проекте. Откатить из UI нельзя. Продолжить?"
  ```
  Same for `dedup`, `merge`.
- **Acceptance:** spot-check on `ru`, `ja`, `zh-CN`. The body should never contain a Latin-alphabet operator word in quotes.

### FIX-M6. CLI modals (Doctor / Verify pipeline / sync-check) are unlocalized
- **Symptoms:** content of the modal is the child-process stdout. Even though the **button label** is translated ("Запустить doctor"), the modal body is pure English ASCII.
- **Fix (minimum-impact):** wrap the modal so the user sees a localized **header**:
  - Title: `i18n.t('cli.output_from', { tool: 'career-ops doctor' })` — e.g. RU: `Вывод утилиты career-ops doctor`.
  - Below the title, a localized intro paragraph: `i18n.t('cli.notice')` = "Below is the raw output of the underlying CLI tool. It is intentionally not translated."
  - Then the `<pre>` with the stdout (English, monospace) — unchanged.
- **Fix (full-impact, optional):** add a `--locale` flag to the CLI scripts that produces localized output. Defer to v1.59.
- **Acceptance:** open modal on `ru` — Russian header + intro + English stdout. Same on `ja`, `zh-TW`.

### FIX-M7. "Estimated cost" line is hardcoded, ignores `LLM_PROVIDER`
- **Symptoms:** every Run-live form shows `Estimated cost: Anthropic claude-sonnet-4-6 · ~$0.05/eval`. Switching `LLM_PROVIDER` in `#/config` to `gemini` / `openai` / `qwen` / `openrouter` does NOT change the line.
- **Fix:**
  1. Server: `/api/config/active-provider` returns `{ provider: 'gemini', model: 'gemini-2.5-flash', costPerEval: 0.02 }`.
  2. Client: every Run-live form reads from a shared `<cost-estimate>` web-component / partial:
     ```js
     const { provider, model, costPerEval } = await fetchActiveProvider();
     return i18n.t('cost.estimated', { provider, model, cost: costPerEval.toFixed(2) });
     ```
- **i18n key:** `cost.estimated`. RU: `Ориентировочная стоимость: {provider} {model} · ~${cost}/eval`.
- **Acceptance:** switch LLM_PROVIDER to `gemini` in `#/config` → reload `#/deep` → cost line shows Gemini + correct $/eval. Switch back to `claude` → reverts.

### FIX-M8. `Apply checklist` is a static text block, not an interactive checklist
- **Symptoms:** the page is called "Apply checklist", info-box says "checklist + paste-ready text", but the output is a monospace block with `0…7` items the user cannot tick.
- **Fix:** render each item as `<label><input type="checkbox" /> {text}</label>`. Persist state per-URL in `localStorage[applyChecklist:<urlSlug>] = [0,1,1,0,0,1,1,1]`. Add a "Reset" button. Add a copy-as-markdown button for the unchecked items, so the "paste-ready" promise stays valid.
- **i18n keys:** `apply.checklist.reset`, `apply.checklist.copy_unchecked`, `apply.checklist.item.0` … `apply.checklist.item.7` (8 keys × 8 locales = 64 strings).
- **Acceptance:** generate checklist for `https://example.com/job/789` → tick 3 boxes → reload → those 3 stay ticked. Click Reset → all unticked. Click Copy unchecked → clipboard contains only unticked items as markdown bullets.

### FIX-M9. `Refresh` on Dashboard has no visual feedback
- **Symptoms:** click Refresh → silence. Pipeline / Reports / Applications numbers may or may not have changed; user can't tell.
- **Fix:** after refetch, toast `i18n.t('dashboard.refreshed', { applications, pipeline, reports })` — e.g. EN `Refreshed · 0 applications · 2 pending · 0 reports`.
- **Acceptance:** click Refresh → green toast appears for 2 s with current counters. Numbers update visibly on cards.

---

## 3. i18n long-tail (8-locale parity)

### FIX-I1. `aria-label="Search companies, roles, or URLs"` is English on every locale
- **Fix:** in the top-bar template:
  ```html
  <input aria-label="{{ t('search.aria_label') }}" placeholder="{{ t('search.placeholder') }}">
  ```
- **i18n keys:** `search.aria_label`, `search.placeholder` × 8 locales.

### FIX-I2. `today` chip on Saved-research / Activity / Tracker never localizes
- **Fix:** use `Intl.RelativeTimeFormat` or a small helper:
  ```js
  function relTime(date, locale) {
    const days = Math.floor((Date.now() - +date) / 86400000);
    if (days === 0) return i18n.t('time.today');
    if (days === 1) return i18n.t('time.yesterday');
    if (days < 7) return i18n.t('time.days_ago', { n: days });
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  }
  ```
- **i18n keys:** `time.today`, `time.yesterday`, `time.days_ago` × 8 locales.

### FIX-I3. Help TOC items 2, 5, 13, 14 stay in English on every non-EN locale
- Items that have no exact sidebar `nav.*` counterpart: `App settings & API keys`, `Portals & Sources`, `Mode prompts`, `Apply checklist`.
- **Fix:** add explicit keys: `help.toc.item.2` … `help.toc.item.14` per locale, and reference them by the help-page renderer instead of falling back to the markdown.

### FIX-I4. RU `#/followup` H1 / subtitle contain English `cadence` and `follow-up`
- **Verified:** H1 `Советник по cadence follow-up`, subtitle `ISO-дата (YYYY-MM-DD) — основа для cadence.`
- **Fix:** translate consistently:
  - RU H1: `Советник по ритму касаний`
  - RU subtitle: `ISO-дата (ГГГГ-ММ-ДД) — основа для расчёта ритма.`
- Spot-check all other locales for `cadence` / `follow-up` leakage.

### FIX-I5. RU `#/deep` subtitle ends with English `smart questions`
- **Fix:** RU subtitle: `Брифинг компании: команда, культура, новости, рычаги для переговоров, умные вопросы.`

### FIX-I6. Footer hotkey hint `CTRL+K — search` on Mac
- **Fix:** detect platform once: `const isMac = /Mac|iPad|iPhone/.test(navigator.platform);` and render `isMac ? '⌘K' : 'Ctrl+K'`. Use the same source for the top-bar `<kbd>` chip.
- **Acceptance:** on Mac the footer shows `⌘K — search` / `⌘K — поиск` / `⌘K — 搜索` etc.

---

## 4. UX-debt (Minor) — batch these together

### FIX-U1. CV page heading is a tiny lowercase `cv`
- Replace with a proper H1 + subtitle:
  - H1: `i18n.t('cv.title')` (EN: `Curriculum vitae`)
  - subtitle: `i18n.t('cv.subtitle')` (EN: `Edit cv.md side-by-side with a live preview.`)
- Move the action row (`Upload CV`, `sync-check`, `Generate PDF`, `Save`) below the subtitle, not inline.

### FIX-U2. `#/auto` H1 wraps to 2 lines on common widths
- Remove the emoji from H1 (`✨ Auto-pipeline a URL` → `Auto-pipeline a URL`) and put it as a 24×24 icon next to the title. Same fix for any other H1 that starts with an emoji.

### FIX-U3. Date placeholder `2026-04-21` is frozen 28 days in the past
- Compute on render: `placeholder = today - 14 days`.

### FIX-U4. Pipeline 400-toast leaks endpoint `(POST /api/pipeline · HTTP 400)`
- Wrap the technical detail in a `<details>` toggle. Default toast = `i18n.t('pipeline.invalid_url')`. Click "Details" → reveals `(POST /api/pipeline · HTTP 400)`. Keep the context for debuggability but spare casual users.

### FIX-U5. Dashboard duplicate CTAs
- Audit Dashboard. 4 paths to Pipeline (`Open Pipeline`, sidebar Pipeline, Quick action `📥 Pipeline`, bottom card `Pipeline`) and 4 to Scan. Keep at most 2 per destination (primary card + sidebar). Remove the rest.

### FIX-U6. Scan "✦ Active companies 96/80" needs a tooltip
- Add `title="{enabled} active out of {total} portals (see portals.yml)"`.

### FIX-U7. Verify pipeline ASCII divider `===========…`
- Strip the equals-line in the renderer; replace with a CSS `<hr>` between sections.

### FIX-U8. Generate prompt block dominates the page
- Collapse by default; show first 6 lines + `Show all (n more)` toggle. Or open in a modal with a `Copy to clipboard` button. Persist preference.

### FIX-U9. Pipeline `In queue: N` chip + filter input crammed together
- Add `gap: 1rem` between them; on `< 720 px` stack vertically.

### FIX-U10. Tracker actions enabled at 0 rows
- Disable `Normalize / Dedup / Merge TSV` when the table is empty. Add a tooltip: `Nothing to {action} yet — add an application first.`

### FIX-U11. Tracker `LEGITIMACY` column unexplained
- Add a header `aria-describedby` tooltip: `i18n.t('tracker.col.legitimacy.help')` = `Confidence that the posting is real (High / Caution / Suspicious).`

### FIX-U12. `Filter sections` placeholder on Help truncates on KO/JA
- Increase max-width of the input or shorten the placeholder: `Filter…` on those locales.

### FIX-U13. Toast journal
- Add a `Notifications` icon to the top-bar that opens a drawer listing the last 50 toasts with timestamps. Useful for missed live-eval messages.

### FIX-U14. H1 → subtitle spacing
- Audit: H1 and subtitle on every page should have `margin-block-start: .25rem` between them, not be glued.

### FIX-U15. CV editor: dirty-state indicator
- When the markdown textarea differs from last-saved value, badge the `Save` button with a yellow dot. Title: `Unsaved changes`. After save, dot clears.

---

## 5. Hard rules around tests

For each fix above add at least one of:
- A unit test under `tests/<feature>.test.mjs`
- A Playwright e2e under `tests/e2e/<feature>.spec.mjs`
- A static lint guard (e.g. for "no orphan `</tool_response>` in saved-research output", add a snapshot test that opens an artifact and asserts).

Specifically for **FIX-C1** add:
- `tests/llm-output.test.mjs`:
  - `cleanLlmMarkdown('Hi </tool_response> bye')` → `'Hi bye'`
  - `cleanLlmMarkdown('<tool_call>{}</tool_call>brief')` → `'brief'`
  - `cleanLlmMarkdown` is idempotent (`f(f(x)) === f(x)`).
  - `parseDeepBrief(model_output)` extracts only the substring **after** the last `</tool_response>` and rejects if `< 500` chars or `< 2 H2`.

For **FIX-C2 / FIX-M3** add:
- `tests/i18n-coverage.test.mjs`:
  - asserts `document.documentElement.lang` updates on `i18n.setLocale()`
  - asserts `localStorage['career-ops:lang']` written

For **FIX-M5 / FIX-M6** add:
- Snapshot tests of localized Tracker confirm modal bodies in 8 locales (no Latin operator names inside quotes for non-Latin locales).

For **FIX-M7** add:
- E2E: change `LLM_PROVIDER` → reload `#/deep` → assert cost-line text contains the new provider name.

---

## 6. Locale matrix (must run for every UI change)

| Locale | BCP-47 | RTL? | Smoke route to verify |
|---|---|---|---|
| English | `en` | LTR | `#/dashboard`, `#/help`, `#/deep`, `#/followup` |
| Spanish | `es` | LTR | as above |
| Portuguese (Brazil) | `pt-BR` | LTR | as above |
| Korean | `ko` | LTR | as above |
| Japanese | `ja` | LTR | as above |
| Russian | `ru` | LTR | as above |
| Simplified Chinese | `zh-CN` | LTR | as above |
| Traditional Chinese | `zh-TW` | LTR | as above |

For each locale spot-check:
1. Sidebar items localized.
2. H1 and subtitle localized.
3. Top-bar `aria-label` + placeholder localized.
4. Doctor / Verify / sync-check modal **headers** localized (body stays EN by design, see FIX-M6).
5. Pipeline `+ Add` toasts (empty / invalid / duplicate / success) localized.
6. `#/followup` ISO-date error localized.
7. Markdown blockquote on `#/help` renders bold (no `**` literals).
8. Saved-research card title-date have whitespace between them.

---

## 7. Sign-off checklist (regression after this fix-pass)

| Gate | Pass criterion | ☐ |
|---|---|---|
| FIX-C1 | Deep research saved file starts with `## Company snapshot`, contains all 6 sections, no orphan tags | ☐ |
| FIX-C2 | `<html lang>` matches selected locale; persists across reload | ☐ |
| FIX-M1 | Tab navigation shows visible 2 px outline on every focusable element | ☐ |
| FIX-M2 | No `Running …` toast visible when a result modal is open | ☐ |
| FIX-M3 | First-load locale matches `navigator.languages[0]` if supported | ☐ |
| FIX-M4 | Saved-research cards show `gap` between title and date | ☐ |
| FIX-M5 | Tracker confirm-modal body uses localized operator words on ru/ja/zh-CN | ☐ |
| FIX-M6 | Doctor / Verify / sync-check modals have localized header on non-EN | ☐ |
| FIX-M7 | Cost line reflects `LLM_PROVIDER` value | ☐ |
| FIX-M8 | Apply checklist is interactive checkboxes with localStorage persistence | ☐ |
| FIX-M9 | Refresh on Dashboard shows toast with current counters | ☐ |
| FIX-I1..I6 | All listed strings localized on all 8 locales | ☐ |
| FIX-U1..U15 | Each tracked and re-verified visually | ☐ |
| `npm test` (≥ 896) | green on Node 18/20/22 | ☐ |
| Playwright browser (≥ 58) | green | ☐ |
| smoke e2e (20) + comprehensive e2e (23) | green | ☐ |
| Security invariants (§0.3) | unchanged | ☐ |
| Manual matrix §6 | spot-checked on all 8 locales | ☐ |
| Release / tag `v1.58.3` | published | ☐ |

---

## 8. Repo housekeeping (test artifacts to clean up)

The regression session left these on disk (parent project — but added through the normal `POST /api/pipeline` flow, so it's "user data"):
- `data/pipeline.md` — entries: `https://example.com/job/123`, `https://example.com/regression/dup`
- `reports/software-engineer-general.md` — example of the C-1 bug (keep as snapshot for the test in §5)
- `data/activity.md` — `pipeline.add`, `pipeline.remove`, `script.doctor`, `script.verify-pipeline`, `script.cv-sync-check` rows

Suggested: include a `make clean-test-fixtures` target that wipes those entries by URL pattern.

---

## 9. Out of scope (for v1.58.3, defer to v1.59 / backlog)

- Localizing the underlying CLI scripts (`career-ops doctor`, `verify-pipeline.mjs`, `cv-sync-check.mjs`) — they remain EN-only; only the modal **chrome** is localized.
- Mobile (≤ 420 px) deep audit — the resize harness in this regression session didn't behave; an explicit mobile pass is needed before any mobile-first claims.
- Drag-and-drop reordering of Pipeline / Tracker rows.
- Bulk actions on Pipeline / Tracker (multi-select + delete).
- RTL support (Arabic / Hebrew) — `dir` attribute is set, but no full audit done.

---

## 10. Communication / commit hygiene

- Single PR per fix (or a tightly-scoped group like all FIX-I1..I6 in one i18n PR).
- Commit subject format: `fix(<area>): <one-line>` — e.g. `fix(deep): strip orphan </tool_response> from saved brief (FIX-C1)`.
- Every PR must update the relevant entry in `CHANGELOG.md` under `## [Unreleased]`.
- Cross-reference this document by ID in PR description: `Closes FIX-C1`.

---

*Produced from `career-ops_deep-regression-v1.58.2.md`. Hand off to Claude Code or the human dev.*
