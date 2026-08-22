# 05 — Profile YAML editor

## Goal

User opens `#/profile`, sees their current `config/profile.yml`, edits in place, clicks **Save**, the server validates as a YAML mapping with a `candidate` key and writes it back.

## Inputs

`PUT /api/profile { yaml: "<text>" }`.

## Expected outputs

- `200 { ok: true, bytes, candidate: "<full_name|null>" }`.
- Disk file starts with `# Career-Ops Profile Configuration\n` (stamped if absent).
- A `profile.save` event lands in `/api/activity` (added in v1.10.1 to close F-008).

## Negative cases

| Case | Expected |
|---|---|
| Empty body | `400 { error: "yaml body required (string under 'yaml' key)" }` |
| Body > 256 KB | `413 { error: "profile yaml too large (max 256 KB)" }` |
| Malformed YAML | `400 { error: "invalid YAML: <parser message>" }` |
| Top-level array | `400 { error: "profile must be a YAML mapping" }` |
| Missing `candidate:` key | `400 { error: "profile.candidate is required" }` |

## Test coverage

- `tests/profile-put.test.mjs` — 7 cases covering happy + each reject.
- `tests/critical-fixes.test.mjs` — `PUT /api/profile` produces a `profile.save` activity event (F-008 verification).
