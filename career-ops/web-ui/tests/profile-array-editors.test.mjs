/**
 * v1.35.0 (WS6.4) — #/config Profile structured array editors.
 *
 * `PUT /api/profile { arrays: { "target_roles.archetypes": [...] } }`
 * must merge ONLY the modeled array leaves, preserving everything else
 * (scalars from WS1, unknown keys, other arrays). Same load-bearing
 * invariant as tests/profile-field-form.test.mjs but for arrays.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

let server, baseUrl, dir;
const SEED = `# Career-Ops Profile Configuration
candidate:
  full_name: "Jane Smith"
  email: "jane@example.com"
target_roles:
  primary:
    - "Senior AI Engineer"
  archetypes:
    - name: "AI/ML Engineer"
      level: "Senior"
      fit: "primary"
narrative:
  headline: "ML Engineer"
  superpowers:
    - "End-to-end ML"
  proof_points:
    - name: "Alpha"
      url: "https://x.dev/a"
      hero_metric: "40% faster"
my_custom_key:
  keep: "this"
`;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'pf-arr-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
after(() => { delete process.env.CAREER_OPS_ROOT; return new Promise((r) => server.close(r)); });
beforeEach(() => writeFileSync(resolve(dir, 'config', 'profile.yml'), SEED));

const put = (b) => fetch(baseUrl + '/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const read = () => yaml.load(readFileSync(resolve(dir, 'config', 'profile.yml'), 'utf8'));

test('string-array merge replaces leaf, preserves scalars + unknown keys', async () => {
  const r = await put({ fields: { 'candidate.full_name': 'Jane Smith' }, arrays: { 'target_roles.primary': ['Staff ML', 'Principal AI'] } });
  assert.equal(r.status, 200);
  const p = read();
  assert.deepEqual(p.target_roles.primary, ['Staff ML', 'Principal AI']);
  assert.equal(p.candidate.email, 'jane@example.com');         // WS1 scalar untouched
  assert.equal(p.target_roles.archetypes[0].name, 'AI/ML Engineer'); // sibling array untouched
  assert.equal(p.my_custom_key.keep, 'this');                  // unknown key survives
});

test('object-array (archetypes) keeps only allow-listed sub-keys, drops empty rows', async () => {
  const r = await put({ fields: { 'candidate.full_name': 'Jane Smith' }, arrays: { 'target_roles.archetypes': [
    { name: 'Backend Lead', level: 'Staff', fit: 'primary', injected: 'DROP ME' },
    { name: '', level: '', fit: '' },
  ] } });
  assert.equal(r.status, 200);
  const a = read().target_roles.archetypes;
  assert.equal(a.length, 1);
  assert.deepEqual(a[0], { name: 'Backend Lead', level: 'Staff', fit: 'primary' });
  assert.equal('injected' in a[0], false);
});

test('empty array → leaf removed (clean round-trip)', async () => {
  const r = await put({ fields: { 'candidate.full_name': 'Jane Smith' }, arrays: { 'narrative.superpowers': [] } });
  assert.equal(r.status, 200);
  const p = read();
  assert.equal('superpowers' in p.narrative, false);
  assert.equal(p.narrative.headline, 'ML Engineer'); // sibling scalar untouched
});

test('proof_points round-trips name/url/hero_metric', async () => {
  const r = await put({ fields: { 'candidate.full_name': 'Jane Smith' }, arrays: { 'narrative.proof_points': [
    { name: 'Beta', url: 'https://x.dev/b', hero_metric: '2k stars' },
  ] } });
  assert.equal(r.status, 200);
  assert.deepEqual(read().narrative.proof_points[0], { name: 'Beta', url: 'https://x.dev/b', hero_metric: '2k stars' });
});

test('unknown array path rejected (allow-list gate)', async () => {
  const r = await put({ fields: { 'candidate.full_name': 'X' }, arrays: { 'narrative.evil': [1] } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /unknown profile array path: narrative\.evil/);
});

test('combined fields + arrays in one request', async () => {
  const r = await put({ fields: { 'candidate.full_name': 'Combo', 'narrative.headline': 'New HL' }, arrays: { 'target_roles.primary': ['Only Role'] } });
  assert.equal(r.status, 200);
  const p = read();
  assert.equal(p.candidate.full_name, 'Combo');
  assert.equal(p.narrative.headline, 'New HL');
  assert.deepEqual(p.target_roles.primary, ['Only Role']);
});

test('arrays-only request (no fields) still validates full-name from existing file', async () => {
  const r = await put({ arrays: { 'narrative.superpowers': ['Solo'] } });
  assert.equal(r.status, 200); // SEED already has candidate.full_name
  assert.deepEqual(read().narrative.superpowers, ['Solo']);
});
