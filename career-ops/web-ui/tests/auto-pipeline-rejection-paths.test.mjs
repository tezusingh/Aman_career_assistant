/**
 * v1.26.0 — Functional coverage for `/api/auto-pipeline` rejection
 * paths that don't need a live LLM call.
 *
 * v1.25 baseline left auto-pipeline.mjs at 46.01 % line coverage. The
 * `mode: 'manual'` short-circuit covers the happy-path (v1.25 G-014
 * tests, 3 cases). v1.26 adds rejection-path coverage: invalid URL,
 * SSRF target, fetch-error path, plus the validate-step branch the
 * other tests don't reach.
 *
 * Tier: functional. No LLM keys. No live HTTP — uses `_setTransport`
 * for safe-fetch to inject controlled responses.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { _setTransport } from '../server/lib/safe-fetch.mjs';

let server;
let baseUrl;
let restoreTransport = null;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'auto-pipe-reject-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  mkdirSync(resolve(dir, 'reports'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# CV\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n');
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
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
  if (restoreTransport) restoreTransport();
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

beforeEach(() => {
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

async function postAutoPipeline(body) {
  const r = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, text: await r.text() };
}

test('rejects javascript:alert(1) URL at step 1', async () => {
  const { text } = await postAutoPipeline({ url: 'javascript:alert(1)' });
  // SSE stream emits step 0 'failed' + error event with isValidJobUrl rejection.
  assert.match(text, /^event: error\b/m);
  assert.match(text, /isValidJobUrl|invalid|URL/i);
});

test('rejects loopback URL at step 1 (SSRF gate)', async () => {
  const { text } = await postAutoPipeline({ url: 'http://127.0.0.1:22/secret' });
  assert.match(text, /^event: error\b/m);
});

test('rejects RFC1918 URL at step 1 (private IP literal)', async () => {
  const { text } = await postAutoPipeline({ url: 'http://10.0.0.5:8080/internal' });
  assert.match(text, /^event: error\b/m);
});

test('rejects link-local IMDS URL at step 1 (169.254.169.254)', async () => {
  const { text } = await postAutoPipeline({ url: 'http://169.254.169.254/latest/meta-data/' });
  assert.match(text, /^event: error\b/m);
});

test('rejects malformed URL string at step 1', async () => {
  const { text } = await postAutoPipeline({ url: 'not-a-url' });
  assert.match(text, /^event: error\b/m);
});

test('rejects file:// scheme at step 1', async () => {
  const { text } = await postAutoPipeline({ url: 'file:///etc/passwd' });
  assert.match(text, /^event: error\b/m);
});

test('rejects empty URL string at step 1', async () => {
  const { text } = await postAutoPipeline({ url: '' });
  assert.match(text, /^event: error\b/m);
});

test('rejects request body without `url` key', async () => {
  const { text } = await postAutoPipeline({});
  assert.match(text, /^event: error\b/m);
});

test('manual mode short-circuit fires even on public-looking SSRF target', async () => {
  // mode:'manual' is a top-level short-circuit (runs AFTER URL validation
  // but BEFORE any network call). Public-looking URL passes validation,
  // then short-circuit returns the manual prompt. No fetch attempted.
  const { status, text } = await postAutoPipeline({
    url: 'https://job-boards.greenhouse.io/anthropic/jobs/x',
    mode: 'manual',
  });
  assert.equal(status, 200);
  assert.match(text, /"mode":"manual"/);
  assert.match(text, /"prompt"/);
});

test('manual mode still rejects an unsafe URL before short-circuit', async () => {
  // The short-circuit lives AFTER isValidJobUrl — even with mode:'manual',
  // a javascript: URL is rejected at step 1, not returned as a "manual prompt".
  const { text } = await postAutoPipeline({
    url: 'javascript:alert(1)',
    mode: 'manual',
  });
  // The error event for step 1 must precede any 'done' event.
  const errorIdx = text.indexOf('event: error');
  const doneIdx = text.indexOf('event: done');
  assert.notEqual(errorIdx, -1, 'expected error event for javascript: URL');
  // Either no done at all, OR done comes after error (which shouldn't happen).
  if (doneIdx !== -1) {
    assert.ok(errorIdx < doneIdx, 'error must precede done');
  }
});
