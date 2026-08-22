/**
 * Activity log — append-only JSONL of state-changing user actions, plus
 * a GET /api/activity endpoint for the in-UI history page.
 *
 * Tests cover:
 *   - middleware writes one line per non-GET API request
 *   - response status is captured (4xx → ok:false)
 *   - target extraction (URL bodies, slug, params)
 *   - reads return newest-first with limit + actionPrefix filter
 *   - reads tolerate corrupt lines (skip & continue)
 *   - GET /api/activity exposes events
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let projectRoot;
let activityPath;
let logActivity;
let readActivity;

before(async () => {
  projectRoot = mkdtempSync(resolve(tmpdir(), 'activity-'));
  mkdirSync(resolve(projectRoot, 'config'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'data'), { recursive: true });
  mkdirSync(resolve(projectRoot, 'modes'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(projectRoot, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(projectRoot, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(projectRoot, 'data', 'applications.md'), '');
  writeFileSync(resolve(projectRoot, 'data', 'pipeline.md'), '# pipeline\n');
  writeFileSync(resolve(projectRoot, 'modes', 'oferta.md'), 'oferta\n');
  process.env.CAREER_OPS_ROOT = projectRoot;
  activityPath = resolve(projectRoot, 'data', 'activity.jsonl');
  ({ logActivity, readActivity } = await import('../server/lib/activity-log.mjs'));
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
  // Each test starts with an empty log so assertions are deterministic.
  if (existsSync(activityPath)) rmSync(activityPath);
});

after(() => {
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

async function postJson(path, body) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// ───────────────────────── pure-function tests ─────────────────────────

test('logActivity writes one JSON-line with required fields', () => {
  logActivity({ action: 'test.event', target: 'foo', ok: true, detail: 'bar' });
  const lines = readFileSync(activityPath, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const evt = JSON.parse(lines[0]);
  assert.equal(evt.action, 'test.event');
  assert.equal(evt.target, 'foo');
  assert.equal(evt.ok, true);
  assert.equal(evt.detail, 'bar');
  assert.match(evt.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test('logActivity clips long detail strings', () => {
  const huge = 'x'.repeat(1000);
  logActivity({ action: 'test', detail: huge });
  const evt = JSON.parse(readFileSync(activityPath, 'utf8').split('\n')[0]);
  assert.ok(evt.detail.length <= 250, `expected clipped, got len=${evt.detail.length}`);
  assert.ok(evt.detail.endsWith('…'), 'expected ellipsis');
});

test('readActivity returns newest first', () => {
  logActivity({ action: 'a' });
  logActivity({ action: 'b' });
  logActivity({ action: 'c' });
  const evts = readActivity({ limit: 10 });
  assert.deepEqual(evts.map((e) => e.action), ['c', 'b', 'a']);
});

test('readActivity respects actionPrefix', () => {
  logActivity({ action: 'pipeline.add' });
  logActivity({ action: 'cv.save' });
  logActivity({ action: 'pipeline.remove' });
  const evts = readActivity({ actionPrefix: 'pipeline.' });
  assert.equal(evts.length, 2);
  assert.ok(evts.every((e) => e.action.startsWith('pipeline.')));
});

test('readActivity tolerates corrupt lines', () => {
  writeFileSync(activityPath, [
    '{"action":"good","ts":"2026-05-03T00:00:00Z"}',
    'NOT JSON',
    '{"action":"also-good","ts":"2026-05-03T00:00:01Z"}',
  ].join('\n') + '\n');
  const evts = readActivity({});
  assert.equal(evts.length, 2);
  assert.deepEqual(evts.map((e) => e.action), ['also-good', 'good']);
});

test('readActivity respects limit', () => {
  for (let i = 0; i < 50; i++) logActivity({ action: 'tick.' + i });
  const evts = readActivity({ limit: 10 });
  assert.equal(evts.length, 10);
  assert.equal(evts[0].action, 'tick.49'); // newest first
});

// ───────────────────────── middleware integration ─────────────────────────

test('POST /api/pipeline gets logged with target=URL', async () => {
  const url = 'https://activity-' + Date.now() + '.example.com/job/1';
  const r = await postJson('/api/pipeline', { url });
  assert.equal(r.status, 200);
  // Allow filesystem write to flush
  await new Promise((r) => setTimeout(r, 50));
  const evts = readActivity({ limit: 5 });
  const hit = evts.find((e) => e.action === 'pipeline.add' && e.target === url);
  assert.ok(hit, `expected pipeline.add for ${url}, got: ${JSON.stringify(evts)}`);
  assert.equal(hit.ok, true);
});

test('PR-5 / F-005: failed mutation requests are NOT logged (audit trail clean)', async () => {
  // Empty body → 400 from the validator.
  // The audit log should record only successful state changes; 400-noise was
  // confusing users and inflating the activity feed (qa/fixes/F-005).
  const before = readActivity({ limit: 50 }).length;
  await postJson('/api/pipeline', {});
  await new Promise((r) => setTimeout(r, 50));
  const after = readActivity({ limit: 50 });
  assert.equal(after.length, before, 'rejected request must not produce an event');
  assert.ok(!after.some((e) => e.action === 'pipeline.add' && e.ok === false), 'no ok:false events from 4xx');
});

test('GET /api/activity exposes the events', async () => {
  logActivity({ action: 'manual.event', target: 'manual-target' });
  const res = await fetch(baseUrl + '/api/activity?limit=10');
  const data = await res.json();
  assert.ok(Array.isArray(data.events));
  const hit = data.events.find((e) => e.action === 'manual.event');
  assert.ok(hit);
  assert.equal(hit.target, 'manual-target');
});

test('GET /api/activity is itself NOT logged (no recursion)', async () => {
  logActivity({ action: 'seed' });
  await fetch(baseUrl + '/api/activity');
  await new Promise((r) => setTimeout(r, 50));
  const evts = readActivity({});
  assert.ok(!evts.some((e) => e.action.startsWith('activity')), 'activity reads must not log themselves');
});
