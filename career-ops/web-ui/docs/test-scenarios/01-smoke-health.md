# 01 — Smoke: server starts, health is green, all routes serve

## Goal

A fresh `npm start` (or `bash bin/start.sh`) brings the server up on `127.0.0.1:4317`, every required `/api/*` route responds without 5xx, and `/api/health` reports the running version.

## Preconditions

- Node ≥ 18.
- `package.json` present at the web-ui root.
- Parent project layout at `$CAREER_OPS_ROOT` (or `..`): `cv.md`, `config/profile.yml`, `portals.yml`, `data/applications.md`, `data/pipeline.md`, `modes/oferta.md`. When missing, paths.mjs falls back gracefully but `/api/health` flags warnings.

## Inputs

```bash
npm start &
sleep 2
curl http://127.0.0.1:4317/api/health
```

## Expected outputs

`GET /api/health` returns `{ ok: true, version: "<x.y.z>", parentVersion: "<x.y.z>", warnings: <int>, checks: [...] }`.

Every `required: true` check has `ok: true`. The version field equals `package.json::version`. The web UI is reachable at `http://127.0.0.1:4317/` and serves the SPA shell.

## Negative cases

| Case | Expected behavior |
|---|---|
| Port 4317 already bound | `npm start` aborts with `EADDRINUSE`. The `bin/start.sh` launcher detects this and prints a helpful hint. |
| `cv.md` missing in parent | Health reports `cv.md: required, ok: false`. The UI still loads but `#/cv` shows the empty-state. |
| Required env unreachable / Node < 18 | Health reports `Node version: required, ok: false`. |

## Test coverage

- `tests/health-doctor-unify.test.mjs` — `/api/health` shape + every required check is keyed.
- `tests/health-privacy.test.mjs` — secrets in checks are masked.
- `tests/router.test.mjs` — SPA hash router resolves all 21 known routes incl. the `#/settings` → `#/profile` alias.

## Manual steps (Playwright)

1. `npm start`.
2. `curl -sf http://127.0.0.1:4317/api/health | jq .ok` → `true`.
3. Open `http://127.0.0.1:4317/`.
4. Sidebar lists every section. Click each — none 404 or throw.
5. `#/health` shows the same 8 required checks as the JSON response.
