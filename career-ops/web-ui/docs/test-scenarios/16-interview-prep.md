# 16 — Interview-prep archive

## Goal

`#/interview-prep` lists every `*.md` in the parent project's `interview-prep/` directory, newest first. User opens a file to read; can delete one.

## Inputs

| Endpoint | Behavior |
|---|---|
| `GET /api/interview-prep` | `{ files: [{ name, size, mtime }] }` newest-first |
| `GET /api/interview-prep/:name` | `{ name, markdown }` |
| `DELETE /api/interview-prep/:name` | `{ ok: true, deleted: <name> }` |

## Negative cases

| Case | Expected |
|---|---|
| `:name` not matching `[\w\-.]+` or not ending `.md` | `400 { error: "invalid name" }` |
| File missing | `404 { error: "not found" }` |

## Test coverage

- `tests/interview-prep.test.mjs` — list / read / delete + the 400 / 404 paths.
