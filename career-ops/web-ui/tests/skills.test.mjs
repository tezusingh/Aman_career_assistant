/**
 * Unit tests for public/js/lib/skills.js — pure browser module.
 * We load it under a synthetic globalThis.window so the IIFE assigns
 * window.Skills, then exercise it from Node's test runner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, '..', 'public', 'js', 'lib', 'skills.js'),
  'utf8'
);

// Set up a fake `window` object the IIFE can attach to.
globalThis.window = {};
new Function(SRC)();
const Skills = globalThis.window.Skills;

// ───────────────────────── detectTech ─────────────────────────

test('detectTech: PHP variants', () => {
  assert.deepEqual(Skills.detectTech({ title: 'Senior PHP Developer (Symfony)' }).sort(),
    ['PHP', 'Symfony'].sort());
});

test('detectTech: Go vs Golang', () => {
  assert.ok(Skills.detectTech({ title: 'Senior Go Engineer' }).includes('Go'));
  assert.ok(Skills.detectTech({ title: 'Golang Backend' }).includes('Go'));
});

test('detectTech: backend / microservices / high-load', () => {
  const t = Skills.detectTech({ title: 'Senior Backend Engineer · microservices · high-load' });
  assert.ok(t.includes('Backend'));
  assert.ok(t.includes('Microservices'));
  assert.ok(t.includes('High-load'));
});

test('detectTech: ML / AI keywords', () => {
  assert.ok(Skills.detectTech({ title: 'Staff Engineer, LLM platform' }).includes('ML / AI'));
  assert.ok(Skills.detectTech({ title: 'Senior AI Researcher' }).includes('ML / AI'));
});

test('detectTech: Russian backend', () => {
  assert.ok(Skills.detectTech({ title: 'Senior Бэкенд-разработчик (Go)' }).includes('Backend'));
});

test('detectTech: empty / no match', () => {
  assert.deepEqual(Skills.detectTech({ title: '' }), []);
  assert.deepEqual(Skills.detectTech({ title: 'Office Manager' }), []);
});

// ───────────────────────── detectLevel ─────────────────────────

test('detectLevel: Senior / Lead / Principal / Manager / Junior / Тимлид', () => {
  assert.ok(Skills.detectLevel({ title: 'Senior Backend Engineer' }).includes('Senior'));
  assert.ok(Skills.detectLevel({ title: 'Tech Lead PHP' }).includes('Lead / Tech Lead'));
  assert.ok(Skills.detectLevel({ title: 'Engineering Manager' }).includes('Manager'));
  assert.ok(Skills.detectLevel({ title: 'Principal Engineer' }).includes('Principal / Staff'));
  assert.ok(Skills.detectLevel({ title: 'Staff Software Engineer' }).includes('Principal / Staff'));
  assert.ok(Skills.detectLevel({ title: 'Junior PHP Developer' }).includes('Junior'));
  assert.ok(Skills.detectLevel({ title: 'Тимлид Go' }).includes('Lead / Tech Lead'));
  assert.ok(Skills.detectLevel({ title: 'Старший разработчик' }).includes('Senior'));
});

// ───────────────────────── computeFacets ─────────────────────────

test('computeFacets: produces tech + level counts', () => {
  const rows = [
    { title: 'Senior PHP Developer' },
    { title: 'Senior PHP Backend Engineer · Symfony' },
    { title: 'Tech Lead Go' },
    { title: 'Junior Frontend' },
  ];
  const f = Skills.computeFacets(rows);
  assert.equal(f.tech['PHP'], 2);
  assert.equal(f.tech['Symfony'], 1);
  assert.equal(f.tech['Go'], 1);
  assert.equal(f.tech['Backend'], 1);
  assert.equal(f.tech['Frontend'], 1);
  assert.equal(f.level['Senior'], 2);
  assert.equal(f.level['Lead / Tech Lead'], 1);
  assert.equal(f.level['Junior'], 1);
});

// ───────────────────────── rowMatches ─────────────────────────

test('rowMatches: empty filters → always true', () => {
  assert.equal(Skills.rowMatches({ title: 'Anything' }, new Set(), new Set()), true);
});

test('rowMatches: tech filter must match', () => {
  const r = { title: 'Senior PHP Developer' };
  assert.equal(Skills.rowMatches(r, new Set(['PHP']), new Set()), true);
  assert.equal(Skills.rowMatches(r, new Set(['Go']), new Set()), false);
});

test('rowMatches: level filter must match', () => {
  const r = { title: 'Senior PHP Developer' };
  assert.equal(Skills.rowMatches(r, new Set(), new Set(['Senior'])), true);
  assert.equal(Skills.rowMatches(r, new Set(), new Set(['Junior'])), false);
});

test('rowMatches: tech AND level (intersection across categories)', () => {
  const r = { title: 'Senior PHP Developer' };
  assert.equal(Skills.rowMatches(r, new Set(['PHP']), new Set(['Senior'])), true);
  // PHP matches but Junior doesn't
  assert.equal(Skills.rowMatches(r, new Set(['PHP']), new Set(['Junior'])), false);
  // Senior matches but Go doesn't
  assert.equal(Skills.rowMatches(r, new Set(['Go']),  new Set(['Senior'])), false);
});

test('rowMatches: multiple values within one category (OR)', () => {
  const r = { title: 'Senior PHP Developer' };
  // Either PHP or Go would match → true
  assert.equal(Skills.rowMatches(r, new Set(['PHP', 'Go']), new Set()), true);
});
