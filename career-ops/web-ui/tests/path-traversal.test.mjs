/**
 * v1.20.1 (H-4) — path-traversal sweep.
 *
 * Verifies that the consolidated sanitizePathName() in
 * server/lib/security.mjs rejects every traversal-style input the
 * project previously accepted via the duplicated
 * `replace(/[^\w\-.]/g, '')` pattern. Specifically:
 *   - leading dots / dot-runs (`.`, `..`, `....pdf`, `.hiddenfile`)
 *   - internal dot-runs collapse (`foo..bar` → `foo.bar`)
 *   - slashes drop entirely (no `/` in allowed set)
 *   - URL-encoded `%2e%2e` survives only as the literal "%2e2e" of \w
 *     chars (since `%` is non-\w) — and there is no decoding pass to
 *     turn it back into `..`
 *   - NUL bytes and control chars drop entirely
 *   - empty / whitespace-only input yields `''` so callers can 400
 *
 * Also exercises each consuming route so the helper change is covered
 * end-to-end. Tests bind to ephemeral ports and use a temp
 * CAREER_OPS_ROOT — no parent-project dependency (CLAUDE.md hard rule
 * #8).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizePathName } from '../server/lib/security.mjs';
// NOTE: createApp must be dynamic-imported AFTER setting CAREER_OPS_ROOT
// because paths.mjs resolves the parent root at module-load time. The
// pattern below matches tests/api.test.mjs.

// ─── Pure helper unit tests ────────────────────────────────────────

test('sanitizePathName: empty / null / undefined → ""', () => {
  assert.strictEqual(sanitizePathName(''), '');
  assert.strictEqual(sanitizePathName(null), '');
  assert.strictEqual(sanitizePathName(undefined), '');
});

test('sanitizePathName: leading dots stripped', () => {
  assert.strictEqual(sanitizePathName('.hidden'), 'hidden');
  assert.strictEqual(sanitizePathName('..pdf'), 'pdf');
  assert.strictEqual(sanitizePathName('....md'), 'md');
  assert.strictEqual(sanitizePathName('...'), '');
});

test('sanitizePathName: internal dot-runs collapse', () => {
  assert.strictEqual(sanitizePathName('foo..bar'), 'foo.bar');
  assert.strictEqual(sanitizePathName('a...b....c'), 'a.b.c');
  assert.strictEqual(sanitizePathName('file..tar..gz'), 'file.tar.gz');
});

test('sanitizePathName: slashes dropped', () => {
  assert.strictEqual(sanitizePathName('foo/bar'), 'foobar');
  assert.strictEqual(sanitizePathName('../../etc/passwd'), 'etcpasswd');
  assert.strictEqual(sanitizePathName('foo\\bar'), 'foobar');
});

test('sanitizePathName: URL-encoded traversal stays harmless', () => {
  // `%` is not \w so the `%` falls; `2e` survive as literal chars.
  // No URL decoding happens before sanitization — that would be the bug.
  assert.strictEqual(sanitizePathName('%2e%2e%2fpasswd'), '2e2e2fpasswd');
  assert.strictEqual(sanitizePathName('%2e%2e'), '2e2e');
});

test('sanitizePathName: NUL and control chars drop', () => {
  assert.strictEqual(sanitizePathName('foo\x00bar'), 'foobar');
  assert.strictEqual(sanitizePathName('foo\x1bbar'), 'foobar');
  assert.strictEqual(sanitizePathName('foo\r\nbar'), 'foobar');
});

test('sanitizePathName: 200-char cap', () => {
  const long = 'a'.repeat(250);
  const out = sanitizePathName(long);
  assert.strictEqual(out.length, 200);
});

test('sanitizePathName: allowed chars preserved', () => {
  assert.strictEqual(sanitizePathName('report-2026-05-14.md'), 'report-2026-05-14.md');
  assert.strictEqual(sanitizePathName('my_jd_v2.txt'), 'my_jd_v2.txt');
});

// ─── End-to-end coverage on consuming routes ──────────────────────

function setupFixture() {
  const root = mkdtempSync(join(tmpdir(), 'pathtraversal-'));
  // Minimum parent scaffold the routes need to not 500.
  writeFileSync(join(root, 'cv.md'), '# CV\n');
  mkdirSync(join(root, 'config'), { recursive: true });
  writeFileSync(join(root, 'config', 'profile.yml'), 'candidate: { full_name: t }\n');
  writeFileSync(join(root, 'portals.yml'), 'tracked_companies: []\n');
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'reports'), { recursive: true });
  mkdirSync(join(root, 'jds'), { recursive: true });
  mkdirSync(join(root, 'modes'), { recursive: true });
  mkdirSync(join(root, 'interview-prep'), { recursive: true });
  mkdirSync(join(root, 'output'), { recursive: true });
  return root;
}

async function withServer(fn) {
  const root = setupFixture();
  const prev = process.env.CAREER_OPS_ROOT;
  process.env.CAREER_OPS_ROOT = root;
  // Cache-bust the module graph so paths.mjs re-resolves with our root.
  // Adding a query string makes Node treat this as a fresh import; the
  // unit-test runner discards the worker context anyway, so the leak is
  // bounded to this single subtest.
  const { createApp } = await import('../server/index.mjs?t=' + Date.now());
  const app = createApp();
  await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', async () => {
      const { port } = server.address();
      const baseUrl = `http://127.0.0.1:${port}`;
      try {
        await fn(baseUrl);
        server.close(resolve);
      } catch (e) {
        server.close(() => reject(e));
      } finally {
        if (prev === undefined) delete process.env.CAREER_OPS_ROOT;
        else process.env.CAREER_OPS_ROOT = prev;
      }
    });
  });
}

const TRAVERSAL_NAMES = [
  '..',
  '...',
  '..pdf',
  '....pdf',
  '../../etc/passwd',
  '..%2fetc%2fpasswd',
  '.hidden',
  '%00',
  '\x00pwn',
];

test('GET /api/jds/:name rejects traversal-style names', async () => {
  await withServer(async (baseUrl) => {
    for (const name of TRAVERSAL_NAMES) {
      const res = await fetch(`${baseUrl}/api/jds/${encodeURIComponent(name)}`);
      // After sanitization the path either becomes empty (→ 400) or
      // points to a non-existent file (→ 404). 200 with file contents
      // would mean the sanitizer let through a real path.
      assert.ok([400, 404].includes(res.status),
        `jds/${name} returned ${res.status} (expected 400/404)`);
    }
  });
});

test('GET /api/reports/:slug rejects traversal-style slugs', async () => {
  await withServer(async (baseUrl) => {
    for (const slug of TRAVERSAL_NAMES) {
      const res = await fetch(`${baseUrl}/api/reports/${encodeURIComponent(slug)}`);
      assert.ok([400, 404].includes(res.status),
        `reports/${slug} returned ${res.status} (expected 400/404)`);
    }
  });
});

test('GET /api/modes/:name rejects traversal-style names', async () => {
  await withServer(async (baseUrl) => {
    for (const name of TRAVERSAL_NAMES) {
      const res = await fetch(`${baseUrl}/api/modes/${encodeURIComponent(name)}`);
      assert.ok([400, 404].includes(res.status),
        `modes/${name} returned ${res.status} (expected 400/404)`);
    }
  });
});

test('GET /api/output/pdfs/:name rejects traversal-style names', async () => {
  await withServer(async (baseUrl) => {
    for (const name of TRAVERSAL_NAMES) {
      const res = await fetch(`${baseUrl}/api/output/pdfs/${encodeURIComponent(name)}`);
      assert.ok([400, 404].includes(res.status),
        `output/pdfs/${name} returned ${res.status} (expected 400/404)`);
    }
  });
});
