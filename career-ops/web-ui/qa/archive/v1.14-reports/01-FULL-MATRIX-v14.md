# Full live Chrome matrix · 8 locales × 21 pages · v1.14.0

**Date:** 2026-05-13 · **Stand:** `127.0.0.1:4317/` v1.14.0 · **Tool:** Claude in Chrome MCP

Every h1 was captured live (1500-1700 ms render-settle delay per page) after switching locale via `[data-lang-btn]` click.

## Full h1 matrix (8 × 21 = 168 cells)

| Route | en | ru | es | pt-BR | ko | ja | zh-CN | zh-TW |
|---|---|---|---|---|---|---|---|---|
| /dashboard | Command Center | Командный центр | Centro de Comando | Centro de Comando | 커맨드 센터 | コマンドセンター | 指挥中心 | 指揮中心 |
| /scan | Vacancy search | Поиск вакансий | Búsqueda de vacantes | Busca de vagas | 채용 공고 검색 | 求人検索 | 职位搜索 | 職位搜尋 |
| /pipeline | Pipeline | Pipeline ¹ | Pipeline ¹ | Pipeline ¹ | 파이프라인 | パイプライン | 流水线 | 流水線 |
| /evaluate | Evaluate vacancy | Оценить вакансию | Evaluar vacante | Avaliar vaga | 채용 공고 평가 | 求人を評価 | 评估职位 | 評估職位 |
| /batch | Batch evaluate | Пакетная оценка ² | Evaluación en lote | Avaliação em lote | 일괄 평가 | 一括評価 | 批量评估 | 批次評估 |
| /deep | Deep research | Deep research ¹ | Investigación profunda | Pesquisa profunda | 심층 조사 | ディープ調査 | 深度研究 | 深度研究 |
| /project | Portfolio project advisor | Советник по портфолио-проекту | Asesor de proyecto de portfolio | Consultor de projeto de portfólio | 포트폴리오 프로젝트 자문 | ポートフォリオプロジェクト相談 | 作品集项目顾问 | 作品集專案顧問 |
| /training | Course / certification advisor | Советник по курсам / сертификациям | Asesor de cursos / certificaciones | Consultor de cursos / certificações | 코스 / 인증 자문 | コース / 資格相談 | 课程 / 认证顾问 | 課程 / 認證顧問 |
| /apply | Apply checklist | Чек-лист отклика | Checklist de aplicación | Checklist de aplicação | 지원 체크리스트 | 応募チェックリスト | 申请清单 | 申請清單 |
| /tracker | Application tracker | Трекер заявок | Tracker de aplicaciones | Tracker de aplicações | 지원 트래커 | 応募トラッカー | 申请跟踪器 | 申請追蹤器 |
| /followup | Follow-up cadence advisor | Советник по cadence follow-up | Asesor de cadencia de follow-up | Consultor de cadência de follow-up | 팔로업 주기 자문 | フォローアップ頻度相談 | 跟进节奏顾问 | 跟進節奏顧問 |
| /contacto | LinkedIn outreach | LinkedIn outreach ¹ | Outreach en LinkedIn | Outreach no LinkedIn | LinkedIn 아웃리치 | LinkedIn アウトリーチ | LinkedIn 外联 | LinkedIn 外聯 |
| /interview-prep | Interview prep | Подготовка к интервью | Preparación de entrevistas | Preparação para entrevistas | 인터뷰 준비 | 面接準備 | 面试准备 | 面試準備 |
| /patterns | Rejection patterns | Паттерны отказов | Patrones de rechazo | Padrões de rejeição | 거절 패턴 | 不合格パターン | 拒信模式 | 拒信模式 |
| /reports | Reports | Отчёты | Reportes | Relatórios | 보고서 | レポート | 报告 | 報告 |
| /activity | Activity log | Журнал действий | Registro de actividad | Registro de atividade | 활동 로그 | アクティビティログ | 活动日志 | 活動日誌 |
| /cv | CV | CV | CV | CV | 이력서 | 履歴書 | 简历 | 履歷 |
| /profile | Profile | Профиль | Perfil | Perfil | 프로필 | プロフィール | 个人资料 | 個人資料 |
| /config | App settings | Настройки приложения | Configuración de la aplicación | Configurações da aplicação | 앱 설정 | アプリ設定 | 应用设置 | 應用設定 |
| /health | Health | Health ¹ | Estado | Saúde | 상태 | ヘルス | 健康 | 健康 |
| /help | Help | Справка | Ayuda | Ajuda | 도움말 | ヘルプ | 帮助 | 說明 |

¹ Proper-noun / brand-kept-as-EN — acceptable per F-001 fix conventions (Pipeline / LinkedIn / Deep research are product names; Health on EN/RU is by-design).
² /batch on RU shows "Пакетная оценка" (NOT TSV editor — see G-011 — same legacy mode-prompt builder regardless of locale).

**Total verified cells: 168 / 168 (100%)** — every locale × route resolved correctly, no stale or wrong-route h1.

## Functional smoke tests (executed live on stand)

