# 06 — Config (.env) tab

## Goal

`#/config` shows the canonical list of known runtime keys, masks secrets, lets the user edit allowed keys, and writes back to `.env`. A "Test key" button probes each LLM provider.

## Inputs

- `GET /api/config` → `{ envFile, keys, secretKeys, values }`. Secret values come back masked.
- `POST /api/config { values: { ... } }` — only `KNOWN_KEYS` are honored; everything else is dropped.
- `POST /api/evaluate/test-gemini`, `POST /api/evaluate/test-anthropic` — small probe call (~256 tokens) to verify the key works.

## Expected outputs

| Endpoint | Shape |
|---|---|
| `GET /api/config` | `{ values: { ANTHROPIC_API_KEY: "***", GEMINI_API_KEY: "<unset>", … } }` |
| `POST /api/config` | `{ ok: true, changedKeys: [...] }` — applies live to `process.env` (no restart needed) |
| `POST /api/evaluate/test-anthropic` (key set) | `{ ok: true, sample: "ok", usage: {…} }` |
| `POST /api/evaluate/test-anthropic` (no key) | `400 { ok: false, error: "ANTHROPIC_API_KEY not set" }` |
| Activity log | `config.save` event recorded on successful POST (v1.10.1) |

## Negative cases

| Case | Expected |
|---|---|
| Unknown key in payload | Silently ignored, not written |
| Filesystem read-only | `500 { error: <fs error> }` — Express error handler catches (BF-2 in REVIEW-2026-05-08-v1.9.1) |
| Test probe with bogus key | `200 { ok: false, error: "<provider error>" }` |

## Test coverage

- `tests/config-endpoint.test.mjs` — known-key whitelist + secret masking.
- `tests/anthropic.test.mjs`, `tests/gemini-smoke.test.mjs` — probe routes.
