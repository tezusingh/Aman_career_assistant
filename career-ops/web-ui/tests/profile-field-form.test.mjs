/**
 * v1.32.0 (WS1) — #/config Profile field-form merge path.
 *
 * `PUT /api/profile { fields: { "candidate.full_name": … } }` must:
 *   1. Set/merge only the modeled scalar leaves.
 *   2. Leave EVERY other key untouched — arrays (target_roles.archetypes,
 *      narrative.proof_points, narrative.superpowers) AND unknown custom
 *      keys survive a round-trip. (Load-bearing invariant — PLAN R1.)
 *   3. Empty field → leaf removed (clean round-trip, no `phone: ''`).
 *   4. Reject an unknown dotted path (allow-list gate).
 *   5. Reject when the merged object has no full name.
 *   6. Refuse to clobber an existing profile.yml that is invalid YAML.
 *   7. The legacy raw `{ yaml }` path still works unchanged.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

let server;
let baseUrl;
let dir;

const SEED = `# Career-Ops Profile Configuration
candidate:
  full_name: "Jane Smith"
  email: "jane@example.com"
  phone: "+1-555-0123"
target_roles:
  primary:
    - "Senior AI Engineer"
  archetypes:
    - name: "AI/ML Engineer"
      level: "Senior/Staff"
      fit: "primary"
narrative:
  headline: "ML Engineer"
  superpowers:
    - "End-to-end ML pipelines"
  proof_points:
    - name: "Project Alpha"
      hero_metric: "Reduced latency 40%"
compensation:
  target_range: "$150K-200K"
my_custom_unmodeled_key:
  nested: "must survive"
`;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'pf-form-'));
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

beforeEach(() => {
  writeFileSync(resolve(dir, 'config', 'profile.yml'), SEED);
});

function putProfile(body) {
  return fetch(baseUrl + '/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function readProfile() {
  return yaml.load(readFileSync(resolve(dir, 'config', 'profile.yml'), 'utf8'));
}

test('field merge sets the modeled leaf and PRESERVES arrays + unknown keys', async () => {
  const r = await putProfile({ fields: {
    'candidate.full_name': 'Jane Q. Smith',
    'narrative.headline': 'Staff ML lead',
  } });
  assert.equal(r.status, 200);
  const p = readProfile();
  assert.equal(p.candidate.full_name, 'Jane Q. Smith');
  assert.equal(p.narrative.headline, 'Staff ML lead');
  // Untouched survivors:
  assert.equal(p.candidate.email, 'jane@example.com');
  assert.deepEqual(p.target_roles.primary, ['Senior AI Engineer']);
  assert.equal(p.target_roles.archetypes[0].name, 'AI/ML Engineer');
  assert.deepEqual(p.narrative.superpowers, ['End-to-end ML pipelines']);
  assert.equal(p.narrative.proof_points[0].hero_metric, 'Reduced latency 40%');
  assert.equal(p.compensation.target_range, '$150K-200K');
  assert.equal(p.my_custom_unmodeled_key.nested, 'must survive');
});

test('empty field removes the leaf (clean round-trip, no phone: "")', async () => {
  const r = await putProfile({ fields: {
    'candidate.full_name': 'Jane Smith',
    'candidate.phone': '',
  } });
  assert.equal(r.status, 200);
  const p = readProfile();
  assert.equal('phone' in p.candidate, false, 'phone leaf should be deleted, not ""');
  assert.equal(p.candidate.email, 'jane@example.com'); // sibling untouched
});

test('unknown dotted path rejected (allow-list gate)', async () => {
  const r = await putProfile({ fields: { 'candidate.full_name': 'X', 'candidate.ssn': '000' } });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /unknown profile field path: candidate\.ssn/);
});

test('merged object with no full name is rejected', async () => {
  const r = await putProfile({ fields: { 'candidate.full_name': '' } });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /full name is required/i);
});

test('refuses to clobber an existing profile.yml that is invalid YAML', async () => {
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: "x\n  : : :\n');
  const r = await putProfile({ fields: { 'candidate.full_name': 'Safe' } });
  assert.equal(r.status, 409);
  const j = await r.json();
  assert.match(j.error, /not valid YAML/i);
});

test('legacy raw { yaml } path still works unchanged', async () => {
  const r = await putProfile({ yaml: 'candidate:\n  full_name: "Raw Path"\n' });
  assert.equal(r.status, 200);
  const p = readProfile();
  assert.equal(p.candidate.full_name, 'Raw Path');
});

test('field-form value is trimmed before write', async () => {
  const r = await putProfile({ fields: { 'candidate.full_name': '  Trimmed Name  ' } });
  assert.equal(r.status, 200);
  assert.equal(readProfile().candidate.full_name, 'Trimmed Name');
});
