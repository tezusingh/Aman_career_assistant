/**
 * v1.20.1 (H-5) — llmRateLimit middleware contract.
 *
 * The middleware is a no-op on loopback (HOST=127.0.0.1) and active on
 * public binds (HOST=0.0.0.0). This test exercises both halves of the
 * branch via a synthetic Express-like (req, res, next) trio so we don't
 * need to boot a server or mock LLM calls.
 *
 * The integration angle (rate limit fires through /api/evaluate end-to-
 * end) is left to the existing api.test.mjs flow — testing here in
 * isolation keeps the middleware contract sharp and the test fast.
 */
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { llmRateLimit, _resetBuckets } from '../server/lib/rate-limit.mjs';

const origHost = process.env.HOST;
const origLimit = process.env.LLM_RATE_LIMIT;

beforeEach(() => { _resetBuckets(); });
afterEach(() => {
  if (origHost === undefined) delete process.env.HOST;
  else process.env.HOST = origHost;
  if (origLimit === undefined) delete process.env.LLM_RATE_LIMIT;
  else process.env.LLM_RATE_LIMIT = origLimit;
});

// Tiny fake req/res. `nextCalls` counts how many times the chain
// advanced; `lastStatus` and `lastBody` capture rejections.
function mkCtx(ip = '203.0.113.10') {
  const headers = {};
  let status = null;
  let body = null;
  let next = 0;
  const req = { ip, socket: { remoteAddress: ip } };
  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(s) { status = s; return res; },
    json(b) { body = b; return res; },
  };
  const nextFn = () => { next += 1; };
  return { req, res, nextFn, get: () => ({ status, body, headers, next }) };
}

test('llmRateLimit: no-op on loopback (HOST=127.0.0.1)', () => {
  process.env.HOST = '127.0.0.1';
  const c = mkCtx();
  // Fire 50 requests — none should be rate-limited because the bind
  // is loopback. Single-user dev mode = no throttle.
  for (let i = 0; i < 50; i++) llmRateLimit(c.req, c.res, c.nextFn);
  const o = c.get();
  assert.equal(o.next, 50);
  assert.equal(o.status, null);
});

test('llmRateLimit: no-op when HOST unset (defaults to 127.0.0.1)', () => {
  delete process.env.HOST;
  const c = mkCtx();
  for (let i = 0; i < 30; i++) llmRateLimit(c.req, c.res, c.nextFn);
  assert.equal(c.get().next, 30);
});

test('llmRateLimit: active on HOST=0.0.0.0, 11th request gets 429', () => {
  process.env.HOST = '0.0.0.0';
  process.env.LLM_RATE_LIMIT = '10/60s';
  const c = mkCtx();
  for (let i = 0; i < 10; i++) llmRateLimit(c.req, c.res, c.nextFn);
  // Eleventh hits the cap.
  llmRateLimit(c.req, c.res, c.nextFn);
  const o = c.get();
  assert.equal(o.next, 10);
  assert.equal(o.status, 429);
  assert.ok(/rate limit/.test(o.body.error));
  assert.ok(o.headers['Retry-After']);
  assert.ok(Number(o.headers['Retry-After']) >= 0);
  assert.ok(Number(o.headers['Retry-After']) <= 60);
});

test('llmRateLimit: distinct IPs get distinct buckets', () => {
  process.env.HOST = '0.0.0.0';
  process.env.LLM_RATE_LIMIT = '3/60s';
  // Plain counters — avoid mkCtx's shared default-IP / closure
  // gotchas where two contexts could collide on req.ip if defaults
  // overlap during refactors.
  let aNext = 0, aStatus = null;
  let bNext = 0, bStatus = null;
  const aReq = { ip: '203.0.113.10', socket: { remoteAddress: '203.0.113.10' } };
  const bReq = { ip: '203.0.113.11', socket: { remoteAddress: '203.0.113.11' } };
  const aRes = {
    setHeader() {},
    status(s) { aStatus = s; return aRes; },
    json() { return aRes; },
  };
  const bRes = {
    setHeader() {},
    status(s) { bStatus = s; return bRes; },
    json() { return bRes; },
  };
  // Stagger the buckets so the distinct-bucket invariant is testable:
  // A consumes its full quota (3) and gets 429 on the 4th. B has only
  // used 1 slot at that point — bucket independence means B's 4th
  // attempt would still hit B's own quota cap of 3.
  for (let i = 0; i < 3; i++) llmRateLimit(aReq, aRes, () => { aNext += 1; });
  // A's 4th — 429, A is now exhausted.
  llmRateLimit(aReq, aRes, () => { aNext += 1; });
  assert.equal(aNext, 3, 'A.next stays at 3 because the 4th was rejected');
  assert.equal(aStatus, 429, 'A 4th call → 429');

  // Now exercise B from zero — A's 429 must NOT cap B. B should be
  // able to do its full 3 calls. If buckets weren't keyed by IP,
  // B's first call would inherit A's exhausted state.
  llmRateLimit(bReq, bRes, () => { bNext += 1; });
  llmRateLimit(bReq, bRes, () => { bNext += 1; });
  assert.equal(bNext, 2, 'B used 2 of its 3 slots, unaffected by A');
  assert.equal(bStatus, null, 'B has not hit 429');
});

test('llmRateLimit: bucket resets after window expires', async () => {
  process.env.HOST = '0.0.0.0';
  process.env.LLM_RATE_LIMIT = '2/100ms';
  const c = mkCtx();
  llmRateLimit(c.req, c.res, c.nextFn);
  llmRateLimit(c.req, c.res, c.nextFn);
  llmRateLimit(c.req, c.res, c.nextFn); // 429
  assert.equal(c.get().status, 429);
  // Wait past the window.
  await new Promise((r) => setTimeout(r, 120));
  // New bucket should accept the next request.
  const c2 = mkCtx();
  llmRateLimit(c2.req, c2.res, c2.nextFn);
  assert.equal(c2.get().next, 1);
  assert.equal(c2.get().status, null);
});

test('llmRateLimit: malformed LLM_RATE_LIMIT falls back to default 10/60s', () => {
  process.env.HOST = '0.0.0.0';
  process.env.LLM_RATE_LIMIT = 'garbage';
  const c = mkCtx();
  for (let i = 0; i < 10; i++) llmRateLimit(c.req, c.res, c.nextFn);
  llmRateLimit(c.req, c.res, c.nextFn);
  assert.equal(c.get().next, 10);
  assert.equal(c.get().status, 429);
});
