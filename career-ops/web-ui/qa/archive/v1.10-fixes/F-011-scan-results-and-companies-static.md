# F-011 · "Active companies" + source list don't auto-update from scan results · MAJOR (UX)

**Severity:** Major (correctness vs. user expectation)
**Module:** `#/scan` view + `/api/portals` response usage
**Confirmed on:** v1.10.0

## Repro

1. Open `#/scan`. Note the "Активные компании 96/80" pill (96 enabled out of 80 listed) and the source dropdown (Greenhouse / Ashby / Lever / hh.ru / Habr).
2. Click `🌐 Сканировать`. Scan completes and results render in the lower table.
3. Re-open `#/scan` (or simply observe before/after): both panels are unchanged.

The "Active companies" section is sourced **statically** from `portals.yml::tracked_companies` regardless of what the scan actually found. If a scan returns 0 hits for `Anthropic` and 30 hits for `Stripe` (not in `tracked_companies`), neither fact is reflected in either panel.

## What the user expects

- **Active companies** should be a *living* set: companies that produced ≥ 1 hit during the most recent scan window (last N days), not a hand-curated portals.yml list.
- **Source list** should grow as the scanner discovers new ATSes (e.g. Workable, SmartRecruiters, Workday) — not stay frozen at five built-in adapters.

## Concrete fix

### Active companies — derive from scan history

```js
// server/lib/scan-stats.mjs (new)
function computeActiveCompanies({ trackedCompanies, lastScans }) {
  const hitsByCo = new Map();
  for (const scan of lastScans) {
    for (const job of scan.jobs) {
      hitsByCo.set(job.company, (hitsByCo.get(job.company)||0) + 1);
    }
  }
  return trackedCompanies.map(c => ({
    ...c,
    last_hits: hitsByCo.get(c.name) || 0,
    last_scanned_at: lastScans.find(s => s.companies.includes(c.name))?.timestamp ?? null
  })).sort((a,b) => b.last_hits - a.last_hits);
}

// /api/portals shape grows:
//   { portals: { tracked_companies: [...], russian_portals: {...} },
//     stats: { active: [...], inactive: [...] } }
```

Render the active-companies section from `stats.active` instead of `portals.tracked_companies`. The collapsible header becomes:

> ▸ Active companies — 12/96 hit results in the last scan

### Source list — derive from portal adapters + last-scan metadata

`server/lib/portals/registry.mjs` should expose:

```js
export const ADAPTERS = [
  { id: 'greenhouse',  match: /job-boards\.greenhouse\.io/, label: 'Greenhouse' },
  { id: 'ashby',       match: /jobs\.ashbyhq\.com/,         label: 'Ashby' },
  { id: 'lever',       match: /jobs\.lever\.co/,            label: 'Lever' },
  { id: 'workable',    match: /apply\.workable\.com/,       label: 'Workable' },
  { id: 'smartrec',    match: /smartrecruiters\.com/,       label: 'SmartRecruiters' },
  { id: 'workday',     match: /\.myworkdayjobs\.com/,       label: 'Workday' },
  { id: 'hh',          host: 'api.hh.ru',                  label: 'hh.ru' },
  { id: 'habr',        host: 'career.habr.com',            label: 'Habr Career' }
];
```

The source dropdown on `#/scan` is built from `ADAPTERS` filtered to "those that have produced at least one hit in `data/last-scan.json`", with the rest greyed out.

### After-scan refresh

After every successful scan, the front-end should re-fetch `/api/portals?with=stats` (or subscribe to the SSE stream's `complete` event) and re-render both panels. Today the UI re-fetches results but not the active-companies / source widgets — that's why they stay frozen.

## Bonus: more tracked companies

The user explicitly asked to "make more sources, valid". The current 80-company list is heavily Bay-Area + Berlin biased. A reasonable expansion list, all with public boards-api endpoints (no scrape needed):

```yaml
# Greenhouse boards-api (every example below works at https://boards-api.greenhouse.io/v1/boards/<slug>/jobs)
- { name: GitLab,         careers_url: https://job-boards.greenhouse.io/gitlab,         api: https://boards-api.greenhouse.io/v1/boards/gitlab/jobs,         enabled: true }
- { name: HashiCorp,      careers_url: https://job-boards.greenhouse.io/hashicorp,      api: https://boards-api.greenhouse.io/v1/boards/hashicorp/jobs,      enabled: true }
- { name: Cloudflare,     careers_url: https://job-boards.greenhouse.io/cloudflare,     api: https://boards-api.greenhouse.io/v1/boards/cloudflare/jobs,     enabled: true }
- { name: Datadog,        careers_url: https://job-boards.greenhouse.io/datadog,        api: https://boards-api.greenhouse.io/v1/boards/datadog/jobs,        enabled: true }
- { name: Stripe,         careers_url: https://job-boards.greenhouse.io/stripe,         api: https://boards-api.greenhouse.io/v1/boards/stripe/jobs,         enabled: true }
- { name: Notion,         careers_url: https://job-boards.greenhouse.io/notion,         api: https://boards-api.greenhouse.io/v1/boards/notion/jobs,         enabled: true }
- { name: Linear,         careers_url: https://jobs.ashbyhq.com/linear,                  api: https://api.ashbyhq.com/posting-api/job-board/linear,            enabled: true }
- { name: Posthog,        careers_url: https://posthog.com/careers,                      api: https://posthog.com/api/jobs,                                     enabled: true }
- { name: Hugging Face,   careers_url: https://apply.workable.com/huggingface,           api: https://apply.workable.com/api/v3/accounts/huggingface/jobs,      enabled: true }
- { name: Replicate,      careers_url: https://jobs.ashbyhq.com/replicate,               api: https://api.ashbyhq.com/posting-api/job-board/replicate,         enabled: true }
- { name: Modal Labs,     careers_url: https://jobs.ashbyhq.com/modal,                   api: https://api.ashbyhq.com/posting-api/job-board/modal,             enabled: true }
- { name: Tabby,          careers_url: https://job-boards.greenhouse.io/tabbyml,         api: https://boards-api.greenhouse.io/v1/boards/tabbyml/jobs,         enabled: true }
- { name: Fly.io,         careers_url: https://fly.io/jobs,                              scan_method: websearch,                                                enabled: true }
- { name: Render,         careers_url: https://render.com/jobs,                          scan_method: websearch,                                                enabled: true }
```

Run `node scripts/portals-health-check.mjs` after adding to confirm reachability.

## Test

```js
test('/api/portals returns stats with last_hits per company', async () => {
  // run a scan first
  // …
  const r = await fetch('/api/portals?with=stats').then(r => r.json());
  assert.ok(r.stats);
  assert.ok(r.stats.active.every(c => 'last_hits' in c));
});
```