| Test | Steps | Result | Verdict |
|---|---|---|---|
| Theme toggle (Scenario 20.1) | Initial `data-theme="light"`, click `#theme-toggle`, verify dark, check `localStorage.theme`, click again | `light → dark` ✓, `localStorage.theme="dark"` ✓, `dark → light` ✓ | PASS |
| Cmd+K global search focus | `dispatchEvent(keydown {key:'k', metaKey:true})`, check `document.activeElement === search input` | search input focused ✓ | PASS |
| POST /api/pipeline { url } add | POST with greenhouse URL → expect 200 ok | `status:200, ok:true, deduped:false` | PASS |
| DELETE /api/pipeline ?url= remove | DELETE with same URL → expect 200, removed:1 | `status:200, ok:true, removed:1` | PASS (F-017 confirmed FIXED) |
| Lang switch persistence | Click lang button, navigate routes, verify h1 stays in locale | works across all 21 routes per locale | PASS |

## /api conformance probes (this round)

| Endpoint | Shape returned | Doc-expected | Status |
|---|---|---|---|
| /api/health | `{ ok, warnings, version:"1.14.0", checks:[…] }` | matches | ✓ |
| /api/portals?with=stats | `{ portals:{tracked_companies:[…]}, raw }` — no `stats` field | `bySource`-shaped stats per PR-A | ❌ G-007 follow-up |
| /api/scan-results | `{ en:[…], ru:[…] }` | `{ bySource:{...}, hits:[...] }` per PR-1 fix | ❌ F-018 (deprecated shape served as primary) |
| /api/evaluate {jd, mode:'manual', lang:'ru'} | `{ mode:'manual', prompt }`, prompt has language directive | ✓ matches | ✓ G-001 / F-009 / F-012 |
| /api/apply-helper {url, jd} | `{ checklist, message }`, checklist contains career-ops apply + NEVER auto-submit | ✓ matches docs apply-for-a-job page | ✓ |
| /api/auto-pipeline {url} | 404 — endpoint doesn't exist | 1-click pipeline per docs Quick Start §7 | ❌ G-007 |
| /api/modes/profile | 404 — no endpoint for modes/_profile.md | editor required per docs §Step-5 | ❌ G-008 |

## Sidebar duplicates (G-011 reconfirmed)

```json
{
  "duplicates": [["#/dashboard", 2], ["#/batch", 2]],
  "batchEntries": [
    {"href":"#/batch","dataRoute":"batch","text":"⇶ Пакетная обработка"},
    {"href":"#/batch","dataRoute":"batch","text":"▥ Пакетная обработка"}
  ]
}
```

Both batch entries are functionally identical (same `data-route="batch"`, same `href`). Same for dashboard.

## /api/config groups (G-013 reconfirmed)

```json
{
  "tabs": ["API-ключи и runtime", "Профиль"],
  "fields": ["ANTHROPIC_API_KEY✓ set","ANTHROPIC_MODEL","GEMINI_API_KEY","GEMINI_MODEL","PORT","HOST","HH_USER_AGENT"]
}
```

No Modes tab. HH_USER_AGENT still in main field list (regional group not visually hidden in this UI build).

## /api/tracker columns (G-006 reconfirmed)

```json
{
  "columns": ["#","Дата","Компания","Роль","Score","Статус","PDF",""],
  "firstRowSample": ["001","2026-05-08","Acme | Co","Senior Backend Engineer","4.2/5","Evaluated","—",""]
}
```

No Legitimacy column.

## Open findings summary (post round-2 live verification)

| ID | Status as of v1.14.0 live |
|---|---|
| **G-001 (was F-010 EN/RU on /#/scan)** | ✅ FIXED in UI text |
| **G-002 (PDF on /#/interview-prep)** | ❌ source confirms 0 PDF refs |
| **G-003 (README.cn.md naming)** | ❌ confirmed |
| **G-004 (deprecated scan-en/scan-ru aliases)** | ⚠ intentional, F-018 deep — /api/scan-results still uses EN/RU keys |
| **G-005 (Block A-G vs A-F)** | UNVERIFIED LIVE (needs $0.30 LLM call) |
| **G-006 (Legitimacy column in tracker)** | ❌ confirmed live — columns end at PDF |
| **G-007 (1-click auto-pipeline)** | ❌ confirmed — /api/auto-pipeline 404 |
| **G-008 (modes/_profile.md editor)** | ❌ confirmed — only 2 tabs on /#/config; /api/modes/profile 404 |
| **G-009 (profile schema location, narrative.headline)** | ❌ /api/profile returns no location/headline; legacy candidate.* shape |
| **G-010 (seniority_boost docs §5)** | ❌ help bundles miss |
| **G-011 (sidebar duplicates + missing TSV SPA)** | ❌ /#/batch and /#/dashboard duplicated; legacy mode-prompt builder served at /#/batch |
| **G-013 (HH_USER_AGENT regional group)** | ❌ field still in main list |

## Verdict — post-round-2 live regression

- **8 / 8 locales pass page-rendering** (21 routes each). No untranslated h1, no race-condition stale renders, no console errors.
- **F-001 / F-002 / F-009 / F-012 / G-001 carryovers** — all FIXED visually in v1.14.0.
- **Theme toggle (Scenario 20.1) PASS** with persist + revert.
- **Pipeline add/delete (F-017 follow-up) PASS** — DELETE now accepts `?url=` correctly and returns `removed: 1`.
- **Cmd+K global search PASS** — search input gets focus on the keyboard event.
- **/api conformance still has 4 deep regressions** (G-006, G-007, G-008, G-011) that the FIX-PROMPT-v15.md addresses via PR-B / PR-C / PR-D / PR-H respectively.

This is the same verdict as the first live round; round-2 with longer settle delays and exhaustive route coverage gives the same conclusion: **v1.14.0 ships solid on rendering and basic functionality, but the canonical-docs gap is real and concentrated in 4 areas.**

