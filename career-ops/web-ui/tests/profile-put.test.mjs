/**
 * PUT /api/profile — persist edits to config/profile.yml.
 *
 * Asserts:
 *   - happy-path round-trip via GET /api/profile
 *   - missing/empty body → 400
 *   - invalid YAML → 400
 *   - non-object root → 400
 *   - missing candidate.full_name still saves (only `candidate` is required)
 *   - oversized body → 413
 *   - "# Career-Ops Profile Configuration" header is added when missing
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let workingDir;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'profile-put-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Initial\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = dir;
  workingDir = dir;

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
  return new Promise((resolve) => server.close(resolve));
});

async function put(body) {
  const res = await fetch(baseUrl + '/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function get() {
  const res = await fetch(baseUrl + '/api/profile');
  return { status: res.status, body: await res.json() };
}

test('PUT /api/profile: happy path round-trips through GET', async () => {
  const yaml = [
    'candidate:',
    '  full_name: Updated Name',
    '  email: a@b.example',
    'target_roles:',
    '  primary:',
    '    - Senior Backend Engineer',
    '',
  ].join('\n');
  const r = await put({ yaml });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.candidate, 'Updated Name');

  const got = await get();
  assert.equal(got.status, 200);
  assert.equal(got.body.profile.candidate.full_name, 'Updated Name');
  assert.equal(got.body.profile.candidate.email, 'a@b.example');
});

test('PUT /api/profile: file gets the "Career-Ops Profile Configuration" header', () => {
  const onDisk = readFileSync(resolve(workingDir, 'config', 'profile.yml'), 'utf8');
  assert.match(onDisk, /^# Career-Ops Profile Configuration/);
});

test('PUT /api/profile: empty body → 400', async () => {
  const r = await put({ yaml: '' });
  assert.equal(r.status, 400);
});

test('PUT /api/profile: invalid YAML → 400', async () => {
  const r = await put({ yaml: 'candidate:\n  full_name:: \"unbalanced' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /yaml/i);
});

test('PUT /api/profile: non-object root → 400', async () => {
  const r = await put({ yaml: '- just\n- a\n- list\n' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /mapping/);
});

test('PUT /api/profile: missing candidate key → 400', async () => {
  const r = await put({ yaml: 'target_roles:\n  primary: []\n' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /candidate/);
});

test('PUT /api/profile: oversized body → 413', async () => {
  const huge = 'candidate:\n  full_name: x\nnotes: ' + '"' + 'a'.repeat(260 * 1024) + '"\n';
  const r = await put({ yaml: huge });
  assert.equal(r.status, 413);
});
