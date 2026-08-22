# 19 — Help center

## Goal

`#/help` loads the long-form Markdown user guide for the active locale, renders it via the XSS-safe `UI.md`, and builds a sticky table of contents from `<h2>` headings.

## Inputs

- `GET /api/help/:lang` — resolves to `docs/help/<lang>.md` with the v1.10.1 fallback chain (F-002).

## Expected outputs

- `200 { lang: "<resolved>", markdown: "<bundle>" }`.
- The SPA renders headings, lists, links, code fences. Links are gated against `isSafeUrl` (http/https/mailto/tel/relative only).
- TOC built synchronously before insertion so no race condition.

## Bundle resolver order (server/lib/routes/help.mjs)

1. `<lang>.md` exact match (`pt-BR` → `pt-BR.md`).
2. `FILE_ALIASES[<lang>].md` (`ko` → `ko-KR.md`).
3. `<lang.split('-')[0]>.md` (`zh-AA` → `zh.md` if it existed).
4. `en.md` final fallback.

## Negative cases

| Case | Expected |
|---|---|
| `:lang` containing `../` or other path-traversal | Sanitized to `[a-zA-Z0-9_-]+`; falls through resolver, lands on `en.md` |
| Help dir missing entirely | `404 { error: "help docs not found" }` |

## Test coverage

- `tests/help.test.mjs` — bundle endpoint shape.
- `tests/help-ui.test.mjs` — every locale has a real bundle; XSS in markdown stripped.
- `tests/critical-fixes.test.mjs` — `ko` alias resolution, path-traversal sanitization, exact-match `ko-KR`, region-tag fallback.
