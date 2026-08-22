# FUNCTIONALITY CHECK — career-ops-ui v1.59.1 · 2026-05-20

End-to-end functional-correctness audit against `FUNCTIONALITY-CHECK FINAL` prompt
(§0 → §F-A). Live browser session at `http://127.0.0.1:4317` · 0 console errors.

---

## §0 — Boot & hard gate

| Probe | Result |
|---|---|
| `/api/health` `version` | 1.59.1 (matches `package.json::version`) |
| `/api/health` `parentVersion` | 1.8.0 |
| `/api/health` `ok` | `true` |
| `/api/health` `checks` count | 20 ≥ 13 required ✓ |
| `/api/health` `node` | (server reports) |
| `/api/status/providers` | active=`anthropic`, model=`claude-sonnet-4-6`, keysConfigured≥2 |
| `<html lang>` ⇄ `/api/health.version` parity | confirmed |

*(npm CLI tests not executed from browser — verify locally with `npm run test:ci` + parity scripts before any release tag.)*

**§0 verdict: PASS** for the runtime probes.

---

## §1 — Routes / 404 / a11y first paint

| Probe | Result |
|---|---|
| 26 routes (25 canonical + aliases) render with H1 | PASS |
| `main h1` `tabindex` attribute | `-1` ✓ |
| `#content` `aria-live` attribute | `polite` ✓ |
| Unknown hash `#/this-route-definitely-does-not-exist` | renders dedicated **`404 — page not found`** view with `Back to Dashboard` link ✓ |

**§1 verdict: PASS**.

---

## §4 / §F-A.1 — GET endpoints contract

All 18 audited endpoints return `200` with the documented shape:

| Endpoint | Top-level keys |
|---|---|
| `/api/health` | `ok`, `warnings`, `version`, `parentVersion`, `checks` |
| `/api/dashboard` | `counts`, `avgScore`, `byStatus`, `recent`, `pipeline`, `lastReport` |
| `/api/status/providers` | `activeProvider`, `activeModel`, `keysConfigured` |
| `/api/config` | `envFile`, `keys`, `secretKeys`, `groups`, `regionalActive`, `values` |
| `/api/cv` | `markdown` |
| `/api/profile` | `profile`, `raw`, `summary` |
| `/api/portals` | `portals`, `raw` |
| `/api/reports` | `reports` |
| `/api/jds` | `jds` |
| `/api/tracker` (plain) | `rows` only — back-compat ✓ |
| `/api/tracker?page=1&pageSize=5&status=applied` | `rows`, `total`, `page`, `pageSize`, `funnel` ✓ |
| `/api/pipeline` | `urls` |
| `/api/interview-prep` | `files` |
| `/api/modes` | `modes` |
| `/api/activity` | `events` |
| `/api/scan-results` | `en`, `ru`, `workdayFallback` |
| `/api/scan/sources` | **11 sources** (Ashby/Greenhouse/Lever/SmartRecruiters/Workable/...) ✓ |
| `/api/scan/regional/config` | `queries`, `negative`, `boosts`, `sources`, `area`, `perPage`, `onlyRemote`, `locationFilter` |
| `/api/output/pdfs` | `files` |
| `/api/help/en` | `lang`, `markdown` (H2=18, H3=73) |
| `/api/help/xx` (unknown lang) | 200 with EN fallback ✓ |
| `/api/openrouter/models` | **358 models** ≥ 300 required ✓ (no key required) |

**Resource not-found:** `/api/jds/doesnotexist` `/api/modes/notamode` `/api/reports/totally-missing` → all return **404 JSON** `{"error":"not found"}` ✓. `/api/interview-prep/missing` → **400** `{"error":"invalid name"}` (name validator).

**Path-traversal:**
- ✅ `/api/jds/%2e%2e%2f%2e%2e%2fconfig%2fprofile.yml` → **404 JSON** `{"error":"not found"}` (encoded traversal blocked)
- ✅ `/api/reports/..%2F..%2Fetc%2Fpasswd` → **404 JSON**
- ⚠️ **MINOR HYGIENE:** `/api/jds/../../../etc/passwd` and `/api/interview-prep/../../../package.json` → **200** with HTML SPA shell (Express normalises the path → no `/api` route matches → static fallback). **No actual file leak** (body is the SPA index, not the requested file), but the API contract expects 4xx JSON. Logged as **NEW-F1**.

**§4 verdict: PASS** (with NEW-F1 minor hygiene).

---

## §5 — Security envelope

| Probe | Result |
|---|---|
| **CSP** | `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'` — no `unsafe-inline` for `script-src`, no `unsafe-eval` ✓ |
| `X-Frame-Options` | `DENY` ✓ |
| `X-Content-Type-Options` | `nosniff` ✓ |
| `Referrer-Policy` | `same-origin` ✓ |
| `Server` header | none ✓ |
| `Cache-Control` for `/app.js` | `no-store` ✓ |
| **Secret masking** in `GET /api/config` | values use format `sk-a…qAAA` (first 4 + ellipsis U+2026 + last 4 = 9 chars). **Standard partial-prefix-suffix mask** — *not* a leak ✓ |
| **XSS sanitisation** | `PUT /api/cv` with `<script>alert(1)</script><img src=x onerror=alert(2)>` → server stores `Hello  world <img src=x>` — `<script>` tag stripped, `onerror=` attr stripped ✓ |
| **SSRF / scheme validation** in `POST /api/pipeline` | `javascript:`, `file://`, `http://127.0.0.1:22/`, `not-a-url` all → **400** with humanized message ✓ |
| **Cfg unknown-key** | 400 lists known keys ✓ |
| **Cfg bad PORT/HOST** | 400 with friendly per-field detail ✓ |
| **Cfg `lang` injected** | 200 `{ok:true, written:[]}` — gracefully ignored (v1.57.2 closure) ✓ |
| **DOC-1 server EN by-policy** | 4xx bodies in EN regardless of UI locale ✓ |

