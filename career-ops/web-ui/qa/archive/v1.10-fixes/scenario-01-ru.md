# Scenario 1 (Smoke Navigation) — RU — PASS

Stand: http://127.0.0.1:4317/  ·  Locale: ru  ·  v1.10.0

| # | Route | h1.page-title | Status |
|---|---|---|---|
| 1 | /#/dashboard | Командный центр | ✓ |
| 2 | /#/scan | Поиск вакансий | ✓ |
| 3 | /#/pipeline | Pipeline | ✓ (i18n F-001) |
| 4 | /#/evaluate | Оценить вакансию | ✓ |
| 5 | /#/deep | Deep research | ✓ (i18n F-001) |
| 6 | /#/project | Советник по портфолио-проекту | ✓ |
| 7 | /#/training | Советник по курсам / сертификациям | ✓ |
| 8 | /#/apply | Чек-лист отклика | ✓ |
| 9 | /#/tracker | Трекер заявок | ✓ |
| 10 | /#/followup | Советник по cadence follow-up | ✓ |
| 11 | /#/batch | Пакетная оценка | ✓ |
| 12 | /#/contacto | LinkedIn outreach | ✓ (i18n F-001) |
| 13 | /#/interview-prep | Подготовка к интервью | ✓ |
| 14 | /#/patterns | Паттерны отказов | ✓ |
| 15 | /#/reports | Отчёты | ✓ |
| 16 | /#/activity | Журнал действий | ✓ |
| 17 | /#/cv | CV | ✓ (i18n F-001) |
| 18 | /#/profile | Профиль | ✓ |
| 19 | /#/config | Настройки приложения | ✓ |
| 20 | /#/health | Health | ✓ (i18n F-001) |
| 21 | /#/help | Справка | ✓ (16 sections, 21 steps) |
| BC | /#/settings | → Профиль (back-compat) | ✓ |

**Console errors:** none captured during run.
**Network failures:** none.
**Verdict:** PASS — all 21 routes + 1 back-compat alias resolved, no JS errors.
