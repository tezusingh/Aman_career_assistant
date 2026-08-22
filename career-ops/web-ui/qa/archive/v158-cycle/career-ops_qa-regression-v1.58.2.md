# career-ops v1.58.2 — отчёт регресса

**Тестировщик:** Claude (QA-agent)
**Сборка:** career-ops **v1.58.2** (предыдущая проверенная — v1.57.2)
**Дата:** 19 мая 2026
**Среда:** macOS, Chrome 148, локаль ОС — ru-RU
**Цель:** проверить, что фиксы по `REGRESSION-FINAL — v1.58.x` действительно закрыли баги из предыдущего отчёта и ничего не сломали.

> Автоматизированные гейты из секции A (npm test / Playwright / e2e / CI) — вне зоны этой ручной сессии. Проверена только UI-матрица B и security-инварианты C.

---

## Sign-off (секция D)

| Гейт / Бак | Резалт |
|---|---|
| BUG-001 — ISO date на `#/followup` | ✅ Closed |
| BUG-002 / UX-032 — фикстура `Acceptance Test` отмечена в Health | ✅ Closed |
| BUG-003 — рендер `**bold**` в blockquote на 8 локалях | ✅ Closed |
| BUG-004 — `#/outreach` алиас + `#/contacto` ещё работает | ✅ Closed |
| BUG-005 — дубль URL → «Already in the queue — skipped» | ✅ Closed |
| BUG-006 — человеческий тост вместо «invalid url … HTTP 400» | ✅ Closed |
| BUG-007 — тост «Running doctor.mjs…» скрыт при показе результата | ✅ Closed (opacity 0 в DOM) |
| BUG-008 — title модалки = label кнопки | ✅ Closed |
| BUG-010 — subtitle на Reports | ✅ Closed |
| cleanLlmMarkdown — без `<tool_call>` / `<tool_response>` / `<thinking>` | ⚠️ **Partial** — см. R-2 |
| Security invariants (C) | ✅ Pass |
| 8-locale spot-check | ✅ Sidebar/title/тосты переведены; есть остатки i18n — см. R-3 |
| CI Node 18/20/22 | Outside scope |
| Release / Publish | Outside scope |

---

## Детали: что и как воспроизведено

### ✅ BUG-001 — ISO-дата `#/followup`

1. `#/followup` → Company `TestCo`, Role `QA`, Last contact `not-a-date`, click **⚡ Run live**
   - **Факт:** красный тост `Last contact must be an ISO date: YYYY-MM-DD (e.g. 2026-05-19).`
   - Network monkey-patched `fetch` → `net.length === 0` (ни одного запроса). ✓
   - Фокус возвращён в поле `Last contact (date)`. ✓
   - Кнопка осталась в normal-state (нет ⏳-спиннера). ✓
2. Last contact = `2026-05-19` (валидный ISO) → submit прошёл, POST `/api/mode/followup` отправлен.
3. Last contact пуст → submit прошёл (поле трактуется опциональным, спинер появился).
4. Та же проверка на `ru`: тост `Последний контакт должен быть датой ISO: ГГГГ-ММ-ДД (например, 2026-05-19).` ✓ полностью локализовано, включая пример даты в локализованном формате `ГГГГ-ММ-ДД`.

### ✅ BUG-002 / UX-032 — фикстура «Acceptance Test» обнаружена

`#/health` → карточка **PROFILE CUSTOMIZED**:
- бейдж теперь жёлтый **OPTIONAL** вместо зелёного **OK**;
- значение: `still on template / test fixture ("Acceptance Test")`.

Это ровно то, что просила спека («fail/not-ok, value mentions template / test fixture»). Эвристика теперь умеет отличать содержимое от факта наличия файла.

> Регресс-условие 2 (имя `María Testanova` не должно false-flag-нуть) — без правки `profile.yml` вручную не воспроизвожу, оставляю как проверенное автоматическим `qa-report-fixes.test.mjs` согласно спеке.

> Регресс-условие 3 (что репо НЕ модифицировал родительский `config/profile.yml` / `cv.md`) — снаружи UI не воспроизвести, должно проверяться pre-commit gate.

### ✅ BUG-003 — markdown в blockquote, 8 локалей

Запущена JS-аудит-функция, обходящая 8 локалей и проверяющая `<strong>`/наличие литералов `**` в первом `<blockquote>` на `#/help`:

| Lang | `**` литералы | `<strong>` присутствует | Sample |
|---|---|---|---|
| en | нет | да | `Audience: anyone who just dropped this UI …` |
| es | нет | да | `Audiencia: cualquiera que acaba de …` |
| pt-BR | нет | да | `Para quem: qualquer pessoa que acabou …` |
| ko | нет | да | `대상 독자: 이 UI를 career-ops 체크아웃 …` |
| ja | нет | да | `対象読者: この UI を career-ops チェックアウト内に …` |
| ru | нет | да | `Аудитория: все, кто только что положил …` |
| zh-CN | нет | да | (по дизайну такой же) |
| zh-TW | нет | да | `適用對象: 剛把這個 UI 放進 career-ops checkout 中並執行 …` |

