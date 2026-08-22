# F-015 · `📄 Generate PDF` button only on `#/cv`; missing where users want PDFs · MINOR

**Severity:** Minor (workflow friction)
**Module:** `web-ui/public/js/views/{reports,evaluate,deep,interview-prep}.js`

## What I checked

Walked 9 pages, looked for any button containing the substring "PDF":

```js
[ '/#/cv', '/#/reports', '/#/evaluate', '/#/deep',
  '/#/interview-prep', '/#/dashboard', '/#/tracker', '/#/apply', '/#/followup' ]
```

Result: only `/#/cv` shows `📄 Сгенерировать PDF`. All eight other pages have **no** PDF button. From the workflow described in Help §1.21, users want PDF deliverables in three places where it isn't offered today:

1. **`#/reports/<slug>`** — the saved JD evaluation. Recruiters want this as a PDF attachment.
2. **`#/deep` / `interview-prep/<co>-<role>.md`** — the company brief. Useful as a printable one-pager before an interview.
3. **`#/evaluate`** result panel — a one-shot evaluation worth printing without saving first.

## Fix

### 1. Add `📄 Generate PDF` to the three target pages

Wire each new button to a route-specific PDF generator. The CV path already calls `generate-pdf.mjs` via `/api/run/generate-pdf` (or similar streaming endpoint). Mirror that for:

- `POST /api/pdf/report?slug=<reports-slug>` → renders `reports/<slug>.md` to `output/<slug>.pdf` and streams progress.
- `POST /api/pdf/deep?company=<co>&role=<role>` → renders `interview-prep/<co>-<role>.md`.
- `POST /api/pdf/evaluate` (body: { markdown }) → ad-hoc render of an unsaved evaluation result.

All three reuse the same Playwright pipeline (just swap the input markdown file). On the front-end, each page's PDF button:
1. Streams SSE log into a modal.
2. On `done`, the `output/*.pdf` file auto-downloads via the same `<a download>` trick used today on `#/cv`.
3. Persists a small "PDFs generated" history list at the bottom of the page (mirror the CV page widget).

### 2. Distinguish "run prompt" from "generate PDF"

The user noted: today on some flows the button "выполняется промт" but no PDF actually downloads. Specifically on `#/deep` and the seven `#/<mode>` pages, `⚡ Запустить вживую` runs the LLM but the user has no one-click way to convert the result to PDF afterward. Add a secondary `📄 Generate PDF` button to the result panel that appears once the LLM returns. The flow:

```
User clicks ⚡ Run live  →  result markdown rendered on page
                                    │
                                    ▼
                User clicks 📄 Generate PDF (now visible)
                                    │
                                    ▼
                         generate-pdf.mjs fed the result md
                                    │
                                    ▼
                              PDF auto-downloads
```

This means **PDF generation always produces a downloadable PDF**, never just runs a prompt. (User's exact wording: «при генерации PDF нужно, чтобы скачивался PDF, а не просто выполнялся промпт».)

### 3. Locale matters

Button label should localize. Today `#/cv` is correctly i18n-keyed (RU shows «📄 Сгенерировать PDF», EN shows «📄 Generate PDF»). New buttons must use the same key:

```json
{
  "common.generatePdf": "Generate PDF",  // EN
  "common.generatePdf": "Сгенерировать PDF"  // RU
  // …7 more
}
```

## Test

```js
test('every result-bearing page exposes a Generate PDF button', async () => {
  for (const route of ['/#/cv','/#/reports/:slug','/#/deep','/#/interview-prep/:slug','/#/evaluate?result=1']) {
    const html = renderRoute(route);
    assert.match(html, /Generate PDF|Сгенерировать PDF|Generar PDF|生成 PDF|PDF を生成/);
  }
});
```
