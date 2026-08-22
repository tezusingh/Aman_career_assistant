# F-018 · Scanner architecture itself is split into `/api/stream/scan-en` + `/api/stream/scan-ru` · MAJOR (architecture)

**Severity:** Major (root cause of F-010, F-011, F-014; locks future portal expansion behind a binary geo-tag)
**Module:** `server/lib/routes/runners.mjs` (or wherever the SSE scan runner lives), `server/lib/{en,ru}-scanner.mjs`

## Discovery

When the user clicked "🌐 Сканировать" on `#/scan`, network tab showed:

```
GET /api/stream/scan-en          200  (SSE)
GET /api/stream/scan-ru          200  (SSE)
```

Two parallel SSE streams, one per language family. The result endpoint is also split:

```js
GET /api/scan-results
// → { en: [...], ru: [...] }
```

This means the EN/RU split isn't just hardcoded UI text (F-010) or copy in the help (F-014) — it's the architecture. Every new portal added to the project would have to be classified into one of the two buckets, and a third-language portal (e.g. naukri.com for India, 51job.com for China, jobs.de for Germany) would force an awkward decision: shoehorn it into "EN" because it's not Russian, or fork a new endpoint?

## Fix — collapse to a portal-adapter model with a single SSE stream

### 1. One stream, many adapters

```js
// server/lib/routes/runners.mjs
app.get('/api/stream/scan', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  // Resolve enabled adapters from portals.yml
  const adapters = await resolveEnabledAdapters();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('start', { adapters: adapters.map(a => a.id), total_companies: countCompanies(adapters) });
  for (const adapter of adapters) {
    send('adapter-start', { id: adapter.id });
    for await (const job of adapter.scan({ titleFilter, signal: req.signal })) {
      send('hit', job);
    }
    send('adapter-done', { id: adapter.id, hits: adapter.lastRunHits });
  }
  send('done', { totalHits: sumHits });
  res.end();
});
```

### 2. Adapters are a registry, not two hand-rolled scanners

```js
// server/lib/portals/registry.mjs (new)
import * as greenhouse from './adapters/greenhouse.mjs';
import * as ashby from './adapters/ashby.mjs';
import * as lever from './adapters/lever.mjs';
import * as workable from './adapters/workable.mjs';
import * as hh from './adapters/hh.mjs';
import * as habr from './adapters/habr.mjs';

export const ALL = [greenhouse, ashby, lever, workable, hh, habr];

export function resolveEnabledAdapters(portalsYml) {
  return ALL.filter(a => a.matches(portalsYml));
}
```

`hh.matches` returns true iff `portals.yml::russian_portals.sources` includes `hh`. Same for habr. No more "this is the EN scanner / this is the RU scanner". An adapter is just code that knows how to ask one ATS for jobs.

### 3. Result shape

```js
// /api/scan-results
{
  bySource: {
    'greenhouse:anthropic': { hits: [...], at: '2026-05-08T20:30:00Z' },
    'greenhouse:gitlab':    { hits: [...], at: '2026-05-08T20:30:00Z' },
    'ashby:linear':         { hits: [...] },
    'hh':                   { hits: [...] },
    'habr':                 { hits: [...] }
  },
  byCompany: { /* derived */ },
  hits: [ /* flat list, sorted by recency */ ]
}
```

Not split by `{ en, ru }`. Front-end filters by adapter id or by source domain.

### 4. UI

`#/scan` source dropdown lists the adapter ids ordered alphabetically, no geo-tag. Active-companies card derived from `bySource` aggregation (see F-011). Single status pill at top of the page:

> 12 sources · 96 companies · last scan 8 minutes ago — 43 new offers added.

## Migration

`en-scanner.mjs` and `ru-scanner.mjs` already exist as in-process modules per CLAUDE.md. Refactor in three commits:

1. Extract per-portal adapters from each existing scanner module into `server/lib/portals/adapters/`. Each adapter exposes `{ id, matches, scan }`.
2. Replace `/api/stream/scan-en` + `/api/stream/scan-ru` with a single `/api/stream/scan` that iterates the adapter registry. Keep the old endpoints as 410 Gone with a hint pointing at the new one.
3. Front-end: collapse the two SSE listeners into one. Replace the `EN: N · RU: N` summary with the new portal-agnostic counter.

## Tests

```js
test('single /api/stream/scan SSE stream emits adapter-start / hit / adapter-done events', async () => {
  // …
});

test('disabling all hh queries drops the hh adapter from /api/stream/scan output', async () => {
  // …
});

test('GET /api/scan-results returns bySource map with portal-id keys, not en/ru', async () => {
  // …
});
```
