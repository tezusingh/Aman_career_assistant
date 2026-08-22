/**
 * NoFluffJobs source + adapter tests (v1.80.0 parity).
 * CI-isolated: fake fetchImpl only — no live network, no parent project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchNoFluffJobs,
  assertNoFluffUrl,
  API_URL,
  JOB_BASE,
  meta,
} from '../server/lib/sources/nofluffjobs.mjs';
import { nofluffjobsAdapter } from '../server/lib/portals/adapters/nofluffjobs.mjs';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const SAMPLE_POSTINGS = [
  {
    id: 'abc-123',
    url: 'abc-engineer-acme',
    title: 'Senior Backend Engineer',
    name: 'Acme Corp',
    location: { places: [{ city: 'Warsaw' }, { city: 'Kraków' }], fullyRemote: false },
    fullyRemote: false,
    salary: { from: 15000, to: 22000, currency: 'PLN' },
    posted: new Date('2026-06-15').getTime(),
  },
  {
    id: 'xyz-456',
    url: 'xyz-remote-devops',
    title: 'DevOps Engineer',
    name: 'Globex',
    location: { places: [], fullyRemote: true },
    fullyRemote: true,
    salary: null,
    posted: null,
  },
  {
    // missing title → should be filtered out
    id: 'bad-001',
    url: 'bad-job',
    title: '',
    name: 'Bad Co',
    location: {},
    fullyRemote: false,
    salary: null,
    posted: null,
  },
];

function makeFetchImpl(postings = SAMPLE_POSTINGS, ok = true) {
  return async (url, init) => {
    assert.equal(init.method, 'POST', 'request method must be POST');
    assert.ok(init.body, 'request must have a body');
    const parsed = JSON.parse(init.body);
    assert.ok(parsed.criteriaSearch, 'body must contain criteriaSearch');
    assert.ok(parsed.withSalaryMatch === true, 'body must have withSalaryMatch: true');
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => ({ postings }),
    };
  };
}

// ---------------------------------------------------------------------------
// source: fetchNoFluffJobs
// ---------------------------------------------------------------------------

test('fetchNoFluffJobs: uses POST method with correct body shape', async () => {
  // assertion is inside makeFetchImpl — test passes only if POST + criteriaSearch
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.ok(Array.isArray(jobs));
});

test('fetchNoFluffJobs: returns correct number of valid jobs (filters empty title)', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs.length, 2);
});

test('fetchNoFluffJobs: 12-field shape on each job', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  const required = ['id', 'title', 'company', 'url', 'salary', 'location', 'isRemote', 'workplaceType', 'relocates', 'date', 'snippet', 'source'];
  for (const job of jobs) {
    for (const field of required) {
      assert.ok(Object.prototype.hasOwnProperty.call(job, field), `missing field: ${field}`);
    }
  }
});

test('fetchNoFluffJobs: url built from JOB_BASE + slug', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].url, `${JOB_BASE}abc-engineer-acme`);
  assert.equal(jobs[1].url, `${JOB_BASE}xyz-remote-devops`);
});

test('fetchNoFluffJobs: source field is "nofluffjobs"', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.ok(jobs.every((j) => j.source === 'nofluffjobs'));
});

test('fetchNoFluffJobs: id prefixed with "nofluffjobs-"', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.ok(jobs[0].id.startsWith('nofluffjobs-'));
});

test('fetchNoFluffJobs: isRemote false for office jobs, true for remote', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].isRemote, false);
  assert.equal(jobs[1].isRemote, true);
  assert.equal(jobs[1].workplaceType, 'Remote');
});

test('fetchNoFluffJobs: salary formatted as range with currency', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].salary, '15000–22000 PLN');
  assert.equal(jobs[1].salary, '');
});

test('fetchNoFluffJobs: date from epoch ms → YYYY-MM-DD', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].date, '2026-06-15');
  assert.equal(jobs[1].date, '');
});

test('fetchNoFluffJobs: location joins city array', async () => {
  const jobs = await fetchNoFluffJobs(API_URL, { fetchImpl: makeFetchImpl() });
  assert.equal(jobs[0].location, 'Warsaw, Kraków');
});

test('fetchNoFluffJobs: throws on non-ok HTTP response', async () => {
  const badFetch = makeFetchImpl([], false);
  await assert.rejects(
    () => fetchNoFluffJobs(API_URL, { fetchImpl: badFetch }),
    /HTTP 500/,
  );
});

test('fetchNoFluffJobs: throws on unexpected API shape (no postings array)', async () => {
  const weirdFetch = async (_url, init) => {
    assert.equal(init.method, 'POST');
    return { ok: true, json: async () => ({ items: [] }) };
  };
  await assert.rejects(
    () => fetchNoFluffJobs(API_URL, { fetchImpl: weirdFetch }),
    /unexpected API response/,
  );
});

// ---------------------------------------------------------------------------
// source: assertNoFluffUrl (host lock)
// ---------------------------------------------------------------------------

test('assertNoFluffUrl: accepts https://nofluffjobs.com/*', () => {
  assert.equal(assertNoFluffUrl('https://nofluffjobs.com/api/search/posting'), 'https://nofluffjobs.com/api/search/posting');
  assert.equal(assertNoFluffUrl('https://nofluffjobs.com/pl/job/foo'), 'https://nofluffjobs.com/pl/job/foo');
});

test('assertNoFluffUrl: rejects http (non-HTTPS)', () => {
  assert.throws(() => assertNoFluffUrl('http://nofluffjobs.com/api/search/posting'), /must use HTTPS/);
});

test('assertNoFluffUrl: rejects untrusted hostname', () => {
  assert.throws(() => assertNoFluffUrl('https://evil.com/api/search/posting'), /untrusted hostname/);
});

test('assertNoFluffUrl: rejects invalid URL string', () => {
  assert.throws(() => assertNoFluffUrl('not-a-url'), /invalid URL/);
});

// ---------------------------------------------------------------------------
// source: meta export
// ---------------------------------------------------------------------------

test('meta: correct value, label, region', () => {
  assert.equal(meta.value, 'nofluffjobs');
  assert.equal(meta.label, 'NoFluffJobs');
  assert.equal(meta.region, 'en');
});

// ---------------------------------------------------------------------------
// adapter: nofluffjobsAdapter
// ---------------------------------------------------------------------------

test('adapter.matches: true for provider=nofluffjobs', () => {
  assert.ok(nofluffjobsAdapter.matches({ provider: 'nofluffjobs' }));
});

test('adapter.matches: true for careers_url on nofluffjobs.com (https)', () => {
  assert.ok(nofluffjobsAdapter.matches({ careers_url: 'https://nofluffjobs.com/pl/job/x' }));
});

test('adapter.matches: true for api on nofluffjobs.com (https)', () => {
  assert.ok(nofluffjobsAdapter.matches({ api: 'https://nofluffjobs.com/api/search/posting' }));
});

test('adapter.matches: false for http careers_url (not https)', () => {
  assert.equal(nofluffjobsAdapter.matches({ careers_url: 'http://nofluffjobs.com/pl/job/x' }), false);
});

test('adapter.matches: false for unrelated host', () => {
  assert.equal(nofluffjobsAdapter.matches({ careers_url: 'https://greenhouse.io/jobs' }), false);
});

test('adapter.matches: false for empty entry', () => {
  assert.equal(nofluffjobsAdapter.matches({}), false);
});

test('adapter.buildEndpoint: returns API_URL by default', () => {
  assert.equal(nofluffjobsAdapter.buildEndpoint({ provider: 'nofluffjobs' }), API_URL);
  assert.equal(nofluffjobsAdapter.buildEndpoint({ careers_url: 'https://nofluffjobs.com/pl/job/x' }), API_URL);
});

test('adapter.buildEndpoint: respects explicit nofluffjobs override key', () => {
  const override = 'https://nofluffjobs.com/api/search/posting?region=de';
  assert.equal(nofluffjobsAdapter.buildEndpoint({ nofluffjobs: override }), override);
});

test('adapter.buildEndpoint: off-host / non-https override falls back to API_URL', () => {
  assert.equal(nofluffjobsAdapter.buildEndpoint({ nofluffjobs: 'https://evil.com/api/search/posting' }), API_URL);
  assert.equal(nofluffjobsAdapter.buildEndpoint({ nofluffjobs: 'http://nofluffjobs.com/api/search/posting' }), API_URL);
  assert.equal(nofluffjobsAdapter.buildEndpoint({ nofluffjobs: 'not a url' }), API_URL);
});

test('adapter.id and label', () => {
  assert.equal(nofluffjobsAdapter.id, 'nofluffjobs');
  assert.equal(nofluffjobsAdapter.label, 'NoFluffJobs');
});

test('adapter.fetch is fetchNoFluffJobs', () => {
  assert.equal(nofluffjobsAdapter.fetch, fetchNoFluffJobs);
});
