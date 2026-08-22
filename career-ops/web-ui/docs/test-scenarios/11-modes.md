# 11 — Modes

## Goal

Every allowlisted mode template generates a non-empty manual prompt. With an LLM key set + `run: true`, the prompt is executed and the rendered markdown returned.

## Allowlist (server/lib/routes/llm.mjs::MODE_ALLOWLIST)

`batch · contacto · followup · interview-prep · patterns · project · training`

## Inputs

`POST /api/mode/<slug> { …context, run?, lang? }`.

## Expected outputs

- 404 on slugs outside the allowlist or when `modes/<slug>.md` is missing in the parent.
- 200 manual: `{ mode: "manual", slug, prompt, message }`.
- 200 live: `{ mode: "anthropic"|"gemini", slug, prompt, markdown, usage?, code? }`.
- `buildModePrompt` strips `run`, `lang`, `locale` from the rendered JSON context block (verified in `tests/critical-fixes.test.mjs`).

## Test coverage

- `tests/modes-endpoints.test.mjs` — allowlist + 404 + manual prompt shape.
- `tests/full-flow-acceptance.test.mjs` — every allowlisted slug generates a non-empty prompt × 3 iterations.
