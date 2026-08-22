/**
 * FIX-H8 — POST /api/tracker appends a row to data/applications.md
 * without the user leaving the UI.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let projectRoot;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'tracker-post-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

beforeEach(() => {
  // Each test starts with an empty applications.md so #-counters and
  // dedup behaviour are deterministic.
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

async function post(body) {
  const res = await fetch(baseUrl + '/api/tracker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('POST /api/tracker bootstraps the table when applications.md is empty', async () => {
  const r = await post({
    company: 'Stripe',
    role: 'Senior Backend Engineer',
    score: '4.5',
    status: 'Evaluated',
    url: 'https://stripe.com/jobs/123',
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.num, '001');
  const md = readFileSync(resolve(projectRoot, 'data', 'applications.md'), 'utf8');
  assert.match(md, /# Applications Tracker/);
  assert.match(md, /\| # \| Date \| Company \|/);
  assert.match(md, /\| 001 \|.*\| Stripe \| Senior Backend Engineer \| 4\.5\/5 \| Evaluated \| ❌/);
});

test('POST /api/tracker increments # across multiple appends', async () => {
  await post({ company: 'A', role: 'r1', score: '4', status: 'Applied' });
  await post({ company: 'B', role: 'r2', score: '4', status: 'Applied' });
  const r3 = await post({ company: 'C', role: 'r3', score: '4', status: 'Applied' });
  assert.equal(r3.body.num, '003');
  const md = readFileSync(resolve(projectRoot, 'data', 'applications.md'), 'utf8');
  for (const n of ['001', '002', '003']) assert.ok(md.includes(`| ${n} |`));
});

test('POST /api/tracker dedups same company+role (case-insensitive)', async () => {
  await post({ company: 'Stripe', role: 'Senior Backend' });
  const dup = await post({ company: 'STRIPE', role: 'senior backend' });
  assert.equal(dup.status, 200);
  assert.equal(dup.body.deduped, true);
  assert.equal(dup.body.existingNum, '001');
});

test('POST /api/tracker rejects missing fields', async () => {
  const r = await post({ company: 'Stripe' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /company and role/);
});

test('POST /api/tracker normalizes invalid status to "Evaluated"', async () => {
  await post({ company: 'X', role: 'Y', status: 'GarbageStatus' });
  const md = readFileSync(resolve(projectRoot, 'data', 'applications.md'), 'utf8');
  assert.match(md, /\| Evaluated \|/);
  assert.ok(!/GarbageStatus/.test(md));
});

test('POST /api/tracker rejects malicious notes (pipe-escape)', async () => {
  await post({ company: 'X', role: 'Y', notes: 'foo | bar | baz' });
  const md = readFileSync(resolve(projectRoot, 'data', 'applications.md'), 'utf8');
  // Pipes inside notes get escaped so the markdown table doesn't break.
  assert.match(md, /foo \\\| bar \\\| baz/);
});
