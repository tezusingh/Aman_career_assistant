# 03 — CV edit / save / sanitize round-trip

## Goal

User opens `#/cv`, the editor textarea is populated from `GET /api/cv`, the user edits the markdown body, clicks **Save**, the body round-trips through `stripDangerousMarkdown` and lands at `PROJECT_ROOT/cv.md`.

## Preconditions

- `cv.md` reachable via `PATHS.cv`. Empty body is acceptable (returns `{ markdown: "" }`).

## Inputs

`PUT /api/cv` with `{ markdown: "<text>" }` JSON body. Max 1 MB.

## Expected outputs

- `200 { ok: true, bytes: <n>, sanitized: <bool> }`.
- The disk file matches the sanitized body exactly. `sanitized: true` when the request body differed from the persisted output.
- An `cv.save` event lands in `/api/activity` with `ok: true`.

## Negative cases

| Case | Expected response |
|---|---|
| Empty / whitespace-only body | `400 { error: "markdown body required" }` |
| Body > 1 MB | `413 { error: "markdown too large (max 1MB)" }` |
| `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>`, `<svg>` | Stripped silently; `sanitized: true` |
| `onclick=…`, `onerror=…`, other inline event handlers | Stripped |
| `javascript:`, `vbscript:`, `data:text/html` URL schemes | Stripped |
| Null bytes in body | Stripped |

## Test coverage

- `tests/cv-xss.test.mjs` — every dangerous pattern stripped; safe content preserved.
- `tests/api.test.mjs` — happy round-trip.
- `tests/playwright-full-cycle.mjs` — full SPA Save + GET round-trip.
