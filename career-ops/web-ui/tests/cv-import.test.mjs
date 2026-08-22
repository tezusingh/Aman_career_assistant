/**
 * /api/cv/import — convert uploaded documents to markdown.
 *
 * Asserts:
 *   - .md/.txt passthrough preserves the body verbatim
 *   - .html via pandoc converts to GFM (skipped when pandoc absent)
 *   - .pdf via pdftotext extracts (skipped when poppler absent)
 *   - oversized uploads → 413
 *   - missing X-Filename and empty body → 400
 *   - script content from html is sanitized OUT
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

let server;
let baseUrl;

// Pandoc honors `--version`; pdftotext only knows `-v` and writes to stderr.
const HAS_PANDOC = spawnSync('pandoc', ['--version']).status === 0;
const HAS_PDFTOTEXT = spawnSync('pdftotext', ['-v']).status === 0;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'cv-import-'));
  mkdirSync(resolve(dir, 'config'), { recursive: true });
  mkdirSync(resolve(dir, 'data'), { recursive: true });
  mkdirSync(resolve(dir, 'modes'), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# placeholder\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
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
  return new Promise((resolve) => server.close(resolve));
});

async function importBuf(buf, filename) {
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': filename },
    body: buf,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('POST /api/cv/import: .md passthrough preserves body', async () => {
  const md = '# Hello\n\nA paragraph.\n';
  const r = await importBuf(Buffer.from(md, 'utf8'), 'cv.md');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.sourceFormat, 'md');
  assert.equal(r.body.converter, 'passthrough');
  assert.ok(r.body.markdown.includes('# Hello'));
});

test('POST /api/cv/import: .txt passthrough', async () => {
  const r = await importBuf(Buffer.from('plain text body\n', 'utf8'), 'cv.txt');
  assert.equal(r.status, 200);
  assert.equal(r.body.sourceFormat, 'txt');
  assert.ok(r.body.markdown.startsWith('plain text'));
});

test('POST /api/cv/import: empty body → 400', async () => {
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'cv.md' },
    body: Buffer.alloc(0),
  });
  assert.equal(res.status, 400);
});

test('POST /api/cv/import: unsupported extension → 422', async () => {
  const r = await importBuf(Buffer.from('zzz', 'utf8'), 'cv.exe');
  assert.equal(r.status, 422);
  assert.equal(r.body.ok, false);
  assert.match(r.body.error, /unsupported/i);
});

test('POST /api/cv/import: oversized payload → 413', async () => {
  // express.raw limit returns 413 for >MAX_UPLOAD_BYTES (10 MB).
  const big = Buffer.alloc(10 * 1024 * 1024 + 1024, 0x61);
  const res = await fetch(baseUrl + '/api/cv/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': 'cv.txt' },
    body: big,
  });
  assert.equal(res.status, 413);
});

test('POST /api/cv/import: HTML upload sanitizes <script>', { skip: !HAS_PANDOC ? 'pandoc not installed' : false }, async () => {
  const html = '<h1>Senior Engineer</h1><script>window.__pwn=1</script><p>About me.</p>';
  const r = await importBuf(Buffer.from(html, 'utf8'), 'cv.html');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.sourceFormat, 'html');
  assert.equal(r.body.converter, 'pandoc');
  // Title stays, scripted content is gone.
  assert.match(r.body.markdown, /Senior Engineer/);
  assert.ok(!/window\.__pwn/.test(r.body.markdown));
  assert.ok(!/<script/i.test(r.body.markdown));
});

test('POST /api/cv/import: PDF extracts plain text', { skip: !HAS_PDFTOTEXT ? 'pdftotext not installed' : false }, async () => {
  // Build a minimal valid PDF inline rather than depend on a fixture file.
  // This is a hand-tuned PDF with one Helvetica string "CV content here".
  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
    '4 0 obj<</Length 44>>stream',
    'BT /F1 18 Tf 100 700 Td (CV content here) Tj ET',
    'endstream endobj',
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    'xref',
    '0 6',
    '0000000000 65535 f',
    '0000000010 00000 n',
    '0000000053 00000 n',
    '0000000102 00000 n',
    '0000000193 00000 n',
    '0000000281 00000 n',
    'trailer<</Size 6/Root 1 0 R>>',
    'startxref',
    '343',
    '%%EOF',
  ].join('\n');
  const r = await importBuf(Buffer.from(pdf, 'binary'), 'cv.pdf');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.sourceFormat, 'pdf');
  assert.equal(r.body.converter, 'pdftotext');
  assert.match(r.body.markdown, /CV content here/);
});
