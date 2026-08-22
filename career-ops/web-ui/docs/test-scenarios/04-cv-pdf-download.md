# 04 — CV → PDF generation + auto-download

## Goal

User clicks **📄 Generate PDF** on `#/cv`, the server renders `cv.md` to HTML, runs Playwright headless Chromium via the parent's `generate-pdf.mjs` script, and the resulting PDF is auto-downloaded to the user's browser. Existing PDFs remain listed on the page.

## Preconditions

- `cv.md` exists in `PROJECT_ROOT`.
- `output/` directory exists or is created.
- Parent project has `playwright` installed AND `chromium` downloaded (`npx playwright install chromium` once per host). Without these, the server reports the error in-stream and the SPA shows a localized hint pointing to the install command.

## Inputs

`GET /api/stream/pdf?format=a4|letter` (SSE). The `format` query is optional; defaults to `a4`. The SPA sends no query — defaults are fine.

## Server behavior (v1.10.2)

1. Verify `cv.md` exists — emit `event: error` if not.
2. `mkdirSync(PATHS.outputDir)`.
3. Read `cv.md` and run it through `cvMarkdownToHtml(md, title)` — a small in-route renderer with print-friendly CSS. The first `# Heading` becomes the HTML `<title>` and goes into the PDF metadata.
4. Write the HTML to `output/cv-input-<TIMESTAMP>.html`.
5. Spawn `generate-pdf.mjs <input.html> <output.pdf> --format=a4` (positional args, the script's documented contract).
6. Stream `event: log` lines as the script runs. On `event: done` with `code === 0`, the new PDF is on disk.
7. The SPA polls `/api/output/pdfs` once after `done`; if the newest PDF name changed, it triggers a browser download via a hidden `<a download>`.

## Expected outputs

- SSE stream emits `start`, `log` lines (📄 Input, 📁 Output, 📏 Format, ATS-normalization stats, “✓ PDF generated”), and `done { code: 0 }`.
- `output/cv-<TIMESTAMP>.pdf` exists.
- `GET /api/output/pdfs` lists the new PDF first (sorted by mtime desc).
- `GET /api/output/pdfs/<name>` returns the file with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="<name>"`.
- The SPA fires a download for the new PDF.

## Negative cases

| Case | Expected behavior |
|---|---|
| `cv.md` missing | SSE `error { message: "cv.md not found in project root" }`; stream ends |
| Playwright / chromium binary missing | Script emits `browserType.launch: Executable doesn't exist…` on stderr. SPA detects via the `ERR_MODULE_NOT_FOUND|playwright/i` regex and shows the localized `cv.pdfNeedsPlaywright` hint with the install command. |
| Stream client disconnects mid-run | Runner SIGTERMs the child, escalates to SIGKILL after `KILL_GRACE_MS` (5 s). No PDF left half-written. |
| Maximum runtime (30 min) exceeded | Runner emits `error { message: "maximum runtime exceeded (1800000ms)" }` and kills the child. |
| `format` query is invalid (not `a4`/`letter`) | Route normalizes to `a4` silently. |
| Auto-download but the script didn't produce a new file | SPA detects `latestPdfName()` unchanged and SKIPS the download. Avoids re-downloading an old PDF on retry. |

## Test coverage

- `tests/output-pdfs.test.mjs` — `GET /api/output/pdfs` list shape, `:name` download with attachment header, 400 / 404 on invalid / missing names.
- `tests/critical-fixes.test.mjs` (added in v1.10.2):
  - `pdf-stream invokes generate-pdf.mjs with input + output positional args`
  - `pdf-stream emits start + done events and produces the rendered HTML`
- `tests/playwright-full-cycle.mjs` exercises the SPA download trigger (skipped when chromium binary is absent on the host).

## Manual steps (Playwright)

1. Ensure `npx playwright install chromium` ran once on the host.
2. Open `http://127.0.0.1:4317/#/cv`.
3. Click **📄 Generate PDF**.
4. Modal opens, shows the script log streaming live (📄 Input → 📏 Format → ATS-normalization → ✓ PDF generated).
5. Toast: *"PDF generated"*.
6. Browser downloads the new PDF automatically (filename `cv-<TIMESTAMP>.pdf`).
7. PDF list under the editor refreshes; the new file appears at the top.

## v1.10.2 incident note

Prior to v1.10.2 the SSE route invoked `generate-pdf.mjs` with **no arguments**. The script printed its `Usage:` line and exited with code 1. The SPA toast still said *"PDF generated"* (because SSE `done` fired regardless of exit code), but no PDF reached disk and the auto-download silently no-op'd. v1.10.2:

- Reads `cv.md`, renders to HTML server-side.
- Writes the HTML under `output/cv-input-<TIMESTAMP>.html`.
- Spawns the script with the required positional args and `--format=a4`.
- Optional `?format=letter` query for US-letter output.
