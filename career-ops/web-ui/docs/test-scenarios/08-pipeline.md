# 08 — Pipeline

## Goal

User pastes URLs into `#/pipeline`, server validates each through `isValidJobUrl`, dedups, persists to `data/pipeline.md`. The preview pane fetches the URL server-side and renders a stripped text snippet.

## Inputs

| Endpoint | Body | Behavior |
|---|---|---|
| `GET /api/pipeline` | — | `{ urls: string[] }` |
| `POST /api/pipeline` | `{ url }` | Append (+ dedup) |
| `GET /api/pipeline/preview?url=<u>` | — | Stripped text snippet, ≤ 8 KB |
| `DELETE /api/pipeline` | `?url=` OR `{ url }` | 200 with `{ removed: 1 }` on hit, **404** on miss (v1.10.1 fix) |

## Expected outputs

- `POST` on a new URL returns `{ ok: true, deduped: false, urls: [...] }`.
- `POST` on a known URL returns `{ ok: true, deduped: true, urls: [...] }`.
- `pipeline.add` and `pipeline.remove` events in `/api/activity` (v1.10.1: only on success).

## Negative cases

| Case | Expected |
|---|---|
| `not-a-url` | `400 { error: "invalid url …" }` |
| `javascript:`, `data:text/html`, `file://`, `vbscript:` | `400` |
| Loopback / private IP / IMDS / DNS-rebind via public host that resolves private | `400` (string-side) or `{ status: 0, text: "(blocked: host resolves to private address)" }` (preview proxy DNS check, v1.10.1) |
| Bigger than 2000 chars | `400` |
| Preview > 3 redirects | `(too many redirects: >3)` text body |
| DELETE for unknown URL | `404 { error: "url not found in pipeline" }` |

## Test coverage

- `tests/url-validation.test.mjs` — every reject path + the PR-3 RFC1918 / IMDS / IPv6 set.
- `tests/pipeline-preview.test.mjs` — script stripping, body cap, redirect handling.
- `tests/critical-fixes.test.mjs` — DELETE body / 404 / 400 paths + the DNS-rebind defense via `127.0.0.1.nip.io`.
