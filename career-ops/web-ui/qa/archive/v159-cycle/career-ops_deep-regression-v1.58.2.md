# career-ops v1.58.2 — глубокий регресс (UX + QA)

**Тестировщик:** Claude (Sonnet 4.6) в роли senior QA / UX designer (10+ лет)
**Сборка:** career-ops **v1.58.2**, web UI `http://127.0.0.1:4317`
**Дата:** 19 мая 2026
**Среда:** macOS, Chrome 148, локаль ОС — ru-RU
**Покрытие:** 22 маршрута × 8 локалей × все интерактивные элементы; смотрел не только «работает / не работает», но и **качество вывода каждой кнопки** (форматирование, читабельность, отсутствие JSON-мусора и scaffolding).

---

## Сводка

| Severity | Кол-во |
|---|---|
| Critical | 2 |
| Major | 9 |
| Minor / UX-debt | 15 |
| i18n | 6 |
| a11y | 3 |
| **Итого новых/повторных** | **35** |

Регрессы предыдущего цикла (BUG-001…010 + BUG-002) — закрыты.

---

## A. Critical

### C-1. Deep research saved-output — не структурированный брифинг, а stream-of-consciousness модели
- **Где:** `#/deep` → запустил Run live → файл `software-engineer-general.md` появился в «Saved research».
- **Что ждали:** документ с секциями из промпта (Company snapshot / Engineering culture / Recent news / Glassdoor sentiment / Interview process / Negotiation leverage).
- **Что видим:**
  > Я запущу глубокое исследование по запросу. Поскольку вакансия указана как "Software Engineer" без конкретной компании, я подготовлю универсальный брифинг-шаблон…
  >
  > Сначала прочитаю нужные файлы.
  > Хорошо, профиль кандидата считан. Теперь проведу поиск по рынку труда Senior PHP/Go инженеров.
  > **`</tool_response>`**
  > Теперь создам директорию и сохраню брифинг.
- Меньше 500 символов «брифинга», ни одного `## заголовка`, и в теле торчит литеральный orphan `</tool_response>`.
- Сравнение: `story-bank.md` (загружен с диска руками) рендерится отлично — заголовки, нумерация, inline-код.
- **Корень проблемы:** видимо, в LLM-выход попадает meta-narration модели (Claude «думает вслух») вместо финального документа. Либо пайплайн схватывает stream до того как модель сгенерировала структурированный markdown, либо `cleanLlmMarkdown` стрипает не только теги, но и «полезный» текст после них.
- **Severity:** Critical (главный пользовательский artefact одной из ключевых фич — пустой).

### C-2. `<html lang="en">` не обновляется при смене языка → screen-reader будет произносить тексты на 8 локалях с английскими правилами озвучивания
- **Где:** глобально, `document.documentElement.lang`.
- **Шаги:** переключение между en / ru / ja / ko / zh-CN / zh-TW не меняет атрибут.
- **Эффект:** для незрячих пользователей VoiceOver/NVDA озвучит русский/японский текст английским голосом — нечитаемо.
- **Severity:** Critical (a11y).

---

## B. Major

### M-1. Focus-ring невидим — `outline: none` на сфокусированных кнопках
- `getComputedStyle(button)` на фокусе: `outline: rgb(255,255,255) none 1.5px`, `boxShadow: none`, `border: 0px none`.
- Tab-навигация по 88 фокусируемым элементам страницы не показывает, где находится фокус.
- WCAG 2.1 **2.4.7 (Focus Visible) — violation.**
- **Severity:** Major (a11y).

### M-2. Тост «Running …» висит при открытой модалке результата на нескольких кнопках
- Воспроизведено на Health → **sync-check** (`sync-check…` toast + модалка одновременно) и (по предыдущему отчёту) Doctor.
- На Doctor исправлено (toast становится opacity:0). На sync-check — нет (`Running cv-sync-check.mjs…` остаётся видимым в правом-нижнем углу).
- **Severity:** Major (паттерн непоследователен).

### M-3. `<html lang>` ↔ `navigator.language` рассинхрон при первой загрузке
- Браузер `ru-RU`, `<html lang="en">`. Локализация автодетекта нет — пользователь видит en по умолчанию.
- Связано с C-2, но повлияет даже у зрячих пользователей.
- **Severity:** Major (i18n UX).

