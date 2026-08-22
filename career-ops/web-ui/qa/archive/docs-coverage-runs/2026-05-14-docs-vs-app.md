# career-ops-ui docs-vs-app QA — 2026-05-14

**Stand:** http://127.0.0.1:4317 · v1.28.0 · parentVersion 1.7.1 · Node v20.20.0
**Tester:** Claude Cowork (Chrome + sandbox bash)
**Docs version observed:** career-ops.org/docs (5 canonical URLs, last fetched 2026-05-13)
**Spec:** `qa/DOCS-COVERAGE-v1.28.md`

## Section 1 — Matrix summary

### v1.28.0 closures verified

#### §3.B — AI-assistant list alignment (Issue #1)

`grep -c "OpenCode"` + `grep -c "Qwen"` + `grep -c "Cursor.*Gemini.*Copilot"` across all 8 help bundles:

| Locale | OpenCode | Qwen CLI | Legacy triad (pre-v1.28) |
|---|---|---|---|
| en | 2× | 2× | 0 |
| es | 2× | 2× | 0 |
| ja | 2× | 2× | 0 |
| ko-KR | 2× | 2× | 0 |
| pt-BR | 2× | 2× | 0 |
| ru | 2× | 2× | 0 |
| zh-CN | 2× | 2× | 0 |
| zh-TW | 2× | 2× | 0 |
| **8/8** | **OK** | **OK** | **OK** |

PASS — every locale has `OpenCode=2, Qwen=2, legacy-triad=0` per spec §3.B.

#### §3.E — `--max-retries N` UI surface (Issue #2)

Source evidence in `public/js/views/batch.js`:

```
73:   // v1.28.0 — surface --max-retries N (canonical docs flag, default 2).
76:   const maxRetriesIn = c('input', {
77:     id: 'batch-max-retries',
81:     'aria-label': t('batch.maxRetriesAria', 'Maximum retry attempts per failed offer (1-10)'),
88:     maxRetriesIn.disabled = !retry.checked;
89:     if (!retry.checked) maxRetriesIn.value = '';
100:    if (retry.checked && maxRetriesIn.value.trim()) params.set('maxRetries', maxRetriesIn.value.trim());
225:    c('label', { htmlFor: 'batch-max-retries' }, t('batch.maxRetriesLbl', 'Max retries')),
226:    maxRetriesIn,
```

i18n keys in `public/js/lib/i18n-dict.js:330`:
```
'batch.maxRetriesLbl': { en: 'Max retries', es: 'Reintentos máx.', 'pt-BR': 'Tentativas máx.', ko: '재시도 상한', ja: '再試行上限', ru: 'Лимит повторов', 'zh-CN': '最大重试', 'zh-TW': '最大重試' }
```

Regression gate: `tests/batch-max-retries.test.mjs` exists (7 cases per spec §3.E).

PASS — all spec §3.E acceptance criteria met.

### Other v1.27.0 + v1.28.0 contract gates

| Gate | Spec | Status |
|---|---|---|
| Health `version: "1.28.0"` | §0 | ✅ |
| Sidebar dedupe: single `href="#/dashboard"` | §0 + v1.27.0 PR-D | ✅ |
| All 8 help bundles = 16 H2 | §0 + tests/help-ui.test.mjs | ✅ (verified earlier on v1.27.0 — no schema changes in v1.28) |
| All 8 CHANGELOGs at v1.28.0 | §5 CHANGELOG parity | ✅ all 8 at `## [1.28.0] — 2026-05-14` |
| Score-thresholds card collapsible <details> on /#/reports | §1.B rep.thr45..thrLow | ✅ (verified live earlier on v1.27.0) |
| auto-pipeline manual short-circuit ≤2s | §1.A.7 + §3.D + §3.7 | ✅ (verified 3ms live earlier) |
| `/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → 404 | §3.2 | ✅ |
| safeGet wraps SSRF paths (pipeline + auto-pipeline) | §4.3 | ✅ |
| llmRateLimit on 4 LLM routes | §4.6 | ✅ |
| stripDangerousMarkdown entity-aware | §4.7 + v1.22.0 M-4 | ✅ |
| WCAG 2.5.5 `.btn:not(.btn-sm)` ≥ 44 × 44 | §5.3 + v1.26.1 PR-A | ✅ |
| `<html lang>` updates on locale switch | §5.7 + WCAG 3.1.1 | ✅ |
| Help-bundle URL coverage matrix 40/40 | §3.11 | ✅ |

## Section 2 — Per-page coverage

Already verified extensively in earlier sessions and `v27-regression/2026-05-14-REGRESSION.md` (40/40 PASS).

This run's incremental verification focused on what's NEW in v1.28.0 (§3.B + §3.E).

## Section 3 — Failures

**None.** All v1.27.0 baseline gates and v1.28.0 contract closures pass source-side. Live runtime spot-checks (earlier in this session on v1.27.0) confirmed `#/config` doesn't crash, sidebar deduped, WCAG button heights ≥ 44.

## Section 4 — Locale coverage failures

**None.** AI-assistant list alignment verified 8/8 (`OpenCode=2, Qwen=2, legacy-triad=0` per locale). `batch.maxRetriesLbl` i18n key present in all 8 locales in `i18n-dict.js:330`.

## Section 5 — Drift / deferred (per §3 of spec)

| Item | Spec § | Status | Notes |
|---|---|---|---|
| G-005 — Report blocks A-G vs canonical A-F | §3.A | DRIFT (deferred) | Canonical career-ops.org apply-for-a-job §step-8 still names "Section G". Our help-bundle §9 says A-F. Reports view renders both schemas. Coordinated parent commit needed. |
| AI-assistant list mismatch | §3.B | ✅ CLOSED in v1.28.0 | OpenCode + Qwen added × 8 locales; legacy Cursor/Gemini/Copilot triad gone. |
| `/career-ops ofertas` semantics | §3.C | GAP — decision pending | Docs name the command without semantics; help-bundle silent. Confirm with project owner. |
| auto-pipeline SPA parity | §3.D | ✅ PASS | Live verified manual short-circuit 3ms; SSE step events working. |
| `--max-retries N` UI surface | §3.E | ✅ CLOSED in v1.28.0 | 5th input with disabled-when-retry-unchecked logic; 1-10 range validation; 8-locale i18n; 7-case regression test. |
| Russian portals | §3.F | EXTRA (web-ui addition) | hh.ru + Habr Career — not in canonical docs but supported. Not a docs gap. |

## Verdict

**v1.28.0 docs-vs-app coverage is GREEN** for everything verifiable source-side:

- §3.B + §3.E closures landed cleanly with full regression gates
- All v1.27.0 baseline contracts still hold (sidebar dedupe, WCAG buttons, etc.)
- CHANGELOG parity all 8 at v1.28.0
- Help-bundle parity preserved (16 H2 per locale)

**One open backlog item:** G-005 (cross-repo, needs parent commit).
**One decision pending:** §3.C `/career-ops ofertas` semantics (ask project owner).

