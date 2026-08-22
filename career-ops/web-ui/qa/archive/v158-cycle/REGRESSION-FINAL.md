# REGRESSION-FINAL — v1.58.x

Detailed, step-by-step regression plan for the v1.58 QA-report sweep.
Pairs with `FIX-PROMPT-v158.md`. Run **automated first**, then the
**manual matrix**. Locale matrix: en, es, pt-BR, ko, ja, ru, zh-CN,
zh-TW.

---

## A. Automated (must be 100% green before manual)

```
npm test                 # 896/896 unit+integration
npm run test:e2e:browser # Playwright 58/58 (smoke + full-cycle + forms)
npm run test:e2e         # smoke 20/20
npm run test:e2e:full    # comprehensive 23/23
node scripts/check-no-also-leftovers.mjs   # gate clean
```

Targeted suites for this release:

```
node --test tests/qa-report-fixes.test.mjs        # 10/10
node --test tests/llm-output.test.mjs             # 5/5
node --test tests/url-validation.test.mjs         # message wording
node --test tests/config-validation-detail.test.mjs
node --test tests/i18n-coverage.test.mjs          # 8-locale parity
```

CI gate: `ci.yml` must be **success** on Node 18/20/22 (advisory
pre-commit is NOT the gate — v1.58.0 proved this). After tag push,
confirm **Release**, **AI Review**, **CI**, and (dispatched)
**Publish to GitHub Packages** all conclude `success`.

---

## B. Manual matrix (per fix)

### BUG-001 — `#/followup` ISO date
1. `#/followup` → Company `TestCo`, Role `QA`, **Last contact** `not-a-date`, click **⚡ Run live**.
   - EXPECT: blocked, error toast "Last contact must be an ISO date: YYYY-MM-DD …", field focused, **no** network request, **no** spinner.
2. Set Last contact `2026-05-19` → submit.
   - EXPECT: proceeds (manual prompt or live), no validation error.
3. Leave Last contact **empty** → submit.
   - EXPECT: proceeds (field is optional).
4. Repeat (1) on ru / ja / zh-CN — message localized.

### BUG-003 — markdown in blockquotes (all 8 locales)
1. `#/help` → the `> **Audience:** …` card.
   - EXPECT: "Audience:" is **bold**, not literal `**Audience:**`. Inline `` `code` ``, links, *italics* inside any `>` quote render.
2. Switch language → re-check on each of the 8 locales.

### BUG-004 — `#/outreach` alias
1. Navigate to `#/outreach` directly (typed URL).
   - EXPECT: the Outreach (contacto) page renders; sidebar "Outreach" highlighted.
2. `#/contacto` still works (canonical).

### BUG-005 — pipeline duplicate
1. `#/pipeline` → add `https://example.com/job/123` → "In queue: 1".
2. Add the **same** URL again.
   - EXPECT: info toast **"Already in the queue — skipped"** (localized), "In queue" stays 1 (NOT a green "Added").

### BUG-006 — invalid URL message
1. `#/pipeline` → add `not-a-url`.
   - EXPECT: error toast "That doesn't look like a valid job posting URL — it must start with http:// or https:// …" **followed by** `(POST /api/pipeline · HTTP 400)` (context kept by design).
2. `javascript:alert(1)`, `https://example.com/<script>` → rejected (400) — security unchanged.

### BUG-007/008 — doctor/verify modal
1. `#/health` → **Doctor**.
   - EXPECT: progress toast appears, then the result modal opens and the toast is **gone** (no lingering "Running doctor.mjs…"). Modal title matches the **button label** exactly (same casing/locale). Repeat for **Verify**.
2. Repeat on ru / zh-TW.

### BUG-010 — reports empty state
1. Point at a parent with no `reports/` → `#/reports`.
   - EXPECT: H1 + a descriptive **subtitle** (localized `rep.subtitle`), like every other page.

### BUG-002 / UX-032 — fixture profile
1. With a profile whose `candidate.full_name` is `Acceptance Test` (or `Real Person`, `QA`, …): `#/health`.
   - EXPECT: "Profile customized" row = **fail/not-ok**, value mentions "template / test fixture".
2. With a real name containing the word "test" (e.g. `María Testanova`): row = **ok** (NOT false-flagged).
   - NOTE: this is verified via the exact-anchored regex static guard in `qa-report-fixes.test.mjs`; manual check optional.
3. CONFIRM the repo did **not** modify the parent `config/profile.yml` / `cv.md` (hard rule #1).

### Research output formatting (cleanLlmMarkdown)
1. `#/deep` → run a deep-research (any provider) whose model echoes
   tool scaffolding.
   - EXPECT: rendered brief is a clean formatted document — **no**
     `<tool_call>{json}</tool_call>` / `<tool_response>` / `<thinking>`
     blocks; headings/tables/bold all render.
2. **Saved research**: open a brief that was saved *before* v1.58
   (contains leaked scaffolding).
   - EXPECT: it renders clean too (cleaned on serve at
     `GET /api/interview-prep/:name`).
3. Sanity: a brief that legitimately contains a fenced ```code``` block
   mentioning the word "tool_call" in prose keeps that code block.

### AI-review i18n
1. Stop the server, trigger any action from the SPA.
   - EXPECT: toast = localized "Network error" + "(METHOD /path)" +
     localized "the server may be down; run: bash web-ui/bin/start.sh"
     on ru / ja / etc.
2. `#/config` → save a bad PORT.
   - EXPECT: server `details` text is English by design; the SPA
     chrome around it is localized. (Documented decision.)

---

## C. Security / invariants (must still hold)

- `isValidJobUrl` unchanged — loopback / `javascript:` / `file:` /
  script-char URLs still 400 on `/api/pipeline` + `/api/pipeline/preview`.
- CSP / `X-Frame-Options` / `Referrer-Policy` headers unchanged.
- `UI.md()` still escapes-first; `cleanLlmMarkdown` is a scaffolding
  stripper, **not** an HTML sanitizer (UI.md remains the XSS boundary).
- No parent-project files written by code paths (only explicit user
  actions: POST /api/pipeline|tracker, PUT /api/cv|profile, etc.).
- No secrets in logs/toasts; `validateConfig` still never echoes a
  SECRET_KEYS value.

---

## D. Sign-off

| Gate | Result |
|------|--------|
| `npm test` (896) | ☐ |
| Playwright browser (58) | ☐ |
| smoke / comprehensive e2e (20 / 23) | ☐ |
| CI Node 18/20/22 | ☐ |
| Release + Publish v1.58.1 | ☐ |
| Manual matrix B (×8 locales spot-check) | ☐ |
| Security invariants C | ☐ |

Closed in this cycle: I18N-011 (help-TOC localized to sidebar
`nav.*` in all 7 non-EN locales — v1.58.2).
Open backlog after this cycle: I18N-014..019, the UX-02x long-tail
(see FIX-PROMPT §2). Sole cross-repo open item: G-005.