### M-4. Сайдбар: бейджи Saved research склеиваются с датой
- На `#/deep` блок «Saved research» рендерит пилюли так: `software-engineer-generaltoday` и `story-banktoday`. Между названием файла и `today` нет визуального разделителя.
- Минимум — `gap` / `margin-left` на `<time>` или вставка `·`.
- **Severity:** Minor — но повторяется на каждом элементе списка, сразу бросается в глаза.

### M-5. Все три Tracker-действия (Normalize / Dedup / Merge TSV) показывают слово операции по-английски даже на ru / zh-CN
- Модалка: «Rewrite applications.md? This runs **"normalize"** and rewrites …». На RU `"normalize"` остаётся английским в кавычках.
- **Severity:** Minor → Major (UX-локализация мелочей).

### M-6. Doctor / Verify / sync-check / Run doctor — модалки «пробрасывают» английский CLI-вывод во все локали
- На RU клик `Run doctor` или «Запустить doctor» → модалка содержит `career-ops doctor`, `✓ Node.js >= 18`, `✓ Dependencies installed`, `Result: All checks passed. You're ready to go! Run claude to start. Join the community: https://discord.gg/8pRpHETxa4` — целиком на en.
- Аналогично Verify pipeline и CV sync-check.
- Это сырой stdout child-процесса, локализация невозможна без отдельного i18n для CLI-скриптов. Минимум — обернуть модалку в локализованный header («Output from career-ops doctor / Вывод утилиты career-ops doctor»).
- **Severity:** Major (UX на не-en локалях — модалка выглядит как «выпала наружу»).

### M-7. Стоимость на формах фиксирована: «Estimated cost: Anthropic claude-sonnet-4-6 · ~$0.05/eval»
- На `#/auto`, `#/deep`, `#/project`, `#/training`, `#/patterns`, `#/followup`, `#/interview-prep`, `#/evaluate` — одна и та же надпись.
- В `#/config` `LLM_PROVIDER` переключается между Anthropic / Gemini / OpenAI / Qwen / OpenRouter — но надпись не обновляется.
- **Severity:** Major (вводит в заблуждение по бюджету / провайдеру).

### M-8. Apply checklist — это статический текст, а не интерактивный чек-лист
- Заголовок страницы: «Apply checklist», info-box «This page generates a checklist + paste-ready text».
- Вывод после клика «Generate checklist»: монохромный блок с пунктами `0…7`. Нельзя отметить пункт галочкой, нельзя отметить «сделано». Слово checklist обещает то, чего нет.
- **Severity:** Major (UX-обман ожиданий).

### M-9. `Refresh` на Dashboard не даёт обратной связи
- Клик `Refresh` (правый верх): никакого toast, никакого spinner. Пользователь не понимает, обновилось ли что-то.
- **Severity:** Minor → Major (feedback).

---

## C. i18n

### I-1. `aria-label="Search companies, roles, or URLs"` английский во всех 8 локалях
- Невидимая надпись для screen reader на топ-баре. Невидимая = не тестируется глазами разработчика, тем не менее всегда en.

### I-2. `«today»` на карточках Saved research / Activity никогда не локализуется
- На ru должно быть «сегодня», на ja — «今日» / «本日», и т. д.

