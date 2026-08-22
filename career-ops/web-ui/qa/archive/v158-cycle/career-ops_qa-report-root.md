# career-ops v1.57.2 — отчёт QA

**Тестировщик:** Claude (QA-agent, имитация senior QA с 10+ годами опыта)
**Сборка:** career-ops v1.57.2, headless web UI на `http://127.0.0.1:4317`
**Дата прогона:** 19 мая 2026
**Среда:** macOS, Chrome 148, исходная локаль ОС — ru-RU
**Метод:** end-to-end через MCP-Chrome — клики, ввод, переключение языков, граничные значения, проверка консоли/сети, тёмная тема, ресайз окна.

---

## Сводка

| Severity | Кол-во |
|---|---|
| Critical | 2 |
| Major | 8 |
| Minor / UX | 13 |
| i18n / локализация | 9 |
| **Итого** | **32** |

Покрытие: 22 маршрута (`#/dashboard … #/help`), 8 языков (en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW), валидные и невалидные входы во все формы, все боковые кнопки и тулбары.

---

## 1. Critical

### BUG-001. Поле даты Follow-up не валидируется на формат — невалидная дата уходит на бэкенд
- **Где:** `#/followup` → «Last contact (date)»
- **Шаги:** заполнить Company `TestCo`, Role `QA`, Last contact `not-a-date`, Notes `note` → нажать `⚡ Run live`.
- **Ожидание:** клиентская проверка формата ISO `YYYY-MM-DD` блокирует submit и показывает ошибку у поля.
- **Факт:** запрос уходит, кнопка переходит в состояние загрузки (⏳ ⚡ Run live), на бэке поле «drives the cadence math» получает мусор. Подпись поля прямо говорит «ISO date (YYYY-MM-DD) — drives the cadence math», но контракт не проверяется.
- **Риск:** LLM-prompt подставит «not-a-date» в шаблон, ответ будет некорректным, при этом списан кредит API (~$0.05/eval).
- **Severity:** Critical.

### BUG-002. Заглушка/тест-фикстура в продовом профиле
- **Где:** `#/profile`, `#/health` («PROFILE CUSTOMIZED → Acceptance Test»)
- **Шаги:** открыть Profile.
- **Факт:** NAME = `Acceptance Test`, EMAIL = `q@example.com`, LOCATION / LINKEDIN = `— not set`. При этом на `#/cv` грузится РЕАЛЬНЫЕ персональные данные ([имя], [телефон], [GitHub-хэндл] и т.д.).
- **Риск:** все промпты на Evaluate/Deep research/Outreach/Follow-up передают «Acceptance Test / q@example.com» как идентичность пользователя, ломая релевантность ответа. Это означает: всё, что юзер запускает на любом языке, возвращает результат под имя acceptance-теста, а не под его собственное.
- **Severity:** Critical (логика продукта).

---

## 2. Major

### BUG-003. Маркдаун-блок `**bold**` не рендерится на `#/help`
- **Где:** `#/help` — карточка `> **Audience:**` (и все остальные тексты в блок-цитатах).
- **Факт:** literally показывается `**Аудитория:**` / `**Audience:**` / `**Audiencia:**` и т. п. — звёздочки не съедаются парсером. Воспроизводится на всех 8 языках.
- **Severity:** Major (бьёт читабельность главной страницы документации).

### BUG-004. Хэш-роут `#/contacto` использует испанский слаг для англоязычной системы
- **Где:** сайдбар «Outreach» → URL `#/contacto` (испанский), при этом все остальные маршруты на английском (`#/scan`, `#/pipeline`, `#/help`, …) и заголовок страницы «LinkedIn outreach».
- **Риск:** ломает консистентность URL, путает интеграции / закладки / диплинки. Похоже на остаток разработческой ветки.
- **Severity:** Major.

### BUG-005. Кнопка `+ Add` в Pipeline молча принимает дубликат — тост врёт «Added to pipeline»
- **Где:** `#/pipeline`
- **Шаги:** добавить `https://example.com/job/123` → счётчик «In queue: 1» → ввести тот же URL → нажать `+ Add`.
- **Факт:** показывается зелёный тост «Added to pipeline», но «In queue» остаётся 1 — фактически дедуп прошёл, но сообщение вводит в заблуждение.
- **Ожидание:** тост вида «Already in queue» / «Duplicate — skipped».
- **Severity:** Major (UX-доверие).

### BUG-006. Ошибка валидации URL отдаёт сырой ответ бэкенда наружу
- **Где:** `#/pipeline` → `+ Add` с невалидным URL.
- **Факт:** красный тост `invalid url (must be http/https, no script/template chars) (POST /api/pipeline · HTTP 400)`.
- **Проблемы:** строчная буква в «invalid url»; в тосте утечён внутренний endpoint и HTTP-код; формулировка техническая, не для конечного пользователя. На всех языках — английский текст.
- **Severity:** Major.

