# Scenarios 7, 10, 11, 12, 13 — RU baseline

## Scenario 12 — Mode prompts (7 modes via /api/mode/<slug>)

| Slug | Endpoint | Status | mode | Prompt len | Has slug in body |
|---|---|---|---|---|---|
| project | /api/mode/project | 200 | manual | 1440 | yes |
| training | /api/mode/training | 200 | manual | 1286 | yes |
| followup | /api/mode/followup | 200 | manual | 6588 | yes |
| batch | /api/mode/batch | 200 | manual | 4086 | yes |
| contacto | /api/mode/contacto | 200 | manual | 3124 | yes |
| interview-prep | /api/mode/interview-prep | 200 | manual | 7142 | yes |
| patterns | /api/mode/patterns | 200 | manual | 5518 | yes |

**Verdict: PASS — all 7 mode prompts return non-empty text, contain the slug, and respond in manual mode (no key needed).**

## Scenario 13 — Apply checklist (POST /api/apply-helper)

| Assertion | Observed |
|---|---|
| HTTP status | 200 |
| Response keys | `{checklist, message}` |
| Length > 200 | 724 chars ✓ |
| Contains `career-ops apply` | ✓ |
| Contains `NEVER auto-submit` reminder | ✓ |
| Preview | `URL: https://job-boards.greenhouse.io/anthropic/jobs/test\n\n0. Run /career-ops apply in Claude Code with this URL — it will read the form via Playwright.\n1. Verify the posting is still live...` |

**Verdict: PASS.**

## Scenario 11 — Deep research manual (POST /api/deep with mode:'manual')

| Assertion | Observed |
|---|---|
| HTTP status | 200 |
| Response keys | `{mode, prompt, message}` |
| `mode === 'manual'` | ✓ (manual flag IS honored on /api/deep) |
| Length | 593 |
| Contains `Anthropic` | ✓ |
| Contains `Senior Backend Engineer` | ✓ |
| Contains `interview-prep` | ✓ |
| Preview | `You are career-ops in deep-research mode. Produce a full company brief on Anthropic for the role of Senior Backend Engineer.\n\nRead modes/deep.md for structure. Use WebFetch / WebSearch. Cover:\n  1. Co...` |

**Verdict: PASS.**

## Scenario 10 — Reports list (GET /api/reports)

| Assertion | Observed |
|---|---|
| HTTP 200 | ✓ |
| Response shape | `{ reports: [] }` |
| Pagination | client-side only (no `page` / `pageSize` fields in body) |
| Live data | empty (no completed evaluations) |

**Verdict: PASS for empty state.** Pagination + score colour logic is client-side; cannot verify the >12 case because the demo stand had no historical reports.

## Scenario 7 — Evaluate (manual mode) — PARTIAL

Issue: `POST /api/evaluate { mode: 'manual' }` and `{ manual: true }` were both ignored — the route initiated a live Anthropic call (Anthropic key set on this stand). Live calls take 1-3 minutes and twice locked the renderer past the 45s CDP timeout.

**Possible F-009:** The `/api/evaluate` route does not honor a client-supplied `mode: 'manual'` flag the way `/api/deep` does. The user can't force a manual-prompt response when an API key is configured, except by unsetting the key first. This contradicts the prompt-builder pattern used by the seven mode routes and `/api/deep` (which all return manual prompt when asked).

| Sub-case | Status |
|---|---|
| Manual prompt for evaluate | SKIP — endpoint always goes live (cannot opt-out client-side) |
| Live-mode evaluate (~1-3 min) | SKIP — would block this regression run |
| Save JD via `save:true` flag | not tested |
| Pre-fill from `?url=` (SSRF-safe proxy) | not tested |

**Verdict: PARTIAL / SKIP — endpoint exists and responds, but couldn't validate the "manual fallback" path without taking the renderer offline. F-009 filed against the missing manual-flag honor.**
