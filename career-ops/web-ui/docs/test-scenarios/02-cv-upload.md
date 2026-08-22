# 02 — CV upload

## Goal

A user can replace their `cv.md` by uploading a file of any commonly used format. The server converts non-markdown formats via `pandoc` (.docx / .doc / .odt / .rtf / .html) or `pdftotext` (.pdf). The result is sanitized through `stripDangerousMarkdown` before reaching disk.

## Preconditions

- Parent project layout present (cv.md, config/profile.yml, …).
- `pandoc` and `pdftotext` available on PATH for non-markdown formats. SPA shows a clear hint when missing.
- Upload size ≤ `MAX_UPLOAD_BYTES` (10 MB).

## Inputs

The SPA's `📁 Upload CV` button opens a file picker that filters on:

```
.md  .markdown  .txt  .html  .htm  .pdf  .docx  .doc  .odt  .rtf
```

When the user picks a file the SPA POSTs to `/api/cv/import` with:

| Header | Value |
|---|---|
| `Content-Type` | `application/octet-stream` |
| `X-Filename` | The original filename (e.g. `cv.docx`) |
| Body | Raw bytes of the file |

## Expected outputs

- `200 OK` with body `{ ok: true, markdown: "<markdown>", sourceFormat: "<ext>", converter: "<name>", sizeBytes: <n> }`.
- The returned markdown contains NO HTML / inline scripts / event handlers (stripped by `stripDangerousMarkdown`).
- The SPA shows a green toast and renders the new markdown in the editor textarea. The user still has to press **Save** to persist.

## Negative cases

| Case | Expected response |
|---|---|
| Body too small or empty | `400 { error: "empty body — upload the file as the request body with X-Filename header" }` |
| Body > 10 MB | `413` from express.raw |
| `Content-Type: multipart/form-data` | `415 { error: "multipart/form-data is not supported", hint: "POST the file bytes directly with Content-Type: application/octet-stream and X-Filename: <name>" }` |
| Octet-stream BUT body bytes start with a multipart preamble (`Content-Disposition: form-data`) | `415 { error: "request body looks like multipart/form-data", hint: "POST the file bytes directly, not a multipart wire envelope" }` |
| Unsupported file extension (e.g. `.exe`) | `422 { ok: false, error: "unsupported format", … }` |
| Pandoc missing on host (only when conversion is required) | `422 { ok: false, error: "pandoc not installed", hint: "brew install pandoc" }` |
| Pdftotext missing on host (only for PDF) | `422 { ok: false, error: "pdftotext not installed", hint: "brew install poppler" }` |

## Test coverage

- `tests/cv-import.test.mjs` — 7 cases covering happy path + every reject case for `importDocumentToMarkdown` (the conversion layer).
- `tests/critical-fixes.test.mjs` — added in v1.10.2:
  - `cv-import rejects multipart Content-Type with 415`
  - `cv-import rejects octet-stream body containing multipart preamble with 415`
  - `cv-import happy path: markdown round-trips losslessly`
- `tests/playwright-full-cycle.mjs` — runs the SPA upload flow against a real markdown fixture.

## Manual steps (Playwright)

1. Open `http://127.0.0.1:4317/#/cv`.
2. Click **📁 Upload CV**.
3. Pick `tests/fixtures/cv-sample.md` (or any `.md` file).
4. Expect a green toast: *"Imported … bytes from cv-sample.md"*.
5. Editor textarea now contains the markdown body. Click **Save**.
6. `GET /api/cv` returns the same markdown.
7. **Negative**: re-upload using curl with `-F file=@cv.md` (multipart). Expect HTTP 415 + the hint text.

## v1.10.2 incident note

Prior to v1.10.2 the route accepted any Content-Type and stored the raw request body. Curl's `-F` (multipart) or any tool defaulting to `multipart/form-data` produced a corrupted `cv.md` that contained the multipart wire envelope (Content-Disposition headers, boundary lines). v1.10.2 added the two 415 paths above and a regression test for each.