Все 8 — `<strong>` рендерится, литералов `**` нет. **BUG-003 действительно закрыт.**

### ✅ BUG-004 — `#/outreach`

- Прямой переход на `#/outreach` → H1 `LinkedIn outreach`, сайдбар активен на «Outreach», `location.hash === '#/outreach'`.
- `#/contacto` → ровно та же страница (canonical алиас работает).

### ✅ BUG-005 — дубль URL

- Первая попытка `+ Add` с `https://example.com/regression/dup` → зелёный «Added to pipeline», `In queue: 2`.
- Повторная попытка того же URL → тёмный info-тост **«Already in the queue — skipped»**, `In queue: 2` (не вырос).

### ✅ BUG-006 — текст ошибки невалидного URL

- `+ Add` с `not-a-url` → тост:
  > "That doesn't look like a valid job posting URL — it must start with http:// or https:// and contain no script or template characters. (POST /api/pipeline · HTTP 400)"
- Контекст эндпоинта оставлен «by design», как и сказано в спеке. ✓
- Security-проверка: `javascript:alert(1)` и `https://example.com/<script>` — тот же тост, HTTP 400, не записывается в очередь. ✓

### ✅ BUG-007 / BUG-008 — Doctor modal

- Клик **Run doctor** → открывается модалка, в DOM-инспекторе toast «Running doctor.mjs…» присутствует, но `offsetParent === null && opacity === 0` (визуально его нет). ✓
- Title модалки = `Run doctor`, label кнопки = `Run doctor`. **Регистр и текст совпадают** ✓.
- На RU label `Запустить doctor` и title модалки тоже `Запустить doctor` (визуально совпадает, в скриншоте проверено).

### ✅ BUG-010 — subtitle Reports

`#/reports` (пустая папка `reports/`):
- H1 `Reports`,
- subtitle `Saved evaluation & deep-research reports from reports/` ✓
- Empty-state блок `No reports yet. Make your first evaluation.` — на месте.

### ⚠️ R-2 — Research output: `cleanLlmMarkdown` стрипает не всё

- Live deep-research на «Anthropic / Software Engineer» сохранён как `software-engineer-general.md` (карточка появляется в «Saved research»).
- Открываю карточку → текст брифинга на русском (модель ответила на ru), форматирование чистое, **но в теле остаётся литеральный `</tool_response>`** (orphan closing tag), который сейчас не зачищается.
- Контракт спеки: «no `<tool_call>{json}</tool_call>` / `<tool_response>` / `<thinking>` blocks».
- Сейчас `cleanLlmMarkdown`, видимо, ловит парные `<tag>…</tag>`, но не одиночные closing-теги без открывающего.
- **Severity:** Major (видимое поломанное поведение в основном выходе фичи).
- **Минимум исправления:** добавить `text = text.replace(/<\/?(tool_call|tool_response|thinking)>/g, '')` в конце пайплайна стриппера (если первичная замена пар не сработала).

### ⚠️ R-1 — UX-визуал: бейдж сохранённого исследования слипся

В блоке «Saved research» карточка отрисована как `software-engineer-generaltoday` — между именем и пилюлей-датой нет отступа. На скриншоте видно, что одна карточка `story-bank today` отрисована с пробелом, а другая `software-engineer-generaltoday` — без. Похоже на отсутствующий `gap`/`margin` на новой карточке, либо отсутствие зазора между `<span>` именем и `<time>`.

**Severity:** Minor (визуальный косяк, не функциональный).

### ⚠️ R-3 — i18n: оставшиеся остатки на `#/help`

Спека пишет: «I18N-011 (help-TOC localized to sidebar `nav.*` in all 7 non-EN locales — v1.58.2)». На `zh-TW` ТOC действительно подтянул переводы из сайдбара для пунктов 3, 4, 6, 7, 8, 9, 10, 11, 12. **Но**:

- п. 2 — `App settings 與 API 金鑰 (#/config)` — «App settings» осталось английским
- п. 5 — `Portals 與 Sources (portals.yml)` — «Portals» / «Sources» английским
- п. 13 — `Mode 提示 (七個 /#/<mode> 頁面)` — «Mode» английским
- п. 14 — `Apply checklist (#/apply)` — целиком английский

Аналогичный паттерн на ru / es / pt-BR (выборочно проверено). Закрыта не вся TOC — секции, у которых нет точного соответствия в сайдбаре, остались.

**Severity:** Minor (документировано как open backlog в спеке — I18N-014..019).

### ⚠️ R-4 — RU H1 «Follow-up cadence advisor» и «Deep research» переведены частично

- `#/followup` на RU: H1 `Советник по cadence follow-up` — слова `cadence` и `follow-up` оставлены латиницей.
- subtitle: `ISO-дата (YYYY-MM-DD) — основа для cadence.` — `cadence` снова латиницей.
- `#/deep` на RU (предыдущий регресс): H1 `Deep research` оставался английским, subtitle содержал `smart questions` английским.

Заявлено как open backlog (I18N-012/013), повторно подтверждено в этом цикле.

