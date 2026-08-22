/**
 * Re-apply cooldown filter (v1.84.0 — parent career-ops v1.15.0 / #1201).
 * Pure logic + a tmp-file YAML reader. CI-isolated (no parent project needed).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addDays,
  companyMatch,
  loadReApplyWindows,
  buildCooldownFilter,
} from '../server/lib/cooldown.mjs';

test('addDays: UTC date arithmetic', () => {
  assert.equal(addDays('2026-01-10', 30), '2026-02-09');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('companyMatch: exact, punctuation-insensitive, word-boundary, and non-matches', () => {
  assert.equal(companyMatch('Acme Inc', 'Acme, Inc.'), true);   // punctuation differs
  assert.equal(companyMatch('Acme', 'Acme Corp'), true);        // word-boundary
  assert.equal(companyMatch('Acme Corp', 'Acme'), true);        // symmetric
  assert.equal(companyMatch('Globex', 'Acme'), false);
  assert.equal(companyMatch('', 'Acme'), false);
  assert.equal(companyMatch('Acme', ''), false);
  // not a substring-of-token false positive: "Macmega" must NOT match "Acme"
  assert.equal(companyMatch('Macmega', 'Acme'), false);
});

test('loadReApplyWindows: reads + validates config/profile.yml re_apply_windows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cooldown-'));
  const p = join(dir, 'profile.yml');
  try {
    writeFileSync(p, [
      're_apply_windows:',
      '  "Acme Inc":',
      '    last_apply_date: "2026-05-01"',
      '    same_role_days: 30',
      '    applied_to: ["Senior Backend Engineer"]',
      '  "Bad Co":',          // dropped — no last_apply_date
      '    same_role_days: 30',
      '  "Bad Date":',        // dropped — malformed date
      '    last_apply_date: "not-a-date"',
    ].join('\n'));
    const w = loadReApplyWindows(p);
    assert.deepEqual(Object.keys(w), ['Acme Inc']);
    assert.equal(w['Acme Inc'].same_role_days, 30);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // absent / empty → {}
  assert.deepEqual(loadReApplyWindows('/nope/profile.yml'), {});
  assert.deepEqual(loadReApplyWindows(''), {});
});

test('loadReApplyWindows: an UNQUOTED YAML date is coerced to a string (not dropped)', () => {
  // js-yaml parses unquoted `2026-05-01` as a Date — the reader must coerce it,
  // else the window is silently dropped and cooldown never fires.
  const dir = mkdtempSync(join(tmpdir(), 'cooldown-'));
  const p = join(dir, 'profile.yml');
  try {
    writeFileSync(p, [
      're_apply_windows:',
      '  Acme:',
      '    last_apply_date: 2026-05-01',   // UNQUOTED → js-yaml Date
      '    same_role_days: 30',
      '    applied_to: ["Backend Engineer"]',
    ].join('\n'));
    const w = loadReApplyWindows(p);
    assert.deepEqual(Object.keys(w), ['Acme']);
    assert.equal(w.Acme.last_apply_date, '2026-05-01'); // coerced to YYYY-MM-DD string
    // and the filter actually fires with the coerced window
    const f = buildCooldownFilter(w, '2026-05-15');
    assert.equal(f({ company: 'Acme', title: 'Backend Engineer' }).skip, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildCooldownFilter: skips applied role within cooldown, passes after it elapses', () => {
  const windows = {
    'Acme Inc': { last_apply_date: '2026-05-01', same_role_days: 30, applied_to: ['Senior Backend Engineer'] },
  };
  const within = buildCooldownFilter(windows, '2026-05-15'); // before 2026-05-31
  const after = buildCooldownFilter(windows, '2026-06-15');  // after cooldown

  // same company (punctuation differs) + matching role, within window → skip
  const job = { company: 'Acme, Inc.', title: 'Senior Backend Engineer (Remote)' };
  const r = within(job);
  assert.equal(r.skip, true);
  assert.match(r.reason, /^cooldown:Acme Inc:2026-05-31$/);
  // after cooldown elapsed → pass
  assert.equal(after(job).skip, false);
  // non-matching role at same company → pass
  assert.equal(within({ company: 'Acme Inc', title: 'Product Manager' }).skip, false);
  // non-matching company → pass
  assert.equal(within({ company: 'Globex', title: 'Senior Backend Engineer' }).skip, false);
});

test('buildCooldownFilter: cross_role_bucket keyword match (and generic words ignored)', () => {
  const windows = {
    'Acme': { last_apply_date: '2026-05-01', same_role_days: 30, cross_role_bucket: 'backend_all' },
  };
  const f = buildCooldownFilter(windows, '2026-05-10');
  assert.equal(f({ company: 'Acme', title: 'Backend Developer' }).skip, true); // "backend" hits
  assert.equal(f({ company: 'Acme', title: 'Frontend Developer' }).skip, false); // "all" is generic-ignored
});

test('buildCooldownFilter: empty windows → no-op filter', () => {
  const f = buildCooldownFilter({}, '2026-05-10');
  assert.equal(f({ company: 'Acme', title: 'X' }).skip, false);
  assert.equal(buildCooldownFilter(null, '2026-05-10')({ company: 'A', title: 'B' }).skip, false);
});
