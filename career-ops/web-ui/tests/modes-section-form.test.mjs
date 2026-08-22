/**
 * v1.36.0 (WS6.3) — #/config Modes tab section-merge.
 *
 * `PUT /api/modes/_profile { sections: { "<heading>": "<body>" } }`
 * must replace ONLY the named ## sections; preamble + unknown
 * sections + ordering survive (same merge-not-replace contract as
 * profile fields/arrays). Raw `{ markdown }` path unchanged.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server, baseUrl, dir;
const SEED = `# User Profile Context

<!-- preamble comment — must survive -->

## Your Target Roles

- Senior Backend Engineer

## Your Exit Narrative

Built and sold a SaaS.

## Custom Unknown Section

keep me verbatim
`;

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'modes-sec-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# x\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
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
beforeEach(() => writeFileSync(resolve(dir, 'modes', '_profile.md'), SEED));

const get = () => fetch(baseUrl + '/api/modes/_profile').then((r) => r.json());
const put = (b) => fetch(baseUrl + '/api/modes/_profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const readMd = () => readFileSync(resolve(dir, 'modes', '_profile.md'), 'utf8');

test('GET exposes parsed preamble + sections', async () => {
  const d = await get();
  assert.match(d.preamble, /preamble comment — must survive/);
  const headings = d.sections.map((s) => s.heading);
  assert.deepEqual(headings, ['Your Target Roles', 'Your Exit Narrative', 'Custom Unknown Section']);
});

test('section merge replaces only named section; preamble + others survive', async () => {
  const r = await put({ sections: { 'Your Target Roles': '\n- Staff Platform Engineer\n' } });
  assert.equal(r.status, 200);
  const md = readMd();
  assert.match(md, /preamble comment — must survive/);          // preamble kept
  assert.match(md, /## Your Target Roles\n\n- Staff Platform Engineer/); // replaced
  assert.match(md, /Built and sold a SaaS\./);                  // untouched section
  assert.match(md, /## Custom Unknown Section\n\nkeep me verbatim/); // unknown survives (byte-exact: blank line after heading kept)
});

test('unknown section heading rejected (allow-list = current file headings)', async () => {
  const r = await put({ sections: { 'Nonexistent Section': 'x' } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /unknown _profile\.md section/);
});

test('section ordering preserved after merge', async () => {
  await put({ sections: { 'Your Exit Narrative': '\nNew story.\n' } });
  const headings = (await get()).sections.map((s) => s.heading);
  assert.deepEqual(headings, ['Your Target Roles', 'Your Exit Narrative', 'Custom Unknown Section']);
});

test('legacy raw { markdown } path still works (replaces whole file)', async () => {
  const r = await put({ markdown: '# Fresh\n\n## Only Section\n\nbody\n' });
  assert.equal(r.status, 200);
  assert.match(readMd(), /# Fresh/);
  assert.equal(/Custom Unknown Section/.test(readMd()), false);
});

test('section-merge sanitizes dangerous markdown', async () => {
  const r = await put({ sections: { 'Your Target Roles': '\n<script>alert(1)</script>\n' } });
  assert.equal(r.status, 200);
  assert.equal(/<script>/.test(readMd()), false);
});
