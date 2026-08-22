/**
 * Himalayas source + adapter tests (CI-isolated — fake fetchImpl, no network).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchHimalayas,
  assertHimalayasUrl,
  FEED_URL,
} from '../server/lib/sources/himalayas.mjs';
import { himalayasAdapter } from '../server/lib/portals/adapters/himalayas.mjs';

// ---------------------------------------------------------------------------
// Fake feed payload
// ---------------------------------------------------------------------------
const FAKE_JOBS = [
  {
    id: 'abc123',
    title: 'Senior Go Engineer',
    companyName: 'Acme Corp',
    applicationLink: 'https://himalayas.app/jobs/acme-go',
    guid: 'https://himalayas.app/jobs/acme-go-guid',
    locationRestrictions: ['Europe', 'Americas'],
    pubDate: 1750000000, // epoch seconds
    salary: '$120k–$150k',
  },
  {
    id: 'def456',
    title: 'Backend Developer',
    companyName: 'Globex',
    applicationLink: 'https://himalayas.app/jobs/globex-be',
    guid: null,
    locationRestrictions: ['Worldwide'],
    pubDate: '1749500000', // epoch seconds as string
    salary: '',
  },
  {
    id: 'ghi789',
    title: '  ', // blank title — must be dropped
    companyName: 'DropMe',
    applicationLink: 'https://himalayas.app/jobs/dropme',
    guid: null,
    locationRestrictions: [],
    pubDate: null,
  },
  {
    id: 'jkl000',
    title: 'Evil Role',
    companyName: 'Evil Inc',
    applicationLink: 'https://evil.com/jobs/bad', // wrong host — must be dropped
    guid: 'https://evil.com/jobs/bad-guid',        // also wrong host
    locationRestrictions: [],
    pubDate: null,
  },
];

const fakeOk = async () => ({
  ok: true,
  json: async () => ({ jobs: FAKE_JOBS }),
});

// ---------------------------------------------------------------------------
// fetchHimalayas: shape, normalization, filtering
// ---------------------------------------------------------------------------
test('fetchHimalayas: returns only valid rows', async () => {
  const jobs = await fetchHimalayas(FEED_URL, { fetchImpl: fakeOk });
  // blank title + evil host both dropped → 2 valid rows
  assert.equal(jobs.length, 2);
});

test('fetchHimalayas: 12-field shape on first row', async () => {
  const jobs = await fetchHimalayas(FEED_URL, { fetchImpl: fakeOk });
  const j = jobs[0];
  const fields = ['id', 'title', 'company', 'url', 'salary', 'location',
    'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const f of fields) {
    assert.ok(Object.prototype.hasOwnProperty.call(j, f), `missing field: ${f}`);
  }
});

test('fetchHimalayas: id, title, company, url values', async () => {
  const jobs = await fetchHimalayas(FEED_URL, { fetchImpl: fakeOk });
  assert.equal(jobs[0].id, 'himalayas-abc123');
  assert.equal(jobs[0].title, 'Senior Go Engineer');
  assert.equal(jobs[0].company, 'Acme Corp');
  assert.equal(jobs[0].url, 'https://himalayas.app/jobs/acme-go');
});

test('fetchHimalayas: salary, location array join', async () => {
  const jobs = await fetchHimalayas(FEED_URL, { fetchImpl: fakeOk });
  assert.equal(jobs[0].salary, '$120k–$150k');
  assert.equal(jobs[0].location, 'Europe, Americas');
  assert.equal(jobs[1].salary, '');
  assert.equal(jobs[1].location, 'Worldwide');
});

test('fetchHimalayas: isRemote=true, workplaceType=Remote, relocates=false, snippet=""', async () => {
  const jobs = await fetchHimalayas(FEED_URL, { fetchImpl: fakeOk });
  assert.ok(jobs.every((j) => j.isRemote === true));
  assert.ok(jobs.every((j) => j.workplaceType === 'Remote'));
  assert.ok(jobs.every((j) => j.relocates === false));
  assert.ok(jobs.every((j) => j.snippet === ''));
});

test('fetchHimalayas: source=himalayas on all rows', async () => {
  const jobs = await fetchHimalayas(FEED_URL, { fetchImpl: fakeOk });
  assert.ok(jobs.every((j) => j.source === 'himalayas'));
});

test('fetchHimalayas: date from epoch seconds → YYYY-MM-DD', async () => {
  const jobs = await fetchHimalayas(FEED_URL, { fetchImpl: fakeOk });
  // 1750000000 seconds → 2025-06-15 (UTC)
  assert.match(jobs[0].date, /^\d{4}-\d{2}-\d{2}$/);
  // second row: epoch as string
  assert.match(jobs[1].date, /^\d{4}-\d{2}-\d{2}$/);
});

test('fetchHimalayas: falls back to guid when applicationLink missing', async () => {
  const payload = {
    jobs: [{
      id: 'z1',
      title: 'Fallback Role',
      companyName: 'FallbackCo',
      applicationLink: null,
      guid: 'https://himalayas.app/jobs/fallback',
      locationRestrictions: [],
      pubDate: null,
    }],
  };
  const jobs = await fetchHimalayas(FEED_URL, {
    fetchImpl: async () => ({ ok: true, json: async () => payload }),
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://himalayas.app/jobs/fallback');
});

test('fetchHimalayas: throws on HTTP error', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(
    () => fetchHimalayas(FEED_URL, { fetchImpl }),
    /429/,
  );
});

test('fetchHimalayas: throws on wrong API shape', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ results: [] }) });
  await assert.rejects(
    () => fetchHimalayas(FEED_URL, { fetchImpl }),
    /unexpected API response/i,
  );
});

// ---------------------------------------------------------------------------
// assertHimalayasUrl: host-lock
// ---------------------------------------------------------------------------
test('assertHimalayasUrl: accepts valid FEED_URL', () => {
  assert.equal(assertHimalayasUrl(FEED_URL), FEED_URL);
});

test('assertHimalayasUrl: rejects non-HTTPS', () => {
  assert.throws(
    () => assertHimalayasUrl('http://himalayas.app/jobs/api'),
    /must use HTTPS/,
  );
});

test('assertHimalayasUrl: rejects wrong host', () => {
  assert.throws(
    () => assertHimalayasUrl('https://evil.com/jobs'),
    /untrusted hostname/,
  );
});

test('assertHimalayasUrl: rejects invalid URL string', () => {
  assert.throws(
    () => assertHimalayasUrl('not-a-url'),
    /invalid URL/,
  );
});

// ---------------------------------------------------------------------------
// adapter
// ---------------------------------------------------------------------------
test('adapter: id and label', () => {
  assert.equal(himalayasAdapter.id, 'himalayas');
  assert.equal(himalayasAdapter.label, 'Himalayas');
});

test('adapter: matches only provider=himalayas', () => {
  assert.ok(himalayasAdapter.matches({ provider: 'himalayas' }));
  assert.equal(himalayasAdapter.matches({ provider: 'remotive' }), false);
  assert.equal(himalayasAdapter.matches({ careers_url: 'https://himalayas.app' }), false);
});

test('adapter: buildEndpoint defaults to FEED_URL', () => {
  assert.equal(himalayasAdapter.buildEndpoint({ provider: 'himalayas' }), FEED_URL);
});

test('adapter: buildEndpoint prefers himalayas: field', () => {
  const custom = 'https://himalayas.app/jobs/api?limit=100';
  assert.equal(himalayasAdapter.buildEndpoint({ provider: 'himalayas', himalayas: custom }), custom);
});

test('adapter: buildEndpoint falls back to api: field', () => {
  const custom = 'https://himalayas.app/jobs/api?limit=200';
  assert.equal(himalayasAdapter.buildEndpoint({ provider: 'himalayas', api: custom }), custom);
});
