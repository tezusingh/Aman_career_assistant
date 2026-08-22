/**
 * G-009 (v1.15.0) — `/api/profile` now accepts BOTH the legacy schema
 * (candidate:{full_name,email,linkedin}, target:{roles,comp_total_min_usd})
 * AND the canonical career-ops.org schema (top-level full_name/email/location,
 * target_roles.primary, compensation.target_range, narrative.headline).
 * Legacy fields win when both shapes are present so existing YAML continues
 * to render identically.
 *
 * Isolation: spawn createApp with CAREER_OPS_ROOT set to a tmpdir BEFORE
 * dynamic-importing server/index.mjs so PATHS resolves to the fixture.
 * Mirror tests/batch-endpoints.test.mjs pattern.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let dir;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'profile-canonical-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'),   { recursive: true });
  mkdirSync(resolve(dir, 'modes'),  { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '# Applications\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

async function putProfile(yamlStr) {
  return fetch(baseUrl + '/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml: yamlStr }),
  });
}
async function getProfile() {
  return (await fetch(baseUrl + '/api/profile')).json();
}

test('canonical schema: top-level full_name + location + narrative.headline summarized', async () => {
  const yaml = [
    'full_name: Alice Canonical',
    'email: alice@example.com',
    'location: Lisbon',
    'narrative:',
    '  headline: "Backend engineer who ships."',
    'target_roles:',
    '  primary:',
    '    - "Senior Backend Engineer"',
    '    - "Staff Engineer"',
    'compensation:',
    '  target_range: "$120K-160K"',
  ].join('\n');
  const r = await putProfile(yaml);
  assert.equal(r.status, 200);
  const get = await getProfile();
  assert.equal(get.summary.full_name, 'Alice Canonical');
  assert.equal(get.summary.location, 'Lisbon');
  assert.equal(get.summary.headline, 'Backend engineer who ships.');
  assert.deepEqual(get.summary.target_roles, ['Senior Backend Engineer', 'Staff Engineer']);
  assert.equal(get.summary.comp_min_usd, 120000);
});

test('legacy schema: candidate.{full_name,location} + target.{roles,comp_total_min_usd} still works', async () => {
  const yaml = [
    'candidate:',
    '  full_name: Bob Legacy',
    '  email: bob@example.com',
    '  location: Berlin',
    '  linkedin: https://linkedin.com/in/bob',
    'target:',
    '  roles:',
    '    - "Senior Backend"',
    '  comp_total_min_usd: 100000',
    '  archetypes:',
    '    - { name: "Platform engineer", fit: "high", level: "senior" }',
  ].join('\n');
  const r = await putProfile(yaml);
  assert.equal(r.status, 200);
  const get = await getProfile();
  assert.equal(get.summary.full_name, 'Bob Legacy');
  assert.equal(get.summary.location, 'Berlin');
  assert.equal(get.summary.headline, null);
  assert.deepEqual(get.summary.target_roles, ['Senior Backend']);
  assert.equal(get.summary.comp_min_usd, 100000);
  assert.equal(get.summary.archetypes.length, 1);
});

test('mixed schema: legacy wins when both shapes are present', async () => {
  const yaml = [
    'full_name: Should Lose',
    'location: Should Lose City',
    'candidate:',
    '  full_name: Should Win',
    '  location: Winning City',
    'target:',
    '  roles: ["Legacy Role"]',
    'target_roles:',
    '  primary: ["Canonical Role"]',
  ].join('\n');
  const r = await putProfile(yaml);
  assert.equal(r.status, 200);
  const get = await getProfile();
  assert.equal(get.summary.full_name, 'Should Win');
  assert.equal(get.summary.location, 'Winning City');
  assert.deepEqual(get.summary.target_roles, ['Legacy Role']);
});

test('validation: accepts canonical-only profile (no candidate: block)', async () => {
  const r = await putProfile('full_name: Alice Canonical\nemail: a@b.com\n');
  assert.equal(r.status, 200);
});

test('validation: rejects YAML with neither candidate: nor top-level full_name:', async () => {
  const r = await putProfile('target:\n  roles: ["X"]\n');
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.match(body.error, /full_name/);
});

test('compensation: parses "$120K-160K" → min 120000', async () => {
  await putProfile('full_name: Alice\ncompensation:\n  target_range: "$120K-160K"\n');
  const get = await getProfile();
  assert.equal(get.summary.comp_min_usd, 120000);
});
