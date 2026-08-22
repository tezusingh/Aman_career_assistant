# 15 — Activity log

## Goal

Every successful state-changing API call produces one JSON line in `data/activity.jsonl`. `#/activity` renders the feed newest-first with action-prefix chip filters.

## Inputs

- Implicit: every successful `POST/PUT/DELETE` on a mutation route.
- `GET /api/activity?limit=200&actionPrefix=<prefix>` — read API.

## Expected outputs

- Each event: `{ ts, action, target, ok, detail }`.
- v1.10.1 contract (F-005): events with `res.statusCode >= 400` are NOT logged. The middleware early-returns.
- v1.10.1 added (F-008): `profile.save`, `config.save`, `cv.import` event names.

## Action map (server/lib/activity-log.mjs::mapAction)

| Path | Method | Action |
|---|---|---|
| `/api/pipeline` | POST | `pipeline.add` |
| `/api/pipeline` | DELETE | `pipeline.remove` |
| `/api/cv` | PUT | `cv.save` |
| `/api/cv/import` | POST | `cv.import` |
| `/api/profile` | PUT | `profile.save` |
| `/api/config` | POST | `config.save` |
| `/api/jds` | POST | `jd.save` |
| `/api/jds/:name` | DELETE | `jd.delete` |
| `/api/jds/:name` | * | `jd.update` |
| `/api/run/<script>` | POST | `script.<script>` |
| `/api/evaluate` | POST | `evaluate` |
| `/api/deep` | POST | `deep.research` |
| `/api/apply-helper` | POST | `apply.checklist` |
| `/api/tracker` | POST | `tracker.add` |

`GET` requests, the activity endpoint itself, and unknown paths are skipped.

## Storage details

- File: `data/activity.jsonl` — JSON-lines.
- Rotation: when the file exceeds 5 MB, the older half is dropped on the next append.
- Read cap: `MAX_LINES_RETURNED = 500`.

## Test coverage

- `tests/activity-log.test.mjs` — recorder behavior + the v1.10.1 "no log on 4xx" contract.
- `tests/critical-fixes.test.mjs` — `PUT /api/profile` produces `profile.save`; rejected `POST /api/pipeline` produces no event.
