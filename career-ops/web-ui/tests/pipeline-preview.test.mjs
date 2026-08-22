/**
 * GET /api/pipeline/preview — server-side proxy for the /#/pipeline
 * preview pane. Strips scripts/styles/tags, caps body at 8 KB, gates
 * inputs with isValidJobUrl() so SSRF surface mirrors the existing
 * POST /api/pipeline contract.
 *
 * v1.20.1 (B-1) — preview now uses `safeGet` from
 * server/lib/safe-fetch.mjs which pins DNS at validation time and
 * connects via node:http(s), bypassing globalThis.fetch. Tests inject
 * a stub via `_setTransport(fn)` instead of mocking fetch. The stub
 * receives `(url, pinned, opts)` and returns `{ status, headers, body,
 * location }`. Each upstreamHandler call still receives the canonical
 * URL string for back-compat with the previous test shape.
 */
import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { _setTransport } from '../server/lib/safe-fetch.mjs';

let server, baseUrl;
let upstreamHandler = null;
let restoreTransport = null;

before(async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'pipe-preview-'));
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
  if (restoreTransport) restoreTransport();
  delete process.env.CAREER_OPS_ROOT;
  return new Promise((r) => server.close(r));
});

// Adapter shim: lets each test keep its `upstreamHandler` returning a
// Response-like object (so existing handler bodies don't have to be
// rewritten). The shim translates Response → {status, headers, body,
// location} that safeGet's transport contract expects. We also stub
// DNS by returning a pinned dummy address — safeGet doesn't actually
// connect anywhere when transport is mocked, so the address is just
// a witness for the test.
async function responseAdapter(url, pinned, opts) {
  const fakeUrl = url.toString();
  let resp;
  if (upstreamHandler) {
    resp = await upstreamHandler(fakeUrl, opts);
  } else {
    resp = new Response('<html><body><h1>OK</h1></body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  }
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {};
  resp.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  return {
    status: resp.status,
    headers,
    body,
    location: headers.location,
  };
}

// Stub the DNS lookup so the test never hits a real resolver. safe-fetch's
// resolvePinned() goes through node:dns; we monkey-patch the promise API
// for the duration of the test. The address returned is the loopback
// of the test server — safeGet's privacy check would reject it for a
// real call, but the transport is mocked so no real connect happens.
//
// Actually simpler: since the transport is fully stubbed, we patch
// dns.lookup to return a benign public-looking IPv4. That keeps the
// existing isPrivateOrLoopbackHost check passing.
import { promises as _dns } from 'node:dns';
const _origDnsLookup = _dns.lookup;
beforeEach(() => {
  _dns.lookup = async () => ({ address: '93.184.216.34', family: 4 }); // example.com public IP
  restoreTransport = _setTransport(responseAdapter);
});

afterEach(() => {
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
  _dns.lookup = _origDnsLookup;
  upstreamHandler = null;
});

async function get(path) {
  const r = await fetch(baseUrl + path);
  return { status: r.status, body: await r.json() };
}

const SAMPLE = 'https://jobs.example.com/posting/abc-123';

// ───────────────────────── happy path ─────────────────────────

test('GET /api/pipeline/preview strips scripts + styles + tags', async () => {
  upstreamHandler = async () => new Response(
    '<html><head><title>Hi</title></head><body><h1>Job Posting</h1>'
    + '<p>Senior Engineer, full-time, remote.</p>'
    + '<script>console.log("noise")</script><style>body{color:red}</style>'
    + '</body></html>',
    { status: 200, headers: { 'content-type': 'text/html' } }
  );
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent(SAMPLE));
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 200);
  assert.match(r.body.text, /Job Posting/);
  assert.match(r.body.text, /Senior Engineer/);
  assert.ok(!/console\.log/.test(r.body.text), 'script content leaked');
  assert.ok(!/color:red/.test(r.body.text), 'style content leaked');
  assert.ok(!/<h1>/i.test(r.body.text));
});

test('GET /api/pipeline/preview caps body at 8 KB', async () => {
  upstreamHandler = async () => new Response(
    '<p>' + 'word '.repeat(5000) + '</p>',
    { status: 200, headers: { 'content-type': 'text/html' } }
  );
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent(SAMPLE));
  assert.equal(r.body.status, 200);
  assert.ok(r.body.text.length <= 8000, `expected ≤8000, got ${r.body.text.length}`);
});

test('GET /api/pipeline/preview reports upstream non-2xx via status field', async () => {
  upstreamHandler = async () => new Response('not found', { status: 404 });
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent(SAMPLE));
  assert.equal(r.body.status, 404);
  assert.match(r.body.text, /HTTP 404/);
});

test('GET /api/pipeline/preview reports network error gracefully', async () => {
  upstreamHandler = async () => { throw new Error('ENOTFOUND'); };
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent(SAMPLE));
  assert.equal(r.body.status, 0);
  assert.match(r.body.text, /ENOTFOUND/);
});

// ───────────────────────── validation ─────────────────────────

test('GET /api/pipeline/preview rejects invalid URL with 400', async () => {
  const r = await get('/api/pipeline/preview?url=not-a-url');
  assert.equal(r.status, 400);
});

test('GET /api/pipeline/preview rejects javascript: scheme', async () => {
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent('javascript:alert(1)'));
  assert.equal(r.status, 400);
});

test('GET /api/pipeline/preview rejects loopback host', async () => {
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent('http://localhost/x'));
  assert.equal(r.status, 400);
});

test('GET /api/pipeline/preview rejects empty url', async () => {
  const r = await get('/api/pipeline/preview');
  assert.equal(r.status, 400);
});

// ───────────────────────── REVIEW-B1 redirect hardening ─────────────────────────

test('REVIEW-B1: rejects redirect to loopback', async () => {
  upstreamHandler = async (url) => {
    if (String(url) === SAMPLE) {
      return new Response('', {
        status: 302,
        headers: { location: 'http://127.0.0.1:1/internal' },
      });
    }
    return new Response('LEAKED', { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent(SAMPLE));
  assert.equal(r.status, 200);
  assert.match(r.body.text, /unsafe redirect/i);
  assert.ok(!/LEAKED/.test(r.body.text));
});

test('REVIEW-B1: rejects redirect to file:// scheme', async () => {
  upstreamHandler = async (url) => {
    if (String(url) === SAMPLE) {
      return new Response('', {
        status: 301,
        headers: { location: 'file:///etc/passwd' },
      });
    }
    return new Response('LEAKED', { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent(SAMPLE));
  assert.equal(r.status, 200);
  assert.match(r.body.text, /unsafe redirect/i);
});

test('REVIEW-B1: caps redirect chain at 3 hops', async () => {
  let count = 0;
  upstreamHandler = async () => {
    count += 1;
    return new Response('', {
      status: 302,
      headers: { location: `https://jobs.example.com/hop-${count}` },
    });
  };
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent(SAMPLE));
  assert.equal(r.status, 200);
  assert.match(r.body.text, /too many redirects/i);
});

test('REVIEW-B1: follows safe https redirect within cap', async () => {
  let hop = 0;
  upstreamHandler = async () => {
    hop += 1;
    if (hop === 1) {
      return new Response('', {
        status: 302,
        headers: { location: 'https://careers.example.com/landing' },
      });
    }
    return new Response('<p>Real Posting</p>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  };
  const r = await get('/api/pipeline/preview?url=' + encodeURIComponent(SAMPLE));
  assert.equal(r.status, 200);
  assert.match(r.body.text, /Real Posting/);
});
