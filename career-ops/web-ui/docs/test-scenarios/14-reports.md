# 14 — Reports

## Goal

`#/reports` lists every markdown report in `reports/` (parent project), rendered as a card grid with pagination. A single report opens as a long-form view with a back link.

## Inputs

- `GET /api/reports` → `{ reports: [{ slug, title, score, mtime, size }] }` sorted newest-first.
- `GET /api/reports/:slug` → `{ slug, markdown }`.

## Expected outputs

- Pagination: 12 cards per page (the view-level paginator).
- Empty state when `reports/` is absent or empty.
- Score is parsed from the `Score: X/5` line in each report header (see `parsers.mjs::parseReportHeader`).

## Negative cases

| Case | Expected |
|---|---|
| Slug not matching `[\w\-.]+` | `400 { error: "invalid slug" }` |
| Slug not present | `404 { error: "not found" }` |
| Report missing the canonical header | Title falls back to filename; score becomes `—` |

## Test coverage

- `tests/parsers.test.mjs` — `parseReportHeader` happy + missing header.
- `tests/api.test.mjs` — report list + single-report fetch.
