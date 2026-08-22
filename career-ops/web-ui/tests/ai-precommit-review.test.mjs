/**
 * WS7 (v1.37.0) — pre-commit AI review deterministic floor.
 * Pure functions, no git / no AI. The CLI plumbing is thin; these
 * lock the fail-HARD logic that protects every commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blockedPaths, secretHits, alsoLeftovers, deterministicFloor,
} from '../scripts/ai-precommit-review.mjs';

test('blockedPaths flags .env / keys / private keys', () => {
  assert.deepEqual(
    blockedPaths(['src/a.js', '.env', 'config/.env.local', 'k.pem', 'deploy/id_rsa', 'ok.txt']),
    ['.env', 'config/.env.local', 'k.pem', 'deploy/id_rsa']);
  assert.deepEqual(blockedPaths(['README.md', '.env.example']), []); // .env.example is allowed
});

test('secretHits catches real key patterns in ADDED lines only', () => {
  const diff = [
    '+++ b/x.mjs',
    '+const k = "sk-ant-abcdefghijklmnopqrstuvwxyz0123";',
    '-const old = "removed";',
    ' context line with sk-ant-shouldNOTcount (not +)',
    '+const g = "AIzaSyA1234567890abcdefghijklmnopqrstuvw";',
  ].join('\n');
  const hits = secretHits(diff);
  assert.equal(hits.length, 2);
});

test('secretHits ignores .env.example placeholders', () => {
  const diff = '+ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY_HERE\n+OPENAI=<your-key>';
  assert.deepEqual(secretHits(diff), []);
});

test('alsoLeftovers flags staged view files containing .also(', () => {
  const fs = {
    'public/js/views/bad.js': 'const x = c(...).also(y);',
    'public/js/views/good.js': 'const x = c(div);',
    'server/lib/x.mjs': 'foo.also(bar)', // not a view → ignored
  };
  assert.deepEqual(
    alsoLeftovers(Object.keys(fs), (f) => fs[f]),
    ['public/js/views/bad.js']);
});

test('alsoLeftovers: a COMMENT mentioning .also( is NOT flagged (mirrors CI gate)', () => {
  const fs = {
    'public/js/views/c.js': '  // v1.24.1 — was `.also((root) => …)` via Element.prototype.also,\nconst x = c(div);',
    'public/js/views/star.js': '   * docs: do not use .also( anymore\nconst y = 1;',
  };
  assert.deepEqual(alsoLeftovers(Object.keys(fs), (f) => fs[f]), []);
});

test('deterministicFloor aggregates all blocker classes', () => {
  const r = deterministicFloor({
    stagedFiles: ['.env', 'public/js/views/v.js'],
    secretDiffText: '+token = "ghp_abcdefghijklmnopqrstuvwxyz012345"',
    readFile: () => 'a.also(b)',
  });
  assert.equal(r.blockers.length, 3); // .env + secret + .also
});

test('deterministicFloor clean diff → no blockers', () => {
  const r = deterministicFloor({
    stagedFiles: ['README.md', 'server/lib/x.mjs'],
    secretDiffText: '+// a normal comment\n+export const N = 42;',
    readFile: () => 'export const N = 42;',
  });
  assert.deepEqual(r.blockers, []);
});
