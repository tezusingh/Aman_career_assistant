/**
 * v1.10.2 — /api/cv/import must reject multipart payloads.
 *
 * The SPA's upload flow sends Content-Type: application/octet-stream
 * with the raw file bytes and an X-Filename header. ANY tool that
 * defaults to multipart/form-data (curl -F, common HTTP clients) used
 * to silently corrupt cv.md by writing the multipart wire envelope as
 * the file contents (F-016). v1.10.2 closes that with a 415 + hint.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'cv-mp-reject-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# original\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
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

test('CV import: SPA path (octet-stream + X-Filename .md) returns 200 with clean markdown', async () => {
  const body = '# Test CV\n\n## About\nSenior backend engineer.\n';
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': 'cv.md',
    },
    body,
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.sourceFormat, 'md');
  // Critical: markdown round-trips losslessly with NO multipart envelope.
  assert.equal(data.markdown.trim(), body.trim());
  assert.ok(!/Content-Disposition/.test(data.markdown), 'must not contain multipart headers');
  assert.ok(!/form-data/.test(data.markdown), 'must not contain form-data marker');
});

test('CV import (v1.13.0): multipart/form-data now works (PR-4 full multer pipeline)', async () => {
  // Hand-craft a multipart body so we don't depend on FormData polyfills.
  // v1.10.2 returned 415 here as a stopgap; v1.13.0 parses multer properly
  // and the upload round-trips just like the octet-stream path.
  const boundary = '----TestBoundary-' + Date.now();
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="cv.md"\r\n` +
    `Content-Type: text/markdown\r\n\r\n` +
    `# Multipart CV via multer\n` +
    `\r\n--${boundary}--\r\n`;
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.match(data.markdown, /Multipart CV via multer/);
  // Critical: the markdown is clean — no Content-Disposition envelope leak.
  assert.ok(!/Content-Disposition/.test(data.markdown));
  assert.ok(!/boundary/.test(data.markdown));
});

test('CV import (v1.13.0): multipart with NO file part returns 400 JSON', async () => {
  // multer parses an empty multipart body without error; the route
  // detects req.files.length === 0 and returns a friendly 400.
  const boundary = '----EmptyBoundary-' + Date.now();
  const body = `--${boundary}--\r\n`;
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.match(data.error, /no file part/);
});

test('CV import: octet-stream BUT body bytes look like multipart envelope also returns 415 (defense in depth)', async () => {
  const sniffable =
    '--------xxx\r\n' +
    'Content-Disposition: form-data; name="file"; filename="cv.md"\r\n\r\n' +
    'tricked content\r\n--------xxx--\r\n';
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': 'cv.md',
    },
    body: sniffable,
  });
  assert.equal(res.status, 415);
  const data = await res.json();
  assert.match(data.error, /multipart/);
});

test('CV import: empty body returns 400', async () => {
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': 'cv.md',
    },
    body: '',
  });
  assert.equal(res.status, 400);
});

test('CV import (v1.13.0): /api/cv/import never writes to cv.md (returns converted markdown only)', async () => {
  // The contract is: /api/cv/import CONVERTS but never PERSISTS. To save,
  // the user (or SPA) must explicitly call PUT /api/cv with the markdown.
  // This invariant matters because the v1.10.2 corruption bug was about
  // /api/cv/import silently writing to cv.md. v1.13.0's multer pipeline
  // returns 200 on a multipart upload — verify that cv.md ON DISK is
  // still unchanged after a successful conversion.
  const before = await fetch(baseUrl + '/api/cv').then((r) => r.json());

  const boundary = '----NoSideEffectTest-' + Date.now();
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="upload.md"\r\n\r\n` +
    `# Body that lands in the response, never on disk\n` +
    `\r\n--${boundary}--\r\n`;
  const r = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  assert.equal(r.status, 200);  // conversion succeeded
  const data = await r.json();
  assert.match(data.markdown, /Body that lands in the response/);

  // cv.md on disk is unchanged — /api/cv/import is convert-only.
  const after = await fetch(baseUrl + '/api/cv').then((r) => r.json());
  assert.equal(after.markdown, before.markdown);
});
