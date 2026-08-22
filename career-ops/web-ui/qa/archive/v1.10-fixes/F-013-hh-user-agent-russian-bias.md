# F-013 · HH_USER_AGENT exposed as a top-level required-looking config field · MINOR (i18n / UX)

**Severity:** Minor (UX bias, not functional)
**Module:** `#/config` (App settings → API keys & runtime tab) + `/api/config` schema

## Repro

GET `/api/config` returns:

```json
{
  "keys": ["ANTHROPIC_API_KEY","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","HH_USER_AGENT","PORT","HOST"],
  "secretKeys": ["ANTHROPIC_API_KEY","GEMINI_API_KEY"],
  …
}
```

`HH_USER_AGENT` sits between `GEMINI_MODEL` and `PORT` like it's universal infrastructure. Field caption says:

> «Реальный браузерный User-Agent для hh.ru API. Нужен при сканах с не-российских IP.»

This is meaningful only to users scanning the Russian hh.ru API and only from outside Russia. For everyone else (Spanish, Korean, Japanese, Chinese, Brazilian users) it's a confusing field with no relevance.

## Fix

### Option A (recommended) — collapse under "Advanced / regional sources"

```js
// /api/config schema gains a category:
{
  keys: [
    { id: 'ANTHROPIC_API_KEY',   group: 'core',     secret: true },
    { id: 'ANTHROPIC_MODEL',     group: 'core' },
    { id: 'GEMINI_API_KEY',      group: 'core',     secret: true },
    { id: 'GEMINI_MODEL',        group: 'core' },
    { id: 'PORT',                group: 'runtime' },
    { id: 'HOST',                group: 'runtime' },
    { id: 'HH_USER_AGENT',       group: 'regional', portal: 'hh.ru' }
  ]
}
```

Render in `#/config` as three sections:
- **Core API keys** (always visible)
- **Runtime** (always visible)
- **Regional sources** (collapsed by default; only expanded if `russian_portals.sources` is non-empty in `portals.yml`)

### Option B — auto-hide entirely when russian_portals is disabled

In `portals.yml`, if `russian_portals.sources` is empty (or `enabled: false`), the server omits HH_USER_AGENT from `/api/config.keys`. The user only sees the field if they've explicitly opted into hh.ru scanning.

### Option C — generic regional adapter pattern

Make hh.ru one of many regional sources. The config field then becomes part of an extensible `portal_credentials` map:

```yaml
# portals.yml
portal_credentials:
  hh:    { user_agent: ${HH_USER_AGENT} }
  habr:  { token: ${HABR_TOKEN} }
  # future:
  # naukri: { api_key: ${NAUKRI_KEY} }
  # 51job:  { user_agent: ${WUYIJOB_UA} }
```

The config UI auto-renders fields based on `portal_credentials` keys present in `portals.yml`, so adding a regional portal in the future doesn't require a UI patch.

## Help section 6 also needs an edit

Current Russian help text:

> «`HH_USER_AGENT` — Реальный браузерный User-Agent для hh.ru API. Нужен при сканах с не-российских IP.»

Should move from "Recognized keys" to "Regional sources (optional)" and be conditionally rendered only when russian_portals is enabled.

## Test

```js
test('HH_USER_AGENT not surfaced when russian_portals disabled', () => {
  writePortalsYaml({ russian_portals: { sources: [] }, tracked_companies: [] });
  const cfg = await fetch('/api/config').then(r => r.json());
  assert.equal(cfg.keys.includes('HH_USER_AGENT'), false);
});
```
