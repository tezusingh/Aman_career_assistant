/**
 * FIX-M3 + FIX-M6 — POST /api/pipeline must reject invalid URLs with 400,
 * not return 200 and silently drop them.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

let server;
let baseUrl;
let createApp;
let isValidJobUrl;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'url-val-'));
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

  ({ createApp, isValidJobUrl } = await import('../server/index.mjs'));
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

async function post(body) {
  const res = await fetch(baseUrl + '/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// ───────────────────────── pure validator ─────────────────────────

test('isValidJobUrl: accepts http/https with hostname', () => {
  assert.equal(isValidJobUrl('https://jobs.example.com/posting/1'), true);
  assert.equal(isValidJobUrl('http://example.com'), true);
  assert.equal(isValidJobUrl('https://boards.greenhouse.io/anthropic/jobs/4042'), true);
});

test('isValidJobUrl: rejects script/template chars', () => {
  assert.equal(isValidJobUrl('<script>alert(1)</script>'), false);
  assert.equal(isValidJobUrl('https://x.com/<img>'), false);
  assert.equal(isValidJobUrl('https://x.com/" onerror="x'), false);
  assert.equal(isValidJobUrl("https://x.com/'attr'"), false);
  assert.equal(isValidJobUrl('https://x.com/`backtick`'), false);
});

test('NEW-2 (v1.58.7): rejects paired template-placeholder syntaxes (${…}, {{…}})', () => {
  // Pre-v1.58.7 these slipped through; the error message ("contain no
  // script or template characters") promised to reject them. The
  // regex↔message gap is now closed (option A from the fix-prompt).
  assert.equal(isValidJobUrl('https://example.com/${TEST}'), false, '${TEST} must be rejected');
  assert.equal(isValidJobUrl('https://example.com/{{TEST}}'), false, '{{TEST}} must be rejected');
  assert.equal(isValidJobUrl('https://example.com/path/${user.id}/job'), false, 'nested ${…} must be rejected');
  assert.equal(isValidJobUrl('https://example.com/{{role.title}}/apply'), false, '{{…}} with dots must be rejected');
  // ASP/EJS was already blocked by the `<`/`>` gate — regression-lock it
  // here so a future refactor of the bracket-char regex doesn't reopen it.
  assert.equal(isValidJobUrl('https://example.com/<%TEST%>'), false, '<%TEST%> must stay rejected');
});

test('NEW-2: ATS URLs with a single brace remain accepted (no false positives)', () => {
  // A bare `{name}` is a legitimate ATS path token shape; only the
  // *paired* opener+closer of a templating placeholder is a real risk.
  assert.equal(isValidJobUrl('https://example.com/job/{normal}'), true,
    'single brace pair {normal} must NOT be rejected (legit ATS pattern)');
  assert.equal(isValidJobUrl('https://boards.greenhouse.io/anthropic/jobs/4567'), true);
});

test('isValidJobUrl: rejects javascript: / data: / file: schemes', () => {
  assert.equal(isValidJobUrl('javascript:alert(1)'), false);
  assert.equal(isValidJobUrl('data:text/html,<h1>x</h1>'), false);
  assert.equal(isValidJobUrl('file:///etc/passwd'), false);
  assert.equal(isValidJobUrl('ftp://example.com'), false);
  assert.equal(isValidJobUrl('vbscript:msgbox(1)'), false);
});

test('isValidJobUrl: rejects empty, whitespace, non-string', () => {
  assert.equal(isValidJobUrl(''), false);
  assert.equal(isValidJobUrl('   '), false);
  assert.equal(isValidJobUrl(null), false);
  assert.equal(isValidJobUrl(undefined), false);
  assert.equal(isValidJobUrl(42), false);
  assert.equal(isValidJobUrl({}), false);
});

test('isValidJobUrl: rejects malformed URL strings', () => {
  assert.equal(isValidJobUrl('not a url'), false);
  assert.equal(isValidJobUrl('http://'), false);
  assert.equal(isValidJobUrl('//example.com'), false);
  assert.equal(isValidJobUrl('../../etc/passwd'), false);
});

// ───────────────────────── FIX-M7 ─────────────────────────

test('FIX-M7: bare "not-a-url" string is rejected', () => {
  assert.equal(isValidJobUrl('not-a-url'), false);
  assert.equal(isValidJobUrl('hello world'), false);
  assert.equal(isValidJobUrl('justastring'), false);
});

test('FIX-M7: rejects loopback hostnames (no SSRF / job boards on laptop)', () => {
  assert.equal(isValidJobUrl('http://localhost/job/1'), false);
  assert.equal(isValidJobUrl('https://127.0.0.1/job/1'), false);
  assert.equal(isValidJobUrl('http://[::1]/job/1'), false);
  // Subdomains of localhost (some browsers resolve these) are NOT loopback
  // by themselves — the hostname check is exact-match. Allowed.
  assert.equal(isValidJobUrl('https://app.localhost.example.com/job/1'), true);
});

// ───────────────────────── PR-3 / F-003 ─────────────────────────
// Expand the SSRF surface to cover RFC1918, link-local (incl. AWS IMDS
// 169.254.169.254), 0.0.0.0, CGNAT, and IPv6 ULA/link-local.

test('PR-3: rejects RFC1918 IPv4 ranges (10/8, 172.16/12, 192.168/16)', () => {
  assert.equal(isValidJobUrl('http://10.0.0.1/job/1'), false);
  assert.equal(isValidJobUrl('http://10.255.255.255/job/1'), false);
  assert.equal(isValidJobUrl('http://172.16.0.1/job/1'), false);
  assert.equal(isValidJobUrl('http://172.31.255.255/job/1'), false);
  assert.equal(isValidJobUrl('http://192.168.0.1/job/1'), false);
  // 172.32 is NOT in RFC1918 — should pass scheme-level checks.
  assert.equal(isValidJobUrl('http://172.32.0.1/job/1'), true);
});

test('PR-3: rejects link-local + AWS IMDS (169.254/16) and 0.0.0.0', () => {
  assert.equal(isValidJobUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isValidJobUrl('http://169.254.0.1/'), false);
  assert.equal(isValidJobUrl('http://0.0.0.0/'), false);
  assert.equal(isValidJobUrl('http://0.0.0.0:8080/job/1'), false);
});

test('PR-3: rejects entire 127/8 loopback range, not just 127.0.0.1', () => {
  assert.equal(isValidJobUrl('http://127.0.0.1/'), false);
  assert.equal(isValidJobUrl('http://127.1.2.3/'), false);
  assert.equal(isValidJobUrl('http://127.255.255.255/'), false);
});

test('PR-3: rejects CGNAT 100.64/10', () => {
  assert.equal(isValidJobUrl('http://100.64.0.1/'), false);
  assert.equal(isValidJobUrl('http://100.127.255.255/'), false);
  // 100.63 and 100.128 are outside the CGNAT block.
  assert.equal(isValidJobUrl('http://100.63.0.1/'), true);
  assert.equal(isValidJobUrl('http://100.128.0.1/'), true);
});

test('PR-3: rejects IPv6 loopback / unspecified / ULA / link-local', () => {
  assert.equal(isValidJobUrl('http://[::1]/'), false);
  assert.equal(isValidJobUrl('http://[::]/'), false);
  assert.equal(isValidJobUrl('http://[fc00::1]/'), false);
  assert.equal(isValidJobUrl('http://[fd00::1]/'), false);
  assert.equal(isValidJobUrl('http://[fe80::1]/'), false);
});

test('FIX-M7: rejects too-short / too-long inputs', () => {
  assert.equal(isValidJobUrl('http://x'), false);  // 8 chars < min 10
  assert.equal(isValidJobUrl('https://example.com/' + 'x'.repeat(2000)), false);
});

test('FIX-M7: rejects whitespace-containing inputs', () => {
  assert.equal(isValidJobUrl('https://example.com/with space'), false);
  assert.equal(isValidJobUrl('https://example.com/\twith-tab'), false);
});

test('POST /api/pipeline {url:"not-a-url"} → 400 (was 200, FIX-M7)', async () => {
  const r = await post({ url: 'not-a-url' });
  assert.equal(r.status, 400);
  // v1.58.0 (QA BUG-006) — humanized, sentence-cased message.
  assert.match(r.body.error, /valid job posting URL/i);
});

test('POST /api/pipeline {url:"http://localhost/job"} → 400', async () => {
  const r = await post({ url: 'http://localhost/job' });
  assert.equal(r.status, 400);
});

// ───────────────────────── HTTP integration ─────────────────────────

test('POST /api/pipeline {url:"<script>"} → 400', async () => {
  const r = await post({ url: '<script>alert(1)</script>' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /valid job posting URL/i);
});

test('POST /api/pipeline {url:"javascript:..."} → 400', async () => {
  const r = await post({ url: 'javascript:alert(1)' });
  assert.equal(r.status, 400);
});

test('POST /api/pipeline {url:"<img onerror>..."} → 400', async () => {
  const r = await post({ url: '<img src=x onerror=alert(1)>' });
  assert.equal(r.status, 400);
});

test('POST /api/pipeline {url:""} → 400', async () => {
  const r = await post({});
  assert.equal(r.status, 400);
  assert.match(r.body.error, /url required/);
});

test('POST /api/pipeline {url:"https://..."} → 200', async () => {
  const r = await post({ url: 'https://valid-' + Date.now() + '.example.com/job/1' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('POST /api/pipeline duplicate URL → 200 with deduped:true', async () => {
  const url = 'https://dup-' + Date.now() + '.example.com/job/1';
  const first = await post({ url });
  assert.equal(first.status, 200);
  assert.equal(first.body.deduped, false);
  const second = await post({ url });
  assert.equal(second.status, 200);
  assert.equal(second.body.deduped, true);
});
