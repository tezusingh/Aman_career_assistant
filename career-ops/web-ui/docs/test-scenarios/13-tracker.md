# 13 — Tracker

## Goal

User adds an application to `#/tracker`. Server writes a row to the markdown table in `data/applications.md`. Pipe characters in company / role names survive a write-read round-trip without breaking the table layout (BF-1).

## Inputs

`POST /api/tracker { company, role, score?, status?, url?, reportSlug?, notes?, date? }`.

## Expected outputs

- `200 { ok: true, num: "<padded>", deduped: false }` on new rows.
- `200 { ok: true, deduped: true, existingNum }` if a row with the same case-insensitive `company + role` already exists.
- `tracker.add` event in `/api/activity`.

## Behavior contracts

- `cell()` escapes `|` → `\|` and collapses CR/LF to space on **every** field, not just notes (BF-1 fix from REVIEW-2026-05-08-v1.9.1).
- `parseMarkdownTable` honors the backslash-escape on read; `Acme \| Co` round-trips to `Acme | Co` losslessly.
- `score` accepts `4.5`, `"4.5"`, `"4.5/5"`. Anything else becomes `—`.
- `status` is constrained to `ALLOWED_STATUSES = ['Evaluated','Applied','Responded','Interview','Offer','Rejected','Discarded','SKIP']`. Anything else → `'Evaluated'`.

## Negative cases

| Case | Expected |
|---|---|
| Missing `company` or `role` | `400 { error: "company and role are required" }` |
| Bogus status | Silently normalized to `'Evaluated'` |
| Bogus score | `'—'` placeholder |

## Test coverage

- `tests/tracker-post.test.mjs` — happy + dedup + cell sanitizer.
- `tests/parsers.test.mjs` — `parseMarkdownTable` with escaped pipes.
- `tests/full-flow-acceptance.test.mjs` — `"Acme | Co iter${N}"` round-trip × 3 iterations.

## Filters (SPA)

- **Status** chip — filters in-memory; resets paginator to page 1.
- **Score** chip — same.
- **Search** — substring over company + role.
- **Paginator** — 25 rows per page (`UI.paginate`), auto-clamps current page when filter shrinks the list.
