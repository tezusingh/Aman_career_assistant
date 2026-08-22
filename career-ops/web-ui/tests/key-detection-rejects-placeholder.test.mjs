/**
 * v1.56.3 — fix(reliability): key detection must reject placeholder /
 * too-short junk, not only the empty string.
 *
 * Reported live: a parent .env with a 10-char GEMINI_API_KEY
 * placeholder made the onboarding banner show "GEMINI ✓ set" AND
 * /api/status/providers return activeProvider: "gemini" over a valid
 * 108-char ANTHROPIC key — so every live eval would silently fail
 * against a dead provider while a working key was ignored.
 *
 * Contract: a secret counts as configured ONLY if it is a plausibly
 * real key — ≥ 20 chars (no supported provider's key is shorter:
 * Gemini AIza… ≈ 39, Anthropic sk-ant-… ≈ 100+, OpenAI ≥ 40, Qwen
 * ≈ 35) and not a known placeholder. Applied uniformly to
 * has{Anthropic,Gemini,OpenAI,Qwen}Key(), /api/status/providers and
 * the /api/health key rows.
 *
 * CI-isolated (CLAUDE.md #2/#8): temp CAREER_OPS_ROOT, the 4 provider
 * keys stripped from process.env, in-process createApp on an
 * ephemeral port — never reads the real parent .env.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { isUsableKey } from '../server/lib/env-config.mjs';

const ENV_DIR = mkdtempSync(resolve(tmpdir(), 'keydet-'));
mkdirSync(resolve(ENV_DIR, 'config'), { recursive: true });
mkdirSync(resolve(ENV_DIR, 'data'), { recursive: true });
writeFileSync(resolve(ENV_DIR, 'cv.md'), '# CV\n\nT.\n');
writeFileSync(resolve(ENV_DIR, 'portals.yml'), 'tracked_companies: []\n');
process.env.CAREER_OPS_ROOT = ENV_DIR;
const PROVIDER_KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY'];
const saved = {};
for (const k of PROVIDER_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
const writeEnv = (lines) => writeFileSync(resolve(ENV_DIR, '.env'), lines.join('\n') + '\n');

// ── unit: isUsableKey ───────────────────────────────────────────────
test('isUsableKey rejects empty / non-string / whitespace', () => {
  for (const v of ['', '   ', undefined, null, 0, {}]) {
    assert.equal(isUsableKey(v), false, `should reject: ${String(v)}`);
  }
});

test('isUsableKey rejects too-short junk (the 10-char .env placeholder)', () => {
  assert.equal(isUsableKey('ABCDE12345'), false);   // 10 chars — the actual bug
  assert.equal(isUsableKey('sk-12345'), false);
  assert.equal(isUsableKey('a'.repeat(19)), false); // just under the floor
});

test('isUsableKey rejects known placeholders even when long enough', () => {
  for (const v of [
    'your_gemini_api_key_here', 'YOUR_API_KEY_HERE_PLEASE',
    'changeme-changeme-changeme', 'placeholder_value_here_x',
    'xxxxxxxxxxxxxxxxxxxxxxxx', '<your-gemini-key-goes-here>',
  ]) assert.equal(isUsableKey(v), false, `should reject placeholder: ${v}`);
});

test('isUsableKey accepts realistic provider keys', () => {
  assert.equal(isUsableKey('AIza' + 'b'.repeat(35)), true);          // Gemini ~39
  assert.equal(isUsableKey('sk-ant-api03-' + 'c'.repeat(95)), true); // Anthropic
  assert.equal(isUsableKey('sk-proj-' + 'd'.repeat(40)), true);      // OpenAI
  assert.equal(isUsableKey('  AIza' + 'e'.repeat(35) + '  '), true); // trims first
});

// ── integration: the exact reported scenario ────────────────────────
async function withApp(fn) {
  const { createApp } = await import('../server/index.mjs');
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((r) => server.close(r)); }
}

test('repro: 10-char GEMINI placeholder + real ANTHROPIC → gemini NOT configured, anthropic active', async () => {
  writeEnv([
    'GEMINI_API_KEY=ABCDE12345',                       // 10-char junk (reported)
    'ANTHROPIC_API_KEY=sk-ant-api03-' + 'z'.repeat(95), // valid-shaped real key
  ]);
  await withApp(async (base) => {
    const prov = await (await fetch(`${base}/api/status/providers`)).json();
    assert.ok(
      !prov.keysConfigured.includes('gemini'),
      `gemini must NOT be reported for a 10-char placeholder; got ${JSON.stringify(prov.keysConfigured)}`,
    );
    assert.ok(prov.keysConfigured.includes('anthropic'), 'the real ANTHROPIC key must be detected');
    assert.equal(
      prov.activeProvider, 'anthropic',
      'active provider must be the valid Anthropic key, not the dead Gemini placeholder',
    );

    const health = await (await fetch(`${base}/api/health`)).json();
    const g = (health.checks || []).find((c) => c.name === 'GEMINI_API_KEY');
    const a = (health.checks || []).find((c) => c.name === 'ANTHROPIC_API_KEY');
    assert.equal(g.ok, false, '/api/health GEMINI row must be ok:false for the placeholder');
    assert.equal(a.ok, true, '/api/health ANTHROPIC row must be ok:true for the real key');
  });
});

test.after(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});