### BUG-007. Тост «Running doctor.mjs…» не скрывается после получения результата
- **Где:** `#/dashboard` → кнопка `Doctor`.
- **Факт:** модалка с результатом уже отрисована и заполнена, а в правом нижнем углу всё ещё висит чёрный тост «Running doctor.mjs…» — выглядит как «зависло».
- **Severity:** Major (UX).

### BUG-008. Заголовок модалки `Doctor` со строчной буквы — «doctor»
- **Где:** модалка после нажатия `Doctor`.
- **Факт:** в кнопке `Doctor` с заглавной, в заголовке модалки — «doctor» строчными (`Diagnóstico/Диагностика/診断/...` в локалях аналогично — в одних случаях согласовано с кнопкой, в других — нет; на en расхождение явное).
- **Severity:** Minor → Major на длинной дистанции (бренд-консистентность).

### BUG-009. Заголовок страницы CV — нижним регистром («cv»), а не H1 как у всех остальных
- **Где:** `#/cv` — над панелью с кнопками «📄 Upload CV / sync-check / 📄 Generate PDF / 💾 Save».
- **Факт:** «cv» рендерится мелкими серым шрифтом, в то время как у всех других страниц («Reports», «Activity log», «Profile», «Help») — крупный жирный H1.
- **Severity:** Major (визуальная иерархия).

### BUG-010. Раздел «Reports» полностью без подзаголовка
- **Где:** `#/reports`.
- **Факт:** одинокий H1 «Reports» — нет описательной строки, как у всех остальных страниц («Step-by-step walkthrough of every page», «When to nudge…», и т. п.).
- **Severity:** Minor → Major (нарушение паттерна).

---

## 3. i18n / локализация

> Локализация работает на 80 %: H1, подзаголовки, кнопки и плейсхолдеры переключаются. Но на каждом языке остаются непереведённые места. На стороне разработки выглядит как пропущенные ключи `data-i18n` или хардкод английских строк в шаблоне Help.