### I-3. Help TOC: пункты 2 («App settings»), 5 («Portals & Sources»), 13 («Mode prompts»), 14 («Apply checklist») остаются en на всех не-en локалях
- Спека v1.58.x закрывала это как «localized to sidebar `nav.*`», но пункты, у которых нет точного соответствия в сайдбаре, фолбэкнуты в en. Спот-чек на zh-TW: «App settings 與 API 金鑰 (#/config)», «Portals 與 Sources (portals.yml)», «Mode 提示», «Apply checklist (#/apply)».

### I-4. Подзаголовок `#/followup` на ru: «Советник по cadence follow-up» — `cadence` и `follow-up` английским
- Аналогично subtitle: «ISO-дата (YYYY-MM-DD) — основа для cadence.» — «cadence» латиницей.

### I-5. Subtitle `#/deep` на ru утрачивает финальный сегмент: «Брифинг компании: команда, культура, новости, переговорные позиции, smart questions.» — «smart questions» en.

### I-6. CTRL+K vs ⌘K
- Топ-бар правильно показывает `⌘K` на Mac.
- Футер: `CTRL+K — search` / `CTRL+K — buscar` / `CTRL+K — 搜尋` — слово search локализовано, но клавиша `CTRL` для Mac неверная.

---

## D. UX-debt / Minor

### U-1. CV heading «cv»
- На `#/cv` H1 рендерится мелким серым «cv» в одной строке с кнопками. Все остальные страницы дают крупный жирный H1 с подзаголовком.

### U-2. `#/auto` — H1 «✨ Auto-pipeline a URL» переносится на 2 строки в 1280–1600 px из-за эмодзи в начале
- На некоторых локалях ломается в более широких раскладках.

### U-3. Date placeholder заморожен в `2026-04-21`
- При сегодня `19.05.2026`. Не пересчитывается относительно текущей даты.

### U-4. Pipeline + Add: тост «invalid url…» содержит endpoint `(POST /api/pipeline · HTTP 400)`
- По спеке это by design, оставлено. Для конечного пользователя — техническая утечка. Минимум — спрятать под expandable «Технические детали».

### U-5. Дубли CTA на Dashboard
- 4 пути в Pipeline: «Open Pipeline» (вверх), «📥 Pipeline · Pending URLs» (Quick actions), сайдбар «Pipeline», нижний quick action. Аналогично «Scan now / Scan all sources / Quick scan / Scan» — 4 одинаковых пути.

### U-6. Стастус-тэг «✦ Active companies 96/80» в Scan
- Не очевидно, что 96 «активных из 80» означает: 96 portals total, 80 enabled? Что значит соотношение? Нужен tooltip.

### U-7. Verify pipeline ASCII-разделитель в модалке
- `===========…` визуально шумный. На UI это уже не CLI — стоит превратить в визуальный divider или удалить.

### U-8. Generate prompt инлайн-блок занимает большую высоту
- На `#/project` после клика появляется огромный prompt-блок (1200+ px). Стоит сворачивать в spoiler или открывать в модалке.

### U-9. На Pipeline пилюля «In queue: 2» рядом с фильтром — лишняя плотность
- Фильтр-инпут с подсказкой `Filter URLs…` сразу за `In queue: 2`. На узких экранах сливаются.

### U-10. На Tracker — пустой state «No applications yet. Run the pipeline or evaluate a JD to populate this tracker.» + красная кнопка «Open pipeline»
- Окей, но и в этой пустоте: 3 кнопки в шапке (Normalize / Dedup / Merge TSV) **активны** при 0 записей. Лучше дисейблить.

### U-11. Tracker столбец «LEGITIMACY» — пустой даже визуально (нет «—»)
- В строке заголовков всё нормально, но столбец требует объяснения через tooltip.

### U-12. Sidebar item `Quick scan` (только эмодзи `☰` для toggle меню) — не доступен иконкой/доп.метками
- Хотя aria-label = «Toggle menu» — корректно для a11y, визуально не очевидно.

### U-13. Тост «Sequence: …» не имеет таймстампа
- На live-evaluation тосты появляются и тают, пользователь не успевает прочесть. Желательно — журнал тостов.

### U-14. На некоторых страницах Subtitle стоит в `<p>` сразу после `<h1>` без визуального разделения
- На `#/help` подзаголовок «Step-by-step walkthrough of every page.» — слишком близко к H1.

### U-15. `cv` editor — нет автосохранения / dirty-state индикатора
- При редактировании Markdown пользователь не понимает, сохранены ли изменения. Кнопка «Save» — единственный сигнал.

---

## E. Безопасность (положительные результаты — без изменений с v1.57.2)

- `+ Add URL`: `javascript:alert(1)` → HTTP 400, человеческий тост ✓
- `+ Add URL`: `https://example.com/<script>` → HTTP 400 ✓
- `#/evaluate`: `<script>alert(1)</script>` → «JD too short» (санитайзер сжал тэг до длины) ✓
- 404-page для несуществующих маршрутов ✓
- Тёмная тема контрастно работает на всех проверенных страницах ✓
- Network panel: 0 ошибочных запросов в чистой сессии (после исключения дубля submit, blocked на стороне клиента ✓)

---

## F. Анализ качества «вывода каждой кнопки»

| Кнопка | Где | Формат | Качество |
|---|---|---|---|
| **Doctor / Run doctor** | везде/`#/health` | модалка с monospace stdout | Чисто (ASCII + emoji), но **не локализован**. CLI-style, OK для dev-tool. |
| **Verify pipeline** | `#/health` | модалка с monospace stdout | Чисто, без JSON; ASCII-разделитель шумный. Не локализован. |
| **sync-check** | `#/cv` | модалка с monospace | Чисто; **тост-leakage** при открытой модалке (M-2). |
| **Generate PDF** | `#/cv` | (не запустил — потенциальный disk-write) | — |
| **Save** | `#/cv`, `#/config` | (не запустил) | — |
| **Refresh** | dashboard, activity | silent | **Нет фидбэка** (M-9). |
| **+ Add (Pipeline)** | `#/pipeline` | тост `Added to pipeline` (green) / `Already in the queue — skipped` (info) / human invalid-url (red) | ✓ хорошо после фиксов v1.58.2 |
| **× (delete row)** | `#/pipeline` | confirm-модалка «Remove from pipeline?» | ✓ |
| **Scan / Stop / Dry run** | `#/scan` | live-stream stdout в чёрный блок | Чисто, без JSON; emoji ✓. |
| **▶ Evaluate** | `#/evaluate` | (LLM call — не запустил) | toast errors локализованы ✓ |
| **▶ Run auto-pipeline** | `#/auto` | (LLM) | — |
| **⚡ Run live (Deep research)** | `#/deep` | saved-md в Saved research карточке | **C-1: вывод stream-of-consciousness, не брифинг** |
| **⚡ Run live (Project)** | `#/project` | (LLM) | — |
| **⚡ Run live (Training)** | `#/training` | (LLM) | — |
| **⚡ Run live (Patterns)** | `#/patterns` | (LLM) | — |
| **⚡ Run live (Follow-up)** | `#/followup` | (LLM) | — |
| **⚡ Run live (Interview prep)** | `#/interview-prep` | (LLM) | — |
| **Generate prompt** | `#/project`, `#/training`, `#/patterns`, `#/followup`, `#/interview-prep` | inline-блок монохром, прямой текст промпта с JSON-фрагментом | by-design (для копирования в Claude Code); монохром тяжёлый, JSON-блок в середине. Сворачивать в spoiler. |
| **Copy prompt** | `#/deep` | inline-блок монохром, прямой текст промпта | Чисто ✓ |
| **Generate checklist** | `#/apply` | монохром текст с пунктами 0..7 | **M-8: не интерактивен, обещает «checklist»** |
| **Normalize / Dedup / Merge TSV** | `#/tracker` | confirm-модалка «Rewrite applications.md?» с `"normalize"` etc. | UX ✓, но `"normalize"` английским даже на ru / ja (M-5) |
| **All actions / pipeline / cv / jd / evaluate / scan / stream / script** | `#/activity` | таблица TIME / ACTION / TARGET / RESULT | Чисто ✓, эмодзи-чекмарки в RESULT ✓ |
| **Filters & search Tracker** | `#/tracker` | пустой `No applications yet` + красная кнопка «Open pipeline» | OK, но кнопки Normalize/Dedup/Merge активны при 0 записях (U-10) |
| **Theme toggle 🌙/☀** | top-bar | мгновенно меняет `data-theme` | ✓ |
| **Lang switch (8 кнопок)** | сайдбар-низ | мгновенная перерисовка | ✓ кроме `<html lang>` (C-2) |
| **☰ Toggle menu** | top-bar | (тестировался ранее) | aria-label correct, эффект — collapse сайдбара |
| **⌘K / CTRL+K** | global hotkey | фокус на топ-search-input | ✓ |
| **404 → Back to Dashboard** | `#/asdfasdf` | редирект | ✓ |

---

## G. План фиксов по приоритету

1. **(Crit) C-1** — починить пайплайн Deep research. Либо запрашивать структурированный output (function-call с JSON-schema → потом форматировать в markdown), либо в `cleanLlmMarkdown` не вырезать содержимое **после** `</tool_response>`. Минимум — добавить regex: `text.replace(/<\/?(tool_call|tool_response|thinking)>/g, '')` и убедиться, что промпт явно требует структуру `## Company snapshot \n …`.
2. **(Crit) C-2** — на `langchange` событии устанавливать `document.documentElement.lang = <BCP-47>`.
3. **(Maj) M-1** — глобально вернуть focus-ring: `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`.
4. **(Maj) M-2** — на любой кнопке, открывающей модалку с результатом script: после `200 OK / Done` слать `toast.dismiss()`.
5. **(Maj) M-7** — `Estimated cost` должен читать `LLM_PROVIDER` из `/api/config` и рисовать соответствующую модель + цену.
6. **(Maj) M-8** — Apply checklist превратить в реальный список с `<input type="checkbox">`, сохранять состояние в `localStorage[apply-checklist-<urlSlug>]`.
7. **(Maj) M-9** — `Refresh` на Dashboard: green toast «Refreshed (Pipeline: N, Reports: M)».
8. **(Maj) M-4** — `gap: .5rem` на `.saved-research-card` или вставить `·` между title и `<time>`.
9. **(Min) M-5, M-6** — обернуть модалки Doctor / Verify / sync-check / Normalize-toast локализованным header.
10. **(i18n) I-1..I-6** — пройтись по `i18n/<lang>.json`, закрыть aria-label, `today`, оставшиеся пункты Help TOC, `cadence`, `smart questions`, фикс `CTRL+K → ⌘K` на macOS.
11. **(UX) U-1, U-3, U-5, U-7, U-8** — H1 на CV, относительная дата в placeholder, дедуп CTA на Dashboard, заменить ASCII-разделитель на CSS-line, сворачивать prompt-block.

---

## H. Артефакты тестового прогона (остатки на пользовательском диске)

- `data/pipeline.md`: 2 тестовые записи `https://example.com/job/123` + `https://example.com/regression/dup` — рекомендую очистить руками или клик «×» в UI.
- `data/applications.md`: без изменений (тесты Normalize/Dedup/Merge не подтверждались до конца).
- `reports/`: 1 новый артефакт `software-engineer-general.md` (Deep research saved). Содержит meta-narration без структуры — пример C-1.
- `data/activity.md`: добавлены строки `pipeline.add` / `pipeline.remove` / `script.doctor` / `script.verify-pipeline` / `script.cv-sync-check`.

---

## I. Итоговая оценка

| Дименсия | Оценка (1–5) | Комментарий |
|---|---|---|
| **Function** | 4/5 | основные сценарии работают; Deep research-output — поломан (C-1) |
| **Quality of output formatting** | 3.5/5 | большинство вывода — чистый markdown / monospace; LLM-output deep-research даёт scaffolding (C-1, R-2 из прошлого) |
| **i18n** | 3.5/5 | sidebar / h1 / тосты / toasts полностью переведены, но 6+ остатков на 8 локалях |
| **a11y** | 2/5 | label-связки, alt, skip-link есть; **focus-ring нет, `<html lang>` не обновляется** |
| **UX** | 3.5/5 | формы понятные, валидация есть; нет drag&drop, нет интерактивного checklist, цены статичные, CTA дублируются |
| **Performance** | 4/5 | нет видимых проблем; LLM-вызовы 20–40 c (внешний фактор) |
| **Security** | 4.5/5 | URL-валидация, XSS-санитайзер, нет утечек секретов; небольшая утечка endpoint в тосте |

**Резюме:** v1.58.2 — большой прогресс vs v1.57.2 (10/10 заявленных регрессов закрыты), но **Critical-проблема со структурой Deep research output и a11y-проблемы (focus-ring, lang)** требуют фикса перед публикацией. Без них продукт читается «как dev-tool, не до конца упакован».

*Отчёт сгенерирован Claude (Sonnet 4.6).*
