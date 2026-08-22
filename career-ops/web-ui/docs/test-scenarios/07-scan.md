# 07 — Scan

## Goal

User opens `#/scan`, optionally narrows results by source (12 entries — 7 EN-region incl. RSS + 5 RU), clicks **🌐 Scan**. The server streams SSE events as adapters work in two sequential phases (ATS → Regional), hits accumulate into a paginated results table, and the user can filter / page through the full set.

## Source surface (current — v1.30.0)

A **single consolidated SSE endpoint** drives both phases:

- `GET /api/stream/scan?source=ats|regional|both` — multi-phase SSE entrypoint (v1.18.0 retired the legacy `scan-en`/`scan-ru` aliases). With `source=both` (default for 🌐 Scan), the server runs the ATS sweep first and emits `done` with `final: false`, then the regional sweep and emits `done` with `final: true`. Clients close the EventSource only on the final `done` (v1.29.2 contract — see `tests/scan-stream-multi-phase.test.mjs`).
- `GET /api/scan/sources` — canonical source registry (`server/lib/sources/registry.mjs`). Returns 12 entries with `{ value, label, region, configKey? }`. The `#/scan` source-filter dropdown rebuilds on mount from this endpoint. Since v1.69.0 (P-14) the registry auto-discovers adapters — adding one = dropping a `<slug>.mjs` with a `meta` export into `server/lib/sources/` (no registry edit).
- `GET /api/scan/regional/config` — effective `russian_portals:` config from `portals.yml`.
- `GET /api/scan-results` — last-scan snapshot + Workday-fallback flag.

Buffered runner alias (kept for parity with non-SSE consumers): `POST /api/run/scan` shells out to the parent's `scan.mjs`.

## Inputs

| Query | Meaning |
|---|---|
| `company=<name>` | Restrict to a single tracked company |
| `dryRun=1` | Skip writing the result to `data/scan-history.tsv` |
| `format=letter` | (Parent `scan.mjs` only) — N/A for in-process scanners |

## SSE events

```
event: start    { script, args }
event: log      { stream: "stdout"|"stderr", line }
event: hit      { company, role, url, source }   # per-vacancy
event: done     { code: 0, hits: <int> }
event: error    { message }
```

## Expected outputs

- New hits appended to `data/scan-history.tsv` (unless `dryRun=1`).
- `GET /api/scan-results` (or the legacy `{en, ru}` shape per route) returns the latest unique hits, sorted newest-first.
- Filters in the SPA table:
  - **Company** dropdown — built from `tracked_companies` in `portals.yml`. Should auto-populate when portals.yml changes (live reload via `GET /api/portals` on view mount).
  - **Source** dropdown — built dynamically from `GET /api/scan/sources` (v1.29.0). Default 12 entries, EN-region first then RU, alphabetical by label within each region: Ashby · Greenhouse · Lever · RSS · SmartRecruiters · Workable · Workday · GeekJob · GetMatch · Habr Career · hh.ru · Trudvsem.
  - **Paginator** (v1.30.0) — replaces the v1.12 "first 200 of N" truncation. 200 rows per page via `UI.paginate({ pageSize: 200 })`. Filter inputs call `pager.reset()` so a deep-page user lands on page 1 when their search narrows the set.
  - **Search** — substring match over role + company.
  - **Score** — numeric range, but only populated when the user evaluates a hit first.

## Negative cases

| Case | Expected |
|---|---|
| Portals.yml empty | Empty company dropdown; "Run" still works against scanner defaults |
| Network failure on one adapter | `event: log { stream: "stderr", line: "<adapter>: <error>" }`; other adapters keep running |
| Client disconnect | Runner SIGTERMs the child (REVIEW-A2) |

## Test coverage

- `tests/en-scanner.test.mjs`, `tests/ru-scanner.test.mjs` — adapter-level fixture replay.
- `tests/portals-bootstrap.test.mjs` — `portals.yml` template parses cleanly.
- `tests/portals-dead.test.mjs` — known-dead slugs stay `enabled: false`.
- `tests/critical-fixes.test.mjs` — full-funnel covers a stubbed scan run.

## Known limitations (recorded for future scope)

- Scan filters are static lists today, not driven by the actual hit corpus. PR-10 of FIX-PROMPT covers dynamic filter rebuilding from `bySource` aggregation.
- Performance with 10k+ hits is untested; current ceiling is empirical-only.
