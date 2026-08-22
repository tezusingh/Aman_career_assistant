# Test scenarios

This directory captures **what** the application is expected to do at every page and **how** the test suite proves it. It is the canonical source of truth that maintainers and contributors consult before changing a route, an endpoint, or a view.

Every scenario file follows the same structure:

| Section | Purpose |
|---|---|
| **Goal** | One sentence about the user outcome |
| **Preconditions** | Files / env / fixtures the scenario assumes |
| **Inputs** | What the user (or test) supplies |
| **Expected outputs** | UI text, files written, HTTP responses |
| **Negative cases** | What MUST fail, and how |
| **Test coverage** | The `tests/*.mjs` file + line range that proves it |
| **Manual steps (Playwright)** | A reproducible browser walkthrough |

## Index

| # | Scenario | File |
|---|---|---|
| 01 | Smoke: server starts, health is green, all routes serve | [01-smoke-health.md](01-smoke-health.md) |
| 02 | CV upload — every accepted format, every reject path | [02-cv-upload.md](02-cv-upload.md) |
| 03 | CV edit / save / sanitize round-trip | [03-cv-edit-save.md](03-cv-edit-save.md) |
| 04 | CV → PDF generation + auto-download | [04-cv-pdf-download.md](04-cv-pdf-download.md) |
| 05 | Profile YAML editor: read, save, validate, restore | [05-profile-yaml.md](05-profile-yaml.md) |
| 06 | Config (.env) tab: read, mask secrets, save, test keys | [06-config-env.md](06-config-env.md) |
| 07 | Scan: launch, stream events, results table, filters | [07-scan.md](07-scan.md) |
| 08 | Pipeline: add, validate, dedup, preview, delete | [08-pipeline.md](08-pipeline.md) |
| 09 | Evaluate (manual + live): JD scoring round-trip | [09-evaluate.md](09-evaluate.md) |
| 10 | Deep research: company brief, manual + live | [10-deep-research.md](10-deep-research.md) |
| 11 | Modes: every allowlisted prompt builder | [11-modes.md](11-modes.md) |
| 12 | Apply checklist | [12-apply-helper.md](12-apply-helper.md) |
| 13 | Tracker: row add, dedup, pipe-name round-trip, filters | [13-tracker.md](13-tracker.md) |
| 14 | Reports: list, paginate, render single report | [14-reports.md](14-reports.md) |
| 15 | Activity log: only successful events, action chips | [15-activity-log.md](15-activity-log.md) |
| 16 | Interview-prep archive: list, read, delete | [16-interview-prep.md](16-interview-prep.md) |
| 17 | JDs: list, save, delete | [17-jds.md](17-jds.md) |
| 18 | i18n: 8 locales, language switch, persistence | [18-i18n.md](18-i18n.md) |
| 19 | Help center: locale alias resolution + content parity | [19-help-center.md](19-help-center.md) |
| 20 | Security: SSRF guard, DNS-rebind, header policy | [20-security.md](20-security.md) |
| 21 | Full funnel: CV → profile → modes → pipeline → tracker → activity, looped | [21-full-funnel.md](21-full-funnel.md) |

## How to run all scenarios

```bash
# Unit + integration (covers most scenarios via fixtures)
npm test

# Smoke + comprehensive E2E (browser-driven via jsdom)
npm run test:e2e
npm run test:e2e:full

# Playwright (real browser; needs `npx playwright install chromium` once)
npm run test:e2e:browser
```

## Adding a new scenario

1. Pick the next free index (`22-…`) and copy [01-smoke-health.md](01-smoke-health.md) as a template.
2. Write the Goal, Preconditions, Inputs, Expected outputs, Negative cases sections first — these are the *contract*.
3. Add the test that proves it: prefer `tests/*.test.mjs` for fast feedback; add a Playwright step only when a real-browser interaction is the actual contract.
4. Add a row to the index above.
