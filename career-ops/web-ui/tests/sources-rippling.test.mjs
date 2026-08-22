/**
 * Rippling source + adapter (v1.80.0). Per-tenant ATS board API.
 * CI-isolated (fake fetchImpl — no network, no parent project dependency).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ripplingSlugFromCareersUrl,
  buildRipplingEndpoint,
  fetchRippling,
  RIPPLING_CAREERS_HOST_RE,
  RIPPLING_API_HOST,
  API_BASE,
} from '../server/lib/sources/rippling.mjs';
import { ripplingAdapter } from '../server/lib/portals/adapters/rippling.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BOARD_JSON = [
  {
    uuid: 'abc-123',
    name: 'Senior Engineer',
    url: 'https://ats.rippling.com/acme-jobs/jobs/abc-123',
    workLocation: { id: 'wl-1', label: 'San Francisco, CA' },
    created: '2026-06-01T00:00:00Z',
  },
  {
    uuid: 'def-456',
    name: 'Remote Product Manager',
    url: 'https://ats.rippling.com/acme-jobs/jobs/def-456',
    workLocation: 'Remote',
    created: '2026-06-15',
  },
  {
    // no url — should be dropped
    uuid: 'no-url',
    name: 'Ghost Role',
    workLocation: { id: 'w2', label: 'Austin, TX' },
  },
  {
    // no name/title — should be dropped
    uuid: 'no-name',
    url: 'https://ats.rippling.com/acme-jobs/jobs/no-name',
  },
];

const VALID_CAREERS_URL = 'https://ats.rippling.com/acme-jobs/jobs';
const VALID_API_URL = 'https://api.rippling.com/platform/api/ats/v1/board/acme-jobs/jobs';

// ---------------------------------------------------------------------------
// Slug extraction
// ---------------------------------------------------------------------------

test('ripplingSlugFromCareersUrl: extracts slug from /slug/jobs path', () => {
  assert.equal(ripplingSlugFromCareersUrl(VALID_CAREERS_URL), 'acme-jobs');
});

test('ripplingSlugFromCareersUrl: extracts slug from /slug only (no trailing /jobs)', () => {
  assert.equal(ripplingSlugFromCareersUrl('https://ats.rippling.com/my-company'), 'my-company');
});

test('ripplingSlugFromCareersUrl: returns null for non-ats.rippling.com host', () => {
  assert.equal(ripplingSlugFromCareersUrl('https://acme.example.com/jobs'), null);
  assert.equal(ripplingSlugFromCareersUrl('https://rippling.com/jobs'), null);
});

test('ripplingSlugFromCareersUrl: returns null for http (non-https)', () => {
  assert.equal(ripplingSlugFromCareersUrl('http://ats.rippling.com/acme-jobs/jobs'), null);
});

test('ripplingSlugFromCareersUrl: returns null for empty / malformed input', () => {
  assert.equal(ripplingSlugFromCareersUrl(''), null);
  assert.equal(ripplingSlugFromCareersUrl('not-a-url'), null);
});

// ---------------------------------------------------------------------------
// Endpoint transform (careers → API)
// ---------------------------------------------------------------------------

test('buildRipplingEndpoint: transforms slug into api.rippling.com board URL', () => {
  assert.equal(buildRipplingEndpoint('acme-jobs'), VALID_API_URL);
});

test('buildRipplingEndpoint: URL-encodes slug (safety)', () => {
  const ep = buildRipplingEndpoint('my slug');
  assert.ok(ep.includes('my%20slug'));
  assert.ok(ep.startsWith(API_BASE));
});

// ---------------------------------------------------------------------------
// fetchRippling: normalization via fake fetchImpl
// ---------------------------------------------------------------------------

test('fetchRippling: returns 12-field shape, source=rippling', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => BOARD_JSON });
  const jobs = await fetchRippling(VALID_API_URL, { fetchImpl });
  // 2 valid (no-url and no-name dropped)
  assert.equal(jobs.length, 2);
  const [j0] = jobs;

  // 12 fields present
  const REQUIRED = ['id','title','url','company','location','isRemote','workplaceType','salary','date','snippet','relocates','source'];
  for (const f of REQUIRED) {
    assert.ok(Object.hasOwn(j0, f), `missing field: ${f}`);
  }

  assert.equal(j0.title, 'Senior Engineer');
  assert.equal(j0.id, 'rippling-abc-123');
  assert.equal(j0.location, 'San Francisco, CA');
  assert.equal(j0.isRemote, false);
  assert.equal(j0.workplaceType, 'Onsite');
  assert.equal(j0.salary, '');
  assert.equal(j0.snippet, '');
  assert.equal(j0.relocates, false);
  assert.equal(j0.source, 'rippling');
  assert.equal(j0.date, '2026-06-01');
});

test('fetchRippling: remote inference from workLocation string', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => BOARD_JSON });
  const jobs = await fetchRippling(VALID_API_URL, { fetchImpl });
  const remote = jobs.find((j) => j.title === 'Remote Product Manager');
  assert.ok(remote);
  assert.equal(remote.isRemote, true);
  assert.equal(remote.workplaceType, 'Remote');
  assert.equal(remote.location, 'Remote');
  assert.equal(remote.date, '2026-06-15');
});

test('fetchRippling: accepts {jobs: [...]} envelope shape', async () => {
  const wrapped = { jobs: BOARD_JSON };
  const fetchImpl = async () => ({ ok: true, json: async () => wrapped });
  const jobs = await fetchRippling(VALID_API_URL, { fetchImpl });
  assert.equal(jobs.length, 2);
});

test('fetchRippling: rejects off-host endpoint (not api.rippling.com)', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [] });
  await assert.rejects(
    () => fetchRippling('https://evil.com/jobs', { fetchImpl }),
    /untrusted hostname/
  );
});

test('fetchRippling: rejects http endpoint', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [] });
  await assert.rejects(
    () => fetchRippling('http://api.rippling.com/platform/api/ats/v1/board/acme/jobs', { fetchImpl }),
    /must use HTTPS/
  );
});

test('fetchRippling: company name falls back to capitalized slug from path', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [BOARD_JSON[0]] });
  const jobs = await fetchRippling(VALID_API_URL, { fetchImpl });
  // slug is 'acme-jobs'; capitalized first letter
  assert.equal(jobs[0].company, 'Acme-jobs');
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

test('adapter.matches: true for careers_url on ats.rippling.com', () => {
  assert.ok(ripplingAdapter.matches({ careers_url: VALID_CAREERS_URL }));
});

test('adapter.matches: true for provider=rippling even without URL', () => {
  assert.ok(ripplingAdapter.matches({ provider: 'rippling' }));
});

test('adapter.matches: false for non-rippling host', () => {
  assert.equal(ripplingAdapter.matches({ careers_url: 'https://acme.com/jobs' }), false);
});

test('adapter.matches: false for empty company', () => {
  assert.equal(ripplingAdapter.matches({}), false);
});

test('adapter.buildEndpoint: transforms careers_url to api.rippling.com board URL', () => {
  assert.equal(
    ripplingAdapter.buildEndpoint({ careers_url: VALID_CAREERS_URL }),
    VALID_API_URL
  );
});

test('adapter.buildEndpoint: returns null for non-rippling URL', () => {
  assert.equal(
    ripplingAdapter.buildEndpoint({ careers_url: 'https://acme.example.com/jobs' }),
    null
  );
});

// ---------------------------------------------------------------------------
// Exported constants sanity
// ---------------------------------------------------------------------------

test('RIPPLING_CAREERS_HOST_RE matches ats.rippling.com only', () => {
  assert.ok(RIPPLING_CAREERS_HOST_RE.test('ats.rippling.com'));
  assert.ok(!RIPPLING_CAREERS_HOST_RE.test('rippling.com'));
  assert.ok(!RIPPLING_CAREERS_HOST_RE.test('evil.ats.rippling.com.evil.com'));
});

test('RIPPLING_API_HOST and API_BASE constants are correct', () => {
  assert.equal(RIPPLING_API_HOST, 'api.rippling.com');
  assert.equal(API_BASE, 'https://api.rippling.com/platform/api/ats/v1/board');
});