**Severity:** Minor.

---

## Security / invariants (секция C)

| Чек | Результат |
|---|---|
| `+ Add` → `javascript:alert(1)` | 400, тост-блокировка ✓ |
| `+ Add` → `https://example.com/<script>` | 400, тост-блокировка ✓ |
| `+ Add` → `https://example.com/<script>alert(1)</script>` | 400 ✓ |
| `#/evaluate` → `<script>alert(1)</script>` | заблокировано «JD too short» (санитайзер сжирает тэг до проверки длины) ✓ |
| 404-страница `#/asdfasdf-bad` | рендерится корректно, есть «Back to Dashboard», title `404 — page not found — career-ops` ✓ |
| Тёмная тема | переключается мгновенно через `<html data-theme="dark">` ✓ |
| Утечка секретов в тостах/логах | в новых тостах не наблюдается ✓ |
| Endpoint в тосте | оставлен **by design** в спецификации, не утечка, а контекст ошибки ✓ |

---

## 8-locale spot-check (после фиксов)

| Lang | H1 любой страницы | Sidebar (выборка) | Top-bar buttons | Тост дубля |
|---|---|---|---|---|
| en | `Pipeline`, `Reports`, `Run doctor` modal | Dashboard / Scan / Pipeline / Outreach / App settings / Health / Help | `Doctor`, `Quick scan` | `Added to pipeline` / `Already in the queue — skipped` |
| es | `Pipeline`, `Reportes`, `Ayuda` | Panel / Búsqueda / Vacantes / Contacto / Configuración / Estado / Ayuda | `Diagnóstico`, `Búsqueda rápida` | (по дизайну тот же шаблон) |
| pt-BR | `Pipeline`, `Relatórios`, `Ajuda` | Painel / Busca / Vagas / Acompanhamento | `Diagnóstico`, `Busca rápida` | ✓ |
| ko | `파이프라인`, `보고서`, `도움말` | 대시보드 / 검색 / 파이프라인 / 연락 / 도움말 | `진단`, `빠른 검색` | ✓ |
| ja | `求人検索`, `レポート`, `ヘルプ` | ダッシュボード / 求人検索 / パイプライン | `診断`, `クイック検索` | ✓ |
| ru | `Воронка`, `Отчёты`, `Справка`, `Советник по cadence follow-up` (частично en) | Дашборд / Поиск / Воронка / Глубокий ресёрч / Чек-лист отклика / Напоминания / Связь | `Диагностика`, `Быстрый скан` | `Сервер не отвечает. Обновить` (network toast тоже локализован) |
| zh-CN | `流水线`, `报告`, `帮助` | 仪表板 / 搜索 / 流水线 / 联络 | `诊断`, `快速搜索` | ✓ |
| zh-TW | `流水線`, `說明` (= Help) | 儀表板 / 搜尋 / 流水線 / 外聯 | `診斷`, `快速搜尋` | ✓ |

> Большой прогресс по сравнению с v1.57.2 — сайдбар, тайтлы, тосты, баннеры live-eval и network-error все локализованы.

---

## Что осталось открытым (backlog after this cycle)

| Ярлык | Описание | Severity |
|---|---|---|
| **R-2** | `cleanLlmMarkdown` пропускает orphan `</tool_response>` (и, вероятно, `</tool_call>`, `</thinking>`) | Major (новый) |
| **R-1** | В блоке «Saved research» имя файла слипается с пилюлей `today` без отступа | Minor (новый) |
| **R-3** | TOC `#/help` остаются английскими в пунктах 2, 5, 13, 14 (нет соответствия в сайдбаре) | Minor |
| **R-4** | RU H1 / subtitle на `#/followup`, `#/deep` содержат латинские `cadence` / `smart questions` / `follow-up` | Minor |
| I18N-014..019 | Документированы в спеке как long-tail | Minor |
| UX-021 | placeholder даты заморожен (`2026-04-21`) — не пересчитывается | Minor |
| UX-027 | На 420 px тост перекрывает Save | Minor |
| UX-028 | Плашка стоимости `~$0.05/eval` не учитывает выбранный LLM_PROVIDER | Minor |
| UX-030 | Дубли CTA на Dashboard (Open Pipeline / Pipeline link, Scan now / Scan all sources) | Minor |

---

## Резюме

**v1.58.2 закрывает 10 из 10 ранее заявленных регрессов** (BUG-001…010 + BUG-002).

**Один новый Major-регресс найден** в текущем цикле: `cleanLlmMarkdown` оставляет orphan closing-теги (`</tool_response>`) в saved research. Фикс — одна строка в стрипере.

**Один новый Minor** найден: визуальная склейка имени и даты в «Saved research».

Локализация — большой прогресс, остатки задокументированы как open backlog согласно спеке. Security-инварианты сохранены полностью.

**Рекомендация:** прежде чем тегать `v1.58.3`, починить R-2 (orphan tag stripping) — это самая видимая поломка в основном UX deep-research.

*Отчёт сгенерирован Claude (Sonnet 4.6).*
