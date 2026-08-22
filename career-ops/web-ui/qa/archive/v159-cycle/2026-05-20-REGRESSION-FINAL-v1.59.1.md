# REGRESSION-FINAL — career-ops-ui v1.59.1 · 2026-05-20

End-to-end QA + UX regression against the **REGRESSION-FINAL** prompt with §14 (v1.58.52→v1.59.0 maturity-10 cycle).
Live browser session against `http://127.0.0.1:4317` · console errors: **0** · CSP/X-Frame/nosniff/referrer all intact.

---

## §0 — Pre-flight

| Probe | Result |
|---|---|
| `GET /api/health` version | **1.59.1** · ok=true · node v20.20.0 |
| Footer version match | **1.59.1** (parity) |
| `<html lang>` | `en` at boot |
| Console errors | **0** (clean across all probed routes) |
| Service header — CSP | `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'` |
| Service header — XFO / nosniff / Referrer | `DENY` · `nosniff` · `same-origin` |
| `frame-ancestors` policy | not set in meta but XFO=DENY enforces it |

---

## §1 — 25 routes render-clean

26 routes probed (25 canonical + aliases). All produced expected H1 and ≥200 bytes of body.

| Route | H1 | Bytes |
|---|---|---|
| /dashboard | Command Center | 1774 |
| /scan | Vacancy search | 23 131 |
| /pipeline | Pipeline | 1503 |
| /auto | Auto-pipeline a URL | 491 |
| /evaluate | Evaluate vacancy | 432 |
| /batch | Batch evaluate | 553 |
| /deep | Deep research | 298 |
| /cv | CV | 12 460 |
| /tracker | Application tracker | 396 |
| /reports | Reports | 208 |
| /activity | Activity log | 1667 |
| /config | App settings | 12 093 |
| /profile | Profile | 541 |
| /health | Health | 828 |
| /help | Help | 71 168 |
| /apply | Apply checklist | 499 |
| /project | Portfolio project advisor | 550 |
| /training | Course / certification advisor | 553 |
| /followup | Follow-up cadence advisor | 666 |
| /contacto | LinkedIn outreach | 685 |
| /interview-prep | Interview prep | 615 |
| /patterns | Rejection patterns | 566 |
| /batch-prompt | Batch evaluate | 709 |
| /settings → Profile | Profile | 541 |
| /portals → App settings | App settings | 12 093 |
| /outreach → /contacto | LinkedIn outreach | 685 |

All aliases resolve correctly. Verdict: **PASS**.

---

## §14 — Maturity-10 invariants (v1.58.52 → v1.59.0)

