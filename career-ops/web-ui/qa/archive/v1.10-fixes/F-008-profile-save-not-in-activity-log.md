# F-008 · Profile YAML saves don't appear in /api/activity · MINOR

**Severity:** Minor (audit gap)
**Module:** activity logger on the `PUT /api/profile` route

## Repro

```bash
# Issue 5 successful PUT /api/profile { yaml: ... } → 200
# Then:
curl http://127.0.0.1:4317/api/activity | jq '.events | map(.action) | group_by(.) | map({a: .[0], n: length})'
```

Observe: action types include `cv.save`, `pipeline.add`, `pipeline.remove`, `tracker.add` — but not `profile.save` / `config.save`.

## Why this matters

The Help (section 16) lists what the activity log records:

> Records: pipeline adds, tracker writes, **CV saves**, JD saves, evaluate runs, deep-research runs, scan runs, **config changes**, mode runs.

Profile YAML edits are config changes (they overwrite `config/profile.yml`), so the audit trail should include them. Today they don't.

## Suggested fix

Wherever `PUT /api/profile` and `POST /api/config` succeed, append a record:

```js
recordActivity('profile.save', { target: 'config/profile.yml', bytes });
recordActivity('config.save', { target: '.env', changed: <key list> });
```

Apply F-005's "validate first, then record" ordering — only log on the success path.