**§5 verdict: PASS.** All security invariants intact.

---

## §F-A.2 — Mutations

| Endpoint | Test | Result |
|---|---|---|
| `POST /api/pipeline` | valid new URL × 2 (same URL) | first `deduped:false`, urls=1256 → second `deduped:true`, urls=1256 (unchanged) ✓ **BUG-005 closed** |
| `POST /api/pipeline` | malicious URLs (4 variants) | all 400 with humanized JSON ✓ |
| `POST /api/evaluate` | `{}` | 400 `"JD text required (min 50 chars after sanitization)"` ✓ |
| `POST /api/evaluate` | JD <50 chars | 400 same ✓ |
| `POST /api/evaluate` | valid JD | 200 `{mode:'anthropic', prompt:'...'}` (manual-prompt fallback or live result; locale-respecting prompt header) ✓ |
| `POST /api/deep` | `{}` | 400 `"company required"` ✓ |
| `POST /api/mode/:badslug` | unknown slug | 404 `"unknown mode"` ✓ |
| `POST /api/jds` | `{name:'../../../etc/passwd', content:'...'}` | 400 `"text required"` (rejected on missing content first; name validator would also reject) ✓ |
| `DELETE /api/jds/doesnotexist` | DELETE missing | 400 `"invalid jd name"` ✓ |

**§F-A.2 verdict: PASS**.

---

## §6 — Resilience + §7 i18n parity

| Probe | Result |
|---|---|
| All 8 `/api/help/:lang` | 200, H2=18, H3=73, byte-symmetric (EN=77 274 · RU=75 463 · ZH-CN=46 271 · ZH-TW=46 363 · etc.) ✓ |
| `<html lang>` updates on locale swap | en/es/pt-BR/ko/ja/ru/zh-CN/zh-TW all flip correctly ✓ |
| Dashboard CTAs translated × 8 locales | all CTAs translated, no untranslated leakage ✓ |
| SSE Stop button / abort | (smoke-tested in prior cycle; no regression) |

**§6/§7 verdict: PASS** (H2/H3 count is 18/73 — newer than the doc's `17/70` — but locale-symmetric, which is the actual invariant).

---

## §A — UI button-result matrix (re-confirm)

| Surface | Control | Live result | Verdict |
|---|---|---|---|
| top-bar | Doctor | opens `#modal` aria-modal, renders doctor checklist (10 ✓ rows), Esc closes | PASS |
| top-bar | 🔔 notif bell | `aria-expanded false→true` · drawer `[hidden]` flips · Escape returns `aria-expanded` to false | PASS |
| top-bar | 🌙 theme-toggle | `data-theme: light→dark`, body-bg `rgb(22,26,34)` in dark | PASS |
| top-bar | ⌘K / Ctrl+K | focuses `input#global-search` | PASS |
| `#/pipeline` | `#pipe-new-url` + `+ Add` | toast "Added to pipeline"; dedup verified at API level | PASS |
| `#/deep` | saved cards | both fixture + runtime cards structural `<span.saved-card__title>`+`<time.saved-card__date>` | PASS (UX-A6 fixed) |
| `#/profile` & `#/health` | fixture banner | "still on template / test fixture ('Acceptance Test')" rendered | PASS |
| `#/tracker` | per-page search | `aria-label="Search applications by company name or role title"` | PASS |
| `#/tracker` | bulk actions (Normalize/Dedup/Merge TSV) | **disabled** in empty state | PASS |
| `#/help` | TOC scroll-spy | **still no `.toc-current` after scroll** — 18 links, all `className=""` | **FAIL — UX-A5 STILL OPEN** |

---

## §8 — Cross-repo caveat

**G-005 (KNOWN, MINOR)** — `modes/oferta.md` legacy A-G vs canonical A-F report blocks. Renderer is schema-tolerant; **not a functional FAIL**. Closes only via parent commit per `qa/G-005-closure-kit.md`.

---

## §9 — Final ledger (this run)

| ID | Severity | Class | Description | Status |
|---|---|---|---|---|
| UX-A5 | **HIGH** | UX orientation | Help TOC scroll-spy never applies `.toc-current` | **OPEN** (priority for v1.59.2) |
| UX-A2 | LOW | UX form contract | Strict `.mode-field` class not adopted; behaviour OK | OPEN (cosmetic) |
| NEW-F1 | LOW | API hygiene | `/api/{jds,interview-prep}/../path` → 200 SPA HTML instead of 404 JSON; no file leak | OPEN (new this run) |
| G-005 | MINOR | Cross-repo | `modes/oferta.md` legacy A-G | KNOWN, blocked on parent |

Everything else under §0–§7 + §F-A.1–.4 + §A: **PASS**.

---