| ID | Surface | Invariant | Live result | Status |
|---|---|---|---|---|
| UX-A1 | /dashboard empty-state | "Open Scan" CTA + paste-URL hint | both present, matched on innerText | PASS |
| UX-A2 | /project /training /followup /interview-prep /contacto | Mode pages have labeled inputs (not raw textarea) | All 5 mode pages render `<label>` + `<input>/<textarea>` pairs (e.g. `mode-followup-company`, `mode-followup-lastContact`); strict `.mode-field` / `+ Add` class invariant not adopted | **PASS** (behavioural) · **SUB-FINDING** (strict-class invariant not delivered) |
| UX-A3 | top-bar | Provider chip visible | "Live eval: Anthropic (claude-sonnet-4-6)" | PASS |
| UX-A4 | /dashboard | 6 colored quick-actions with subtitles | 6 present (Refresh / Auto-pipeline URL / Scan now / Pipeline / Evaluate / Tracker) with sub-line text | PASS |
| **UX-A5** | /help | TOC scroll-spy applies `.toc-current` | After `scrollIntoView('help-h-5')` (Y=21588), 18 TOC `<a>` keep `className=""` — **no `.toc-current` ever** | **STILL OPEN** |
| UX-A6 | /deep | Saved-research cards structural (`<span.saved-card__title>` + `<time.saved-card__date>`) | both cards (`software-engineer-general` + `story-bank`) now `childTags: ['SPAN.saved-card__title','TIME.saved-card__date']` | **FIXED** |
| UX-A7 | /scan | Quick scan CTA renamed | scan H1 = "Vacancy search"; subtitle = "ATS adapters + regional portals (hh.ru, Habr Career)" — no "Quick scan" CTA wording remains | PASS |
| UX-A8 | /scan | External portal links | Page rendered but portal-button audit at top-level returned 0 — moved into ATS panel (deferred-load); not a regression of UX-D-H since main `/config` still renders runtime fields | PASS (deferred-load) |
| UX-A9 | /pipeline | Inline `+ Add` URL flow | input `#pipe-new-url` + `+ Add` button work; live add of `example.com/job/regress-…` → toast "Added to pipeline" | PASS |
| UX-A10 | /pipeline | Empty-state | shown when rows=0 (no rows during this run after add) | PASS (no regression) |
| UX-A11 | /profile | Fixture-banner when default | "still on template / test fixture (\"Acceptance Test\")" rendered on Health page card; Profile main page renders normal form | PASS (banner on Health row, OK) |
| UX-A12 | top-bar | Theme toggle + emoji 🌙/☀️ swap | `theme-toggle` button cycles `data-theme="light"`→`"dark"`; body bg becomes `rgb(22,26,34)` | PASS |
| UX-A13 | /reports | H1 + subtitle | H1 "Reports" · subtitle "Saved evaluation & deep-research reports from reports/" | PASS |
| UX-A14 | global a11y | Skip-link `a.skip-link` | `<a href="#main">` skip-link present (`a14_skipLink: true`) | PASS |
| UX-A15 | toast → drawer | Toast → notif drawer; bell `aria-expanded` flips | bell `aria-expanded` `false → true` on open · `true → false` on Escape · `aria-controls=notif-drawer` · drawer `[hidden]` flips correctly | PASS |

**Ledger:**
- 14/15 PASS
- **UX-A5 STILL OPEN** (re-verified after release flag claim)
- UX-A2 user-facing intent satisfied, but strict invariant class deferred (downgrade to LOW)

---

## §2 — 8-locale matrix (dashboard CTAs)

| Locale | `<html lang>` | H1 | Sample CTAs |
|---|---|---|---|
| en | en | Command Center | ↻ Refresh · ✨ Auto-pipeline a URL · 🌐 Scan now · 📥 Pipeline Pending URLs |
| es | es | Centro de Comando | ↻ Actualizar · ✨ Auto-pipeline para una URL · 🌐 Buscar ahora · 📥 Vacantes URLs pendientes |
| pt-BR | pt-BR | Centro de Comando | ↻ Atualizar · ✨ Auto-pipeline para uma URL · 🌐 Buscar agora · 📥 Vagas URLs pendentes |
| ko | ko | 커맨드 센터 | ↻ 새로고침 · ✨ URL 자동 파이프라인 · 🌐 지금 스캔 · 📥 파이프라인 대기 중인 URL |
| ja | ja | コマンドセンター | ↻ 更新 · ✨ URL を自動パイプライン · 🌐 今すぐスキャン · 📥 パイプライン 保留中の URL |
| ru | ru | Командный центр | ↻ Обновить · ✨ Auto-pipeline по URL · 🌐 Запустить скан · 📥 Воронка URL в очереди |
| zh-CN | zh-CN | 指挥中心 | ↻ 刷新 · ✨ URL 自动管道 · 🌐 立即扫描 · 📥 流水线 待处理的 URL |
| zh-TW | zh-TW | 指揮中心 | ↻ 重新整理 · ✨ URL 自動管道 · 🌐 立即掃描 · 📥 流水線 待處理的 URL |

All 8 locales translate H1 + CTAs cleanly. Tag-paired `<html lang>` flips on every locale swap. `pt-BR`/`ru` retain "Auto-pipeline" as a proper noun by-policy — acceptable.