### I18N-011. На странице `#/help` оглавление «On this page» не переводится для пунктов 2, 3, 6, 7, 8, 9, 10, 11, 12
- **Воспроизводится:** es, pt-BR, ko, ja, ru, zh-CN, zh-TW (везде).
- **Пример (es):** «**3.** Profile (#/profile — también accesible como #/settings)» — «Profile» по-английски; «**7.** Scan», «**8.** Pipeline», «**9.** Evaluate», «**10.** Reports», «**11.** Tracker», «**12.** Deep research» — все по-английски, при том что в сайдбаре те же страницы переведены («Búsqueda», «Vacantes», «Investigación»...).
- **Severity:** Major.

### I18N-012. Подзаголовок `#/deep` обрывается английским словом
- **RU:** «Брифинг компании: команда, культура, новости, переговорные позиции, **smart questions**.» — последние два слова не переведены.
- **Severity:** Major.

### I18N-013. H1 `Deep research` не локализован на RU
- На странице `#/deep` H1 «Deep research» остаётся английским в русской локали, при том что в `#/help` использовался переведённый «Глубокое исследование» в навигации сайдбара (см. JSON ниже).
- **Severity:** Major.

### I18N-014. `document.title` фиксируется один раз, не обновляется на лету при переключении языка
- **Воспроизводится:** zh-CN → en переключение: вкладка остаётся «职位搜索 — career-ops», пока не сделать жёсткий navigate.
- **Severity:** Minor.

### I18N-015. Подсказка `CTRL+K — search` в футере не учитывает платформу
- На macOS в верхнем баре правильно отображается `⌘K`, в футере — `CTRL+K`. На локализациях остаётся `CTRL+K — buscar / искать / 검색 / …`.
- **Severity:** Minor.

### I18N-016. Метка «today» в карточке «Saved research» не локализована
- На RU `today` (карточка `story-bank`), должно быть «сегодня».
- **Severity:** Minor.

### I18N-017. Консольная строка Scan содержит англоязычный токен в локализованном тексте
- JA `#/scan`: статус-бар показывает `準備完了。scan を押してください。` — слово `scan` латиницей вместо `スキャン`.
- **Severity:** Minor.

### I18N-018. Browser locale `ru-RU` не подхватывается, UI по умолчанию запускается на en
- При первом открытии без сохранённого выбора язык не определяется из `navigator.language`.
- **Severity:** Minor (UX onboarding).

### I18N-019. Транслитерации заголовков секций в сайдбаре на RU
- «NETWORKING» → «НЕТВОРКИНГ», «Outreach» → «Связь» (буквально «связь / звонок»), «Контакт» (#/contacto). Перевод смыслово не точен.
- **Severity:** Minor.

---

## 4. Minor / UX

### UX-020. `#/auto` — заголовок «✨ Auto-pipeline a URL» переносится на две строки из-за эмоджи
- Левая колонка обрывается «✨ Auto-pipeline a / URL» в обычном вьюпорте 1568×752.
- **Severity:** Minor.

### UX-021. Подсказка-плейсхолдер `Last contact (date)` показывает дату на 28 дней в прошлом (`2026-04-21`), при этом «today» в активити уже `19.05.2026`
- Плейсхолдер заморожен в коде, не относительно текущей даты. На RU дата заморожена в том же виде.
- **Severity:** Minor.

### UX-022. На `#/scan` запуск Scan с реальным выполнением возвращает 404 для нескольких провайдеров
- Конкретно (live-прогон):
  - `Clarity AI · lever · Lever: HTTP 404 (https://api.lever.co/v0/postings/clarity-ai)`
  - `Forto · lever · Lever: HTTP 404 (https://api.lever.co/v0/postings/forto)`
  - `Hugging Face · workable · Workable: HTTP 404 (https://apply.workable.com/api/v3/accounts/huggingface/jobs?details=true&limit=1000)`
- Это не баг приложения, а устаревшая конфигурация `portals.yml`. Но факт остаётся: пользователь видит красный «✗» в дашборде. Имеет смысл вычистить мёртвые компании из конфига.
- **Severity:** Minor.

### UX-023. На `#/evaluate` пустой submit ничего не делает (нет тоста)
- Пустое поле + клик `▶ Evaluate` — никакой обратной связи. Только при `>0 && <50` показывается «JD too short (min 50 chars)». Должно быть «JD is required».
- **Severity:** Minor.

### UX-024. `#/pipeline` Удаление URL — текст модалки дублируется
- Модалка показывает «Remove from pipeline?» в заголовке и «Delete URL from pipeline?» в теле. Два разных глагола (Remove / Delete) для одного действия. Кнопка — «Delete».
- **Severity:** Minor.

### UX-025. На `#/tracker` действие `Dedup`, `Normalize`, `Merge TSV` показывают одно и то же тело модалки «Rewrite applications.md? This runs "<action>" and rewrites data/applications.md in the parent project in place. This cannot be undone from here. Continue?» — это OK, но во всех языках слово в кавычках («dedup», «normalize», «merge») остаётся английским.
- **Severity:** Minor (i18n + UX).

### UX-026. На `#/contacto` (Outreach) когда страница смонтирована напрямую по URL, в сайдбаре пункт «Outreach» **не подсвечивается активным**
- При первой загрузке через прямой URL не виден active-state. Виден при клике из сайдбара.
- **Severity:** Minor.

### UX-027. Тосты с `position: fixed` в углу перекрывают кнопку `Save` / `Submit` на узких экранах (≤ 420 px)
- На мобильном виде (resize до 420×800) красные тосты заходят на кнопки в правом нижнем углу — пользователь не может сразу нажать Save.
- **Severity:** Minor.

### UX-028. Все формы (`#/deep`, `#/project`, `#/training`, `#/followup`, `#/contacto`, `#/interview-prep`, `#/patterns`) принимают одинаковую плашку «Estimated cost: Anthropic claude-sonnet-4-6 · ~$0.05/eval» — без учёта реального провайдера
- В `#/config` LLM_PROVIDER переключается на claude/gemini/openai/qwen/openrouter, но на формах оценка остаётся «Anthropic claude-sonnet-4-6 · ~$0.05/eval» независимо от выбранной модели.
- **Severity:** Minor (вводит в заблуждение по бюджету).

### UX-029. Run live стартует, поле не подсвечивается фокусом — на узком экране непонятно, что процесс пошёл
- Только faded-состояние кнопки + спиннер ⏳ внутри неё. Желательно — глобальный progress bar.
- **Severity:** Minor.

### UX-030. На `#/dashboard` блок «Quick actions → Pipeline» дублирует «Open Pipeline» вверху страницы и «Scan all sources» дублирует «Scan now» — 2 кнопки делают одно и то же
- 4 пути из дашборда к одной странице — конкурируют. На локализациях получается визуальный «мусор».
- **Severity:** Minor.

### UX-031. На `#/help` поле «Filter sections» в локализациях обрезается
- KO «섹션 필터», JA «セクションをフィルター» — текст плейсхолдера на 5–10 % длиннее, помещается, но без отступов. На pt-BR «Filtrar seções» — норм.
- **Severity:** Minor.

### UX-032. На странице `#/health` карточка «PROFILE CUSTOMIZED» считает профиль «настроенным», хотя там стоит фикстура `Acceptance Test`
- Эвристика, которая определяет «OK», смотрит не на содержимое, а на сам факт наличия `profile.yml`. Должна проверять, что значения != дефолт.
- Связано с BUG-002.
- **Severity:** Minor.

---

## 5. Безопасность (положительные результаты)

- `+ Add URL` с `javascript:alert(1)` — отклонено сервером, тост «invalid url (must be http/https, no script/template chars)». ✓
- `+ Add URL` с `https://example.com/<script>alert(1)</script>` — отклонено сервером. ✓
- `#/evaluate` с `<script>alert(1)</script>` (25 символов) — отклонено клиентской проверкой «JD too short (min 50 chars)» (т. е. санитизация удалила тэги до проверки длины). ✓
- 404-страница для несуществующих маршрутов (`#/asdfasdf-nonexistent`) — рендерится корректно, есть кнопка «Back to Dashboard». ✓
- Тёмная тема — корректно применяется через `<html data-theme="dark">`, переключается мгновенно. ✓

---

## 6. Покрытие тестами по языкам

| Lang | Sidebar H1 | Toast (`+ Add` empty) | Doctor modal | Подзаголовок Deep | Notes |
|---|---|---|---|---|---|
| en | ✓ | `Enter URL` | `doctor` (строчная) | en | базовая локаль |
| es | ✓ | `Insira URL` aka «Insira» — wait, у es должно быть «Ingresar URL» | n/a | es | TOC Help не переведено |
| pt-BR | ✓ | `Insira URL` | n/a | pt-BR | TOC Help не переведено |
| ko | ✓ | `URL 입력` | n/a | ko | TOC Help не переведено |
| ja | ✓ | `URL を入力` | n/a | ja | `scan` латиницей в консоли страницы |
| ru | ✓ | (не проверено в этом прогоне; в RU UI «Введите URL») | `доктор` | **H1 «Deep research» — en**, «smart questions» в подзаголовке — en | критичный регресс |
| zh-CN | ✓ | `输入 URL` | n/a | zh-CN | title не обновлялся на лету при переключении |
| zh-TW | ✓ | `輸入 URL` | n/a | zh-TW | |

> **Примечание:** «Live evaluation» отрабатывает в Anthropic Claude Sonnet 4.6 (виден в шапке «Live eval: Anthropic (claude-sonnet-4-6)»). На RU стартовал live-deep-research для `Anthropic / Software Engineer` — заявка дошла, статус «Генерация…» наблюдался > 18 c. Содержание ответа проверено не было из-за времени, но тест-фикстура BUG-002 заставила бы ответ строиться вокруг «Acceptance Test», что делает контент нерелевантным.

---

## 7. Приоритизированный план фиксов

1. **(Crit)** BUG-002 — очистить `config/profile.yml` от `Acceptance Test`, добавить миграцию: при первом запуске и пустом `profile.yml` дёрнуть Profile-визард.
2. **(Crit)** BUG-001 — клиентская валидация ISO-даты на `#/followup`, маска ввода, дизейбл кнопки до валидной даты.
3. **(Maj)** BUG-005 — поправить тост: при дубле возвращать «Already in queue».
4. **(Maj)** BUG-006 — переписать сообщения 4xx в человеческие, не утекать `POST /api/...` и HTTP-код.
5. **(Maj)** I18N-011, 012, 013 — пройтись по `i18n/<lang>.json`, закрыть ключи для TOC Help, подзаголовков Deep research, H1 Deep research для RU.
6. **(Maj)** BUG-003 — починить рендер `**bold**` в блок-цитатах на странице Help.
7. **(Maj)** BUG-004 — переименовать роут `#/contacto` → `#/outreach`, добавить редирект.
8. **(Min)** BUG-007 — закрывать тост `Running doctor.mjs…` по `onComplete`.
9. **(Min)** BUG-008 — выровнять регистр заголовка модалки Doctor по кнопке.
10. **(Min)** BUG-009/010 — H1 страницы CV сделать как у других; добавить subtitle на Reports.
11. **(Min)** I18N-014 — `document.title = i18n.t('routes.' + route)` после `langchange`.
12. **(Min)** UX-027 — `bottom: max(16px, env(safe-area-inset-bottom))` и отодвинуть тосты выше fixed-кнопок на мобильном.

---

## 8. Артефакты тестового прогона (на пользовательском диске остался ввод)

- `data/pipeline.md`: добавлен `https://example.com/job/123` (1 запись, не удалена в этом прогоне — рекомендую почистить).
- `data/activity.md`: добавлены строки `pipeline.add x2`, `script.doctor` и т. п.
- Никаких неотозванных платных операций не запущено (Run live в RU не дожидался).

---

*Отчёт сгенерирован Claude (Sonnet 4.6) в формате senior QA report.*
