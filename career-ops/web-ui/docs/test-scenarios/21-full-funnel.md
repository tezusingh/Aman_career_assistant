# 21 — Full funnel

## Goal

A single test walks the user journey end to end and loops it 3 times to detect state leakage between runs. Covers the contract for: smoke / help bundles / CV save+sanitize / profile / modes / evaluate / deep / apply-helper / pipeline (add+validate+delete) / tracker (with piped name BF-1) / activity log (only successful events).

## Steps (one iteration)

1. **Health green** — `GET /api/health` returns `ok: true`.
2. **Help bundles in 8 locales** — `GET /api/help/<code>` returns a non-empty markdown body; `ko` resolves to `ko-KR`.
3. **CV save** — `PUT /api/cv { markdown }`; read back.
4. **CV XSS strip** — `PUT /api/cv` with `<script>`; verify the persisted body contains no `<script>`.
5. **Profile YAML save + read** — `PUT /api/profile { yaml }`; `GET /api/profile`.
6. **Mode list** — `GET /api/modes` returns ≥ 7 entries.
7. **Mode prompts in 7 slugs** — every allowlisted slug, lang `ru` → prompt contains `Respond in Russian`.
8. **Evaluate in 3 locales** — `{ mode: 'manual', lang }` for en, ru, ja.
9. **Deep research** — `POST /api/deep { company, role }` → manual prompt.
10. **Apply checklist** — `POST /api/apply-helper { url, jd }` → contains `NEVER auto-submit`.
11. **Pipeline add + reject 4 bad URLs** — `not-a-url`, `http://10.0.0.1/x`, `http://169.254.169.254/`, `javascript:alert(1)` all → 400.
12. **Pipeline list** contains the good URL.
13. **Pipeline DELETE** via body, via query, then 404 on miss.
14. **Tracker add** with `"Acme | Co iter${N}"` — pipe survives round-trip (BF-1).
15. **Tracker read back** — find row with piped name.
16. **Activity audit** — zero `ok: false` events (v1.10.1 / F-005); every action above is present.

## Acceptance

The whole flow runs in **< 5 seconds per iteration** and shows zero state leakage across 3 consecutive runs (each iteration uses iteration-stamped values so dedup never short-circuits).

## Test coverage

`tests/full-flow-acceptance.test.mjs` — single test, `timeout: 120000`, loops `runFullFunnel(i)` for `i = 1..3`.