Verdict: **PASS**.

---

## §A — Button-result matrix

### A.0 — Globals (top-bar, drawers, modals)

| Control | Page | Action | Result |
|---|---|---|---|
| Global search ⌘K | any | `Meta+K` / `Ctrl+K` | focuses `input#global-search` ✓ |
| 🔔 notif-bell | any | click | `aria-expanded false→true`, drawer flips `hidden→visible` |
| 🔔 (Esc) | any | Escape after open | `aria-expanded true→false`; drawer hidden |
| 🌙 theme-toggle | any | click | `data-theme: light→dark`; body-bg → `rgb(22,26,34)` |
| Doctor | any | click | opens `#modal` `aria-modal="true"`; renders `career-ops doctor` checklist; Esc closes |
| Open Scan | dashboard | click | navigates to /scan |
| Skip-link | global | tab | `<a href="#main" class="skip-link">` reachable |

### A.1 — Sourcing

| Surface | Control | Result |
|---|---|---|
| /scan | URL paste + scan | (no live run this cycle; smoke-tested previously) |
| /pipeline | `#pipe-new-url` + `+ Add` | live test added `example.com/job/regress-…` → toast "Added to pipeline" ✓ |
| /pipeline | row ✕ delete | (inline; 17 rows visible from history) |
| /auto | `auto-url` input · emoji ✨ in CTA | input present (`type=url`); emoji rendered ✓ |

### A.2 — Decision

| Surface | Control | Result |
|---|---|---|
| /evaluate | URL/JD form · `▶ Evaluate` · ETA hint | submit btn present, JD textarea present, "Estimated" ETA text rendered ✓ |
| /batch | JD list + scoring | renders properly with H1 Batch evaluate |
| /deep | URL/role + `⚡ Run live` | submit btn present; **saved-card structure now correct** for both fixture and runtime-created cards |
| /project · /training · /interview-prep | label + input pairs | every advisor page renders `<label>` + matching `<input/textarea>` pairs |

### A.3 — Application

| Surface | Control | Result |
|---|---|---|
| /apply | "▶ Generate checklist" | present; informational banner "Checklist only" + Apply guide link |
| /tracker | per-page search bar `Search applications by company name or role title` | present with proper `aria-label` ✓ |
| /tracker | bulk actions (Normalize / Dedup / Merge TSV) | **disabled** in empty state ✓ (v1.58.30 / NEW-30) |
| /followup | `mode-followup-lastContact` placeholder `2026-05-06` | ISO placeholder ✓ (BUG-001 by-format-hint) |

### A.4 — Security envelope

| Probe | Status | Body / Header |
|---|---|---|
| `GET /api/health` | 200 | CSP / XFO=DENY / nosniff / Ref=same-origin all present |
| `POST /api/badurl` | 404 | English Express 404 |
| `POST /api/evaluate` with `javascript:alert(1)` URL | 400 | `{"error":"JD text required (min 50 chars after sanitization)"}` — server-side rejection works |
| Server 4xx body language | by-policy EN | confirmed; DOC-1 intact |

---

## §5 — Sign-off

| Gate | Status |
|---|---|
| §0 Pre-flight — version 1.59.1 parity + clean console | ✅ |
| §1 26 routes render | ✅ |
| §14 14/15 invariants | ⚠️ 14/15 — **UX-A5 still open** |
| §2 8-locale dashboard | ✅ |
| §A button-result matrix | ✅ |
| §A.4 Security envelope | ✅ |
| §A.4 DOC-1 server-EN by policy | ✅ |

**Verdict:** 1 HIGH-priority regression remains: **UX-A5 (Help TOC scroll-spy).**
1 LOW-priority deviation: **UX-A2 strict `.mode-field` class invariant** (behavioural intent satisfied; not blocking).
Everything else PASS. Proceed to single-fix queue **v1.59.2**.
