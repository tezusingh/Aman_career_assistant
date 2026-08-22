# Промпт для Claude Cowork — браузерное E2E тестирование career-ops-ui v1.24.0

> Версия живёт вместе с релизами. На 2026-05-14 последний релиз — **v1.24.0** (help-bundle content-depth refresh из 5 канонических career-ops.org/docs URLs × 8 локалей + live execution QA scenario 31 6/6 PASS + RU CHANGELOG end-to-end 1542 строки). История релизов после v1.21.0: v1.22.0 (M/L/N backlog clearout + docs alignment), v1.23.0 (i18n split + CI hot-fix + переводы тел CHANGELOG в 7 локалях), v1.24.0 (help-bundle refresh + scenario 31 live). Сценарии 0–19 покрывают всё что было до v1.11.x, сценарии 20–23 — функционал v1.12.0–v1.14.0, сценарии 24–27 — релизы v1.15.0–v1.20.0, сценарии 28–30 — функционал v1.21.0, сценарий 31 — docs alignment audit (v1.22.0+, статус verified 6/6 в v1.24.0).
>
> ⚠️ **Перед запуском:** Claude Cowork работает с публичными URL — а у вас приложение крутится на `127.0.0.1:4317`. Самый быстрый способ открыть его наружу — запустить `ngrok http 4317` (или `cloudflared tunnel --url http://127.0.0.1:4317`) и подставить полученный HTTPS-URL в `BASE_URL` ниже. Без этого облачный браузер до приложения не достучится.

---

## Сценарий 0 — Bootstrap из одной команды (проверяется отдельно)

Это **первый и обязательный** сценарий: всё приложение должно подниматься единственной командой. Если Claude Cowork умеет выполнять shell на стенде — пусть выполнит её сам и продолжит остальные сценарии против поднятого инстанса. Если умеет только браузер — этот сценарий запускает оператор вручную, и тогда облачный агент ждёт сообщения о готовности.

**Команда для развёртывания на чистой машине:**

```bash
curl -fsSL https://raw.githubusercontent.com/Fighter90/career-ops-ui/main/bin/setup.sh | bash
```

Что должно произойти за один прогон (без интерактивных запросов):

1. Клонируется `santifer/career-ops` и `Fighter90/career-ops-ui` в `./career-ops/` и `./career-ops/web-ui/` соответственно
2. В `career-ops/.gitignore` добавляется строка `/web-ui/` — родитель не должен трекать вложенный репо
3. `npm install` в `web-ui/` (только две зависимости — `express` + `js-yaml`)
4. Скаффолятся стартовые файлы если их нет: `cv.md` (демо-CV «Alex Doe»), `config/profile.yml` (плейсхолдеры), `portals.yml` (минимум: GitLab + Vercel + Linear), `data/applications.md`, `data/pipeline.md`
5. Запускается сервер на `http://127.0.0.1:4317` — отдаёт SPA сразу

**Проверки этого сценария:**

- Команда отработала с exit code 0 (нет красных ошибок)
- В stdout есть строки `✓ git, node`, `✓ added /web-ui/`, `✓ scaffolded …`, `Setup complete.`, `Launching at http://127.0.0.1:4317/`
- `curl -sf http://127.0.0.1:4317/api/health` возвращает JSON с `"ok":true` (или зелёный с warnings — допустимо)
- `curl -sf http://127.0.0.1:4317/` возвращает HTML с `<title>career-ops-ui</title>` и подключёнными `/css/app.css`, `/js/app.js`
- Файл `./career-ops/cv.md` существует, начинается с `# Alex Doe`
- Файл `./career-ops/config/profile.yml` существует
- Файл `./career-ops/portals.yml` существует и парсится как YAML (`yq . portals.yml` или `node -e "console.log(require('js-yaml').load(require('fs').readFileSync('career-ops/portals.yml','utf8')).tracked_companies.length)"`)

**Идемпотентность:** запусти команду ВТОРОЙ раз в той же папке. Должно отработать без ошибок и без повторных скаффолдингов (увидишь сообщения вида `✓ already cloned — fetching updates`, `✓ /web-ui/ already in .gitignore`, `✓ npm deps already installed`). Сервер при втором запуске поднимется поверх уже живого процесса (порт 4317 будет занят) — это ожидаемо: `ngrok` тогда продолжит работать с первым.

**После успеха** — `BASE_URL` для остальных сценариев берётся из туннеля поверх того же `127.0.0.1:4317`.

**PASS** = одна команда подняла рабочий инстанс + повторный запуск идемпотентен + Health отвечает зелёным.

**BLOCKER** если: команда упала, сервер не запустился, скаффолд-файлы не создались, или `/api/health` возвращает 500.

---

## Контекст

Я тестирую **career-ops-ui** v1.24.0 — это веб-интерфейс на Express + vanilla JS поверх AI-пайплайна для поиска работы. Хеш-роутер, **17 страниц** (Dashboard / Scan / Pipeline / Evaluate / Reports / Tracker / Activity / CV / Profile / App settings / Health / Help + Batch + Deep / Apply / Modes), 8 локалей, режим работы single-tenant на loopback. Тема **dark / light** переключается через `🌓` в sidebar.

**Что нового в v1.11.x–v1.14.0** (важно для тестировщика):

- **v1.11.x** — career-ops.org/docs интегрирован в help bundles + READMEs во всех 8 локалях; score-thresholds card на `#/reports`; Active Companies card на `#/scan`; Playwright setup link на `#/apply`.
- **v1.12.0** — `🌓` theme toggle (dark/light), brand strip в footer.
- **v1.13.0** — `#/batch` SPA (batch evaluate offers); CV multer multipart upload (curl `-F file=@...` теперь работает напрямую); locale-aware mode-template scaffolding × 8 локалей; dark-theme table hover fix.
- **v1.14.0** — 3 новых ATS adapter'а: **Workable / SmartRecruiters / Workday-beta** (поверх v1.13.0 registry; теперь 6 ATSes). 42 docs-фразы обновлены с "3 ATSes" на "6 ATSes" в READMEs / help-бандлах / PROJECT.md.

**Что нового в v1.15.0–v1.20.0** (новые сценарии 24–27):

- **v1.15.0** — `/api/stream/scan` consolidated (один endpoint вместо `scan-en` + `scan-ru`); SSE auto-pipeline ground work; sidebar route renames (data-route attributes стабильные).
- **v1.16.0** — **server-side auto-pipeline orchestrator** через SSE: один `POST /api/auto-pipeline` запускает validate → fetch JD → evaluate → save report → tracker за один проход. Покрывается сценарием 24.
- **v1.17.0** — polish + a11y + CI fix (9 follow-ups); legacy `/#/batch-prompt` удалён (был в sunset с v1.15.0); 3 v1.17 subagents (`web-ui-route-reviewer`, `spa-view-reviewer`, `test-isolation-reviewer`).
- **v1.18.0** — `/api/stream/scan-{en,ru}` legacy aliases retired (404 now); **WCAG 2.2 AA**: Skip link (2.4.1), Focus Visible (2.4.7), Target Size (`.btn` 44px / `.btn-sm` 32px), Language of Page (`<html lang>`), Info & Relationships (`#content tabindex`). Покрывается сценарием 25.
- **v1.19.0** — **WCAG 1.4.3 contrast pass** (badges + score pills через `*-text` варианты, AA на light + dark); scan unification finished в доке; **HH_USER_AGENT удалён из UI** (но parent `.env` всё ещё читает его). Покрывается сценарием 26.
- **v1.20.0** — per-component a11y polish: **WCAG 2.5.5 / 2.5.8 touch-target audit** (`.chip` 28px + 8px gap, `.nav-item` / `.tab-btn` 44px); **WCAG 1.3.1 / 3.3.2 aria-describedby** на form hints (config / pipeline / evaluate / batch / mode-page); non-EN README parity (7 локалей × ~580 строк); `/api/scan-ru/config` legacy alias retired (404 now). Покрывается сценарием 27.

**Что нового в v1.21.0** (новые сценарии 28–30):

- **B-1 (Security):** новый `server/lib/safe-fetch.mjs` закрывает DNS-rebind TOCTOU в `/api/pipeline/preview` и `/api/auto-pipeline`. Один DNS lookup, pinned TCP connection через `node:http(s)`. Покрывается сценарием 28.
- **H-4 (Security):** `sanitizePathName` поднят в `security.mjs`; 10 broken regex копий удалены. `..pdf`, `....md`, leading-dot names теперь → 400. Покрывается сценарием 29.
- **H-5 (Security):** новый `llmRateLimit` middleware. No-op на loopback; 10 req/min/IP на `HOST=0.0.0.0`. Покрывается сценарием 30.
- **H-6 (Concurrency):** новый `server/lib/file-lock.mjs::withFileLock(path, fn)` сериализует read-modify-write на applications.md / pipeline.md. Конкурентные POSTы tracker не теряют строки.
- **H-3 (i18n):** 19 keys × 8 locales добавлено в DICT. Russian/Japanese/Chinese screen-reader users больше не слышат English `aria-label`s.
- **H-1 / H-2 (a11y):** `id="batch-tsv-hint"` на hint paragraph + `htmlFor` на двух labels. WCAG 1.3.1 / 3.3.2 wires валидны.

**Что нового в v1.22.0–v1.24.0** (расширяет сценарий 31 + dev tooling):

- **v1.22.0** — закрыт весь M-tier + L-tier + nit-tier (9 M + 5 L + 2 nits) v1.20.1 backlog'а: entity-aware `stripDangerousMarkdown`, exponential backoff на health-ping, Safari `localStorage` guard, WCAG 1.4.1 cues на score pills + connection-banner (✓ / ◐ / ○ glyphs), inline hints на mode-page (152 i18n keys × 19 fields), `bash --noprofile --norc` на batch runner, `parseInt` radix, Windows-safe entrypoint, drop `Element.prototype.also`, 404-canary для retired `/api/scan-ru/config`. Plus 7 не-EN READMEs quality refresh + сценарий 31 (docs alignment audit).
- **v1.23.0** — `i18n.js` split (639 LOC → 86 logic + 578 data fixture `i18n-dict.js`) + CI hot-fix для connection-banner recovery (cap 60s→15s, eager `visibilitychange` re-check, reschedule on state-flip) + переводы тел CHANGELOG в 6/7 локалях через параллельные translation agents + 8 README + DO-NOT-REVERT markers на per-locale dashboard screenshots.
- **v1.24.0** — help-bundle content-depth refresh: `docs/help/en.md` 1113 → 1269 строк с глубокой интеграцией 5 канонических career-ops.org/docs URLs (× 3-5 mentions каждый) + 7 параллельных translation agents для не-EN bundles (1184-1344 строк каждый) + **live execution QA scenario 31 — 6/6 PASS** + RU CHANGELOG retry agent landed (1542 строки end-to-end).

**Baseline счётчики на v1.24.0:** 474/474 unit (+34 от v1.20.0) + 20/20 smoke E2E + 23/23 comprehensive E2E + 32/32 Playwright = 549 тестов, 0 фейлов. v1.20.1 backlog полностью закрыт (23 finding'а shipped).

```
BASE_URL = <вставь сюда https://...ngrok-free.app>
LOCALE   = ru   (можно en, es, pt-BR, ko-KR, ja, zh-CN, zh-TW)
```

На стенде уже:

- ANTHROPIC_API_KEY и/или GEMINI_API_KEY заданы в `.env` (если нет — manual-fallback всё равно работает, см. сценарий 7)
- Демо-CV «Alex Doe» (8 лет PHP+Go) и стартовый `portals.yml` с минимум 1 company per ATS (Greenhouse + Ashby + Lever — для сценария 19 желательно и Workable / SmartRecruiters / Workday, см. `docs/portals-examples.md`)

Открой `BASE_URL` в браузере — должна загрузиться страница `/#/dashboard`. Если нет — упади с понятным error-репортом и не продолжай дальнейшие сценарии.

---

## Глобальные правила тестирования

1. **Каждый сценарий = независимый блок.** Если падает шаг 3 — продолжай с шага 4, а не выходи. В отчёте отметь PASS/FAIL/SKIP по каждому подшагу.
2. **Селекторы — по тексту и `data-route`**, не по случайным классам. Sidebar-ссылки имеют атрибут `data-route="<имя>"`. Кнопки имеют видимый текст («💾 Save», «📁 Upload CV», «📄 Generate PDF», «🌐 Scan now», «▶ Evaluate», «▶ Test Anthropic», «▶ Test Gemini»).
3. **Скриншоты на каждом шаге** — название по шаблону `<NN>-<scenario>-<step>.png`.
4. **Между сетевыми действиями** жди исчезновения `.loading` спиннера или появления toast-сообщения. Не используй фиксированные `sleep` — жди по селектору.
5. **Локализуй проверки** — переключи язык в правом нижнем углу sidebar (`.lang-btn[data-lang-btn="ru"]`) перед стартом, и далее проверяй заголовки кнопок на выбранном языке.
6. **Никогда не отправляй реальные отклики**. Все формы apply-checklist / outreach генерируют ТЕКСТ, ничего не сабмитят на внешние сайты. Если кнопка ведёт на `https://job-boards.greenhouse.io` или подобное — ОТКРОЙ во вкладке для проверки, но НИКАКИХ сабмитов.

---

## Сценарий 1 — Дым-тест навигации (60 секунд)

Зайди на `BASE_URL` и пройди по каждому пункту sidebar. Кликни по очереди:
**Dashboard → Scan → Pipeline → Evaluate → Batch → Reports → Tracker → Activity → CV → Profile → App settings → Health → Help**.

Для каждого:

- Проверь, что URL содержит ожидаемый хеш (`#/scan`, `#/pipeline`, `#/batch`, ...)
- Проверь, что отрисовался `<h1.page-title>` (заголовок страницы)
- Проверь, что в консоли браузера НЕТ красных ошибок (только warnings допустимы)
- Сделай скриншот

Дополнительно проверь mode-страницы (открываются прямой ссылкой, не из sidebar):
`#/deep`, `#/apply`, `#/project`, `#/training`, `#/followup`, `#/contacto`, `#/interview-prep`, `#/patterns` — каждая должна рендерить форму без console errors.

Отдельно проверь back-compat: открой `BASE_URL/#/settings` — должен резолвиться в Profile-вью, в sidebar должен подсвечиваться пункт Profile (старая ссылка не должна 404-иться).

**PASS = 13 sidebar-страниц + 8 mode-страниц + 1 алиас (`#/settings`→Profile), 0 console errors.**

---

## Сценарий 2 — Health (зелёная основа)

1. Открой `#/health`
2. Дождись таблицы с чек-листом (`.card` блоки с зелёными/красными бейджами)
3. Все required-чеки должны быть зелёными:
   - `cv.md exists`
   - `config/profile.yml exists`
   - `portals.yml exists`
   - `Profile customized` (true когда full_name ≠ placeholder)
   - `API key set` (хотя бы один)
4. Если что-то красное — сделай скриншот и продолжай дальше; в финальном отчёте отметь как «known prerequisite missing».

**PASS = required-чеки зелёные ИЛИ корректный hint-текст для каждого красного.**

---

## Сценарий 3 — Profile editor (v1.10.0+)

1. `#/config` → клик по табу **«Profile»** (вторая вкладка)
2. Должен появиться textarea с YAML, начинающимся с `# Career-Ops Profile Configuration`
3. Замени значение `candidate.full_name:` на `"Cloud Tester"` (через `.fill()` после `.click()`)
4. Клик **💾 Save**
5. Жди toast `Profile saved · Cloud Tester` (или локализованный аналог)
6. Перейди на `#/profile` — в карточке `Name` должно быть `Cloud Tester`
7. Перезагрузи страницу — значение должно сохраниться

**Негативные кейсы (тесты валидации):**

8. Вернись в `#/config → Profile`. Очисти textarea и нажми Save → ожидаемый toast «empty» или эквивалент, статус остался прежним
9. Заменить весь YAML на `- not\n- a\n- mapping` → Save → toast с ошибкой `mapping`/`maps`
10. Удалить ключ `candidate:` целиком → Save → toast с ошибкой `candidate`

**PASS = 7 happy-path шагов + 3 negative-кейса с правильными ошибками.**

---

## Сценарий 4 — CV import (v1.10.0; v1.13.0 multer-multipart)

Тестируем все форматы загрузки. Перед каждой загрузкой `#/cv` должна быть открыта; после успешной загрузки textarea заполняется конвертированным markdown.

**v1.13.0 контракт:** `/api/cv/import` принимает И `Content-Type: application/octet-stream` + `X-Filename` (UI-путь), И `multipart/form-data` через multer (curl `-F`, Postman default). v1.10.2 415-reject для multipart был заглушкой; v1.13.0 принимает оба.

### 4a. .md (passthrough)

1. Создай файл во временной папке cloud-агента: `test.md` с содержимым `# Hello from cloud\n\nMD passthrough test.`
2. `#/cv` → клик **📁 Upload CV** → выбери `test.md`
3. Toast `Loaded test.md (passthrough) — review, then Save`
4. В textarea видно `# Hello from cloud`

### 4b. .txt (passthrough)

То же что 4a, но `test.txt` с любым текстом.

### 4c. .html (pandoc)

1. `test.html` с содержимым:

   ```html
   <h1>HTML CV</h1>
   <script>window.__pwn=1</script>
   <p>Body text.</p>
   ```

2. Загрузи через **📁 Upload CV**
3. Toast `Loaded test.html (pandoc) ...`
4. В textarea видно `# HTML CV` И НЕ ВИДНО ни `<script>`, ни `__pwn` (XSS-санитизация работает)

### 4d. .pdf (pdftotext)

1. Если у cloud-агента есть готовый PDF — загрузи. Иначе сгенерируй mini-PDF любым способом (например запросив у бекенда `📄 Generate PDF` сначала, потом скачай результат и загрузи как input).
2. Toast `Loaded ... (pdftotext)`
3. В textarea — извлечённый текст из PDF

### 4e. .docx (pandoc)

Если есть тестовый .docx — загрузи. Иначе SKIP с пометкой.

### 4f. Negative — неподдерживаемый формат

1. `test.exe` (любой бинарь, ≥1 KB)
2. Загрузи → ожидается toast с ошибкой `unsupported format ".exe"`
3. textarea **не должна** измениться

### 4g. Negative — слишком большой файл

1. Сгенерируй файл `huge.txt` размером ровно 11 MB (`dd if=/dev/zero of=huge.txt bs=1M count=11`)
2. Загрузи → ожидается ошибка `413` или сообщение `too large`

### 4h. v1.13.0 multer-multipart contract (curl -F path)

Через cloud-shell (если есть shell-доступ):

```bash
echo "# Multipart test\nBody." > /tmp/v13-cv.md
curl -s -o /dev/null -w "%{http_code}" -X POST -F "file=@/tmp/v13-cv.md" http://127.0.0.1:4317/api/cv/import
```

**Assertion:** код **200** (не 415, как было в v1.10.2). Если 415 — это v1.13.0 регрессия и blocker.

**PASS = 4a, 4b, 4c, 4d, 4f, 4g, 4h обязательные; 4e желательный.**

---

## Сценарий 5 — CV save round-trip + XSS strip

1. `#/cv` → в textarea вставь:

   ```markdown
   # Cloud Tester CV

   <script>window.__cloud_pwn=1</script>
   [malicious](javascript:alert(1))

   ## Summary
   Senior backend engineer.
   ```

2. Клик **💾 Save**
3. Toast `Saved`
4. **Перезагрузи** страницу `#/cv`
5. Проверь что в textarea:
   - есть `# Cloud Tester CV`
   - есть `Senior backend engineer`
   - НЕТ `<script>`, `__cloud_pwn`, `javascript:`

**PASS = 5 проверок выполнены.**

---

## Сценарий 6 — Generate PDF + auto-download

⚠️ Этот тест требует Playwright в parent-проекте. Если на стенде его нет, шаг будет падать с подсказкой «Playwright is missing» — это **ожидаемое** SKIP-поведение, отметь и иди дальше.

1. `#/cv` → клик **📄 Generate PDF**
2. Должно открыться модальное окно с SSE-логом
3. Жди до строки `✓ done (exit 0)` или ошибки
4. Если успех:
   - PDF должен **автоматически скачаться** в загрузки cloud-агента
   - Внизу страницы (`#/cv`) появилась карточка с именем PDF и кнопками **↗ Open / ⬇ Download**
   - Имя файла соответствует только что сгенерированному
5. Если ошибка с `Playwright` — отметь SKIP, продолжай.

**PASS = либо PDF скачался + список обновился, либо чёткое сообщение о Playwright-зависимости.**

---

## Сценарий 7 — Evaluate (с ключом и без)

### 7a. Manual fallback (если ключи НЕ заданы)

1. `#/evaluate`
2. В textarea вставь:

   ```
   Senior Backend Engineer at TestCo. Lead a small team building distributed systems with PHP, Go, and Postgres. 10+ years XP, on-call rotation, code review responsibilities, mentoring mid-level engineers. Remote EU.
   ```

3. Клик **▶ Evaluate**
4. Должна появиться карточка с бейджем `Manual mode (no GEMINI_API_KEY)` (или эквивалент) и блоком `<pre>` с готовым промптом для копирования
5. Клик **⧉ Copy prompt** → toast `Prompt copied` (clipboard может быть недоступен в cloud-окружении — тогда просто проверь что кнопка не падает)

### 7b. Live mode (если ключ задан)

1. То же что 7a, но без ключа в `.env` это даст manual; с ключом — структурный отчёт.
2. Жди до 60 секунд (live-вызов LLM может тормозить)
3. Должна появиться карточка с бейджем `Anthropic · exit 0` (или `Gemini · exit 0`) И тело Markdown-отчёта с секциями A–G
4. Если поставлен чекбокс «Save JD» (`#save-jd`), бейдж `Saved: jd-...md` тоже должен быть

**PASS = 7a выполнен. 7b желательно, SKIP если ключи отсутствуют.**

---

## Сценарий 8 — Pipeline + dedup + invalid-URL reject

1. `#/pipeline`
2. В поле URL вставь `https://job-boards.greenhouse.io/anthropic/jobs/test-cycle-cloud-1`
3. Клик кнопки добавления (надпись локализована — ищи по `<button>` ниже поля)
4. Запись должна появиться в списке
5. Повтори вставку того же URL → toast `deduped` или счётчик «1 дубль»
6. Вставь `javascript:alert(1)` → должна быть ошибка валидации, ничего в список не добавляется
7. Вставь `http://127.0.0.1/x` → ошибка (loopback запрещён SSRF-гардом)
8. Вставь `not-a-url` → ошибка

**PASS = 1 успешный add + 1 dedup + 3 reject-кейса.**

---

## Сценарий 9 — Tracker (BF-1 pipe round-trip)

Ключевой regression-тест: компании с `|` в названии раньше ломали markdown-таблицу.

1. `#/tracker` → клик «Add» (или эквивалент локализованный)
2. Заполни поля:
   - Company: `Acme | Co`
   - Role: `Senior Backend\nEngineer` (с переносом строки)
   - Score: `4.2`
   - Status: `Evaluated`
   - Notes: `Cloud regression test`
3. Сохрани
4. **Перезагрузи** страницу
5. Найди строку с компанией `Acme | Co` (именно с пайпом!) — она должна остаться целой, не разбившейся на две колонки
6. Проверь что Role содержит и `Senior Backend`, и `Engineer`

**PASS = строка сохранилась, pipe и newline не сломали layout.**

---

## Сценарий 10 — Reports + пагинация

1. `#/reports` → должны отображаться карточки сгенерированных отчётов
2. Если их > 12 — должен быть пагинатор внизу. Кликни «Next» / `→` — список меняется
3. Кликни на любую карточку → загружается полный markdown отчёта в новом view

**PASS = пагинатор работает (или их < 12 → просто список без пагинатора), детальный отчёт открывается.**

---

## Сценарий 11 — Deep research (manual fallback)

1. `#/deep`
2. Заполни Company = `Anthropic`, Role = `Senior Backend Engineer`
3. Клик соответствующей кнопки запуска
4. Без ключа: получи manual prompt, проверь что в нём есть `Anthropic`, `Senior Backend Engineer`, `interview-prep` (это путь сохранения)
5. С ключом: получишь полный 7-секционный бриф (живой LLM, до 60 секунд)

**PASS = manual prompt построен корректно, либо live-результат сохранился в `interview-prep/`.**

---

## Сценарий 12 — Mode prompts (7 режимов)

Пройди по `#/project`, `#/training`, `#/followup`, `#/batch`, `#/contacto`, `#/interview-prep`, `#/patterns`. Для каждого:

1. Открой страницу
2. Заполни обязательные поля (минимум — что просит форма)
3. Клик кнопки построения промпта
4. Проверь что результат содержит:
   - правильный slug (`r.slug` равен имени маршрута)
   - текст с упоминанием режима (например для `interview-prep` — слово `interview-prep` в промпте)

**PASS = 7 режимов выдают непустой prompt без console errors.**

---

## Сценарий 13 — Apply checklist

1. `#/apply`
2. URL = `https://job-boards.greenhouse.io/anthropic/jobs/test`
3. JD = `Senior Backend Engineer`
4. Запусти билдер чек-листа
5. Результат должен содержать:
   - текст `career-ops apply` (упоминание парент-команды)
   - предупреждение `NEVER auto-submit` (или локализованный вариант)
   - длина > 200 символов

**PASS = чек-лист сгенерирован с обоими маркерами.**

---

## Сценарий 14 — Activity log (audit trail)

1. `#/activity`
2. После всех предыдущих сценариев в логе должны быть записи:
   - `cv.save` (после сценария 5)
   - `pipeline.add` (после сценария 8)
   - `tracker.add` (после сценария 9)
   - `evaluate` (после сценария 7)
3. Каждая запись имеет timestamp в ISO формате

**PASS = минимум 4 ожидаемых action'а в логе.**

---

## Сценарий 15 — Help (8 локалей)

1. `#/help` на текущей локали (LOCALE из конфига)
2. Должно загрузиться 16 секций (`<h2>` в правой колонке + TOC слева)
3. Секция 1 должна содержать слова с маркерами `Шаг 1`, `Шаг 21` (для RU) или `Step 1`/`Step 21` (для EN), и упоминание `📁 Upload CV`, `🌐 Scan now`, `▶ Evaluate`, `📄 Generate PDF`
4. Переключи язык на en → перезагрузи help → проверь что контент тоже 16 секций и тоже содержит 21-шаговый walkthrough
5. Скриншот для каждой локали

**PASS = в обеих проверенных локалях help грузится, 16 секций, 21 шаг.**

---

## Сценарий 16 — Полный E2E flow (главная цель)

Это сценарий-капитан: пройди весь жизненный цикл за один проход, имитируя поведение реального пользователя.

1. **Setup**: Сценарий 2 (Health зелёный) → Сценарий 3 (Profile editor — поставь имя `E2E Cloud Tester`)
2. **CV**: Сценарий 4a (`.md` upload) → Сценарий 5 (Save с XSS-стрипом)
3. **Find**: Сценарий 8 (Pipeline add)
4. **Score**: Сценарий 7a (Evaluate с manual prompt)
5. **Track**: Сценарий 9 (Tracker add)
6. **Verify**: Сценарий 14 (Activity log содержит все action'ы из шагов выше)

**PASS = все 6 фаз отработали без падения. Это imitation полного «from CV to applied» flow, как описано в Help.**

---

## Финальный отчёт

После всех **31 сценариев** (0–16 базовые + 17–19 v1.11.x/v1.14.0 + 20–23 v1.12.0/v1.13.0/v1.14.0 + 24–27 v1.15.0–v1.20.0 + 28–30 v1.21.0 + 31 v1.22.0 docs alignment) выдай таблицу:

| Сценарий | Шаги | PASS | FAIL | SKIP | Заметки |
|---|---|---|---|---|---|
| 0. Bootstrap | 6 | ... | ... | ... | ... |
| 1. Smoke nav | 14 sidebar + 8 modes + 1 alias | ... | ... | ... | ... |
| 2. Health | 5 | ... | ... | ... | ... |
| 3. Profile editor | 10 | ... | ... | ... | ... |
| 4. CV import | 8 (4a-4h) | ... | ... | ... | ... |
| 5. CV save XSS | 5 | ... | ... | ... | ... |
| 6. Generate PDF | 5 | ... | ... | ... | ... |
| 7. Evaluate | 5 (7a+7b) | ... | ... | ... | ... |
| 8. Pipeline + SSRF | 8 | ... | ... | ... | ... |
| 9. Tracker pipe | 6 | ... | ... | ... | ... |
| 10. Reports | 3 | ... | ... | ... | ... |
| 11. Deep research | 5 | ... | ... | ... | ... |
| 12. Mode prompts | 7 модов × 4 | ... | ... | ... | ... |
| 13. Apply checklist | 5 | ... | ... | ... | ... |
| 14. Activity log | 4 | ... | ... | ... | ... |
| 15. Help bundles | 5 | ... | ... | ... | ... |
| 16. Full E2E | 6 фаз | ... | ... | ... | ... |
| 17. career-ops docs coverage | 5 (17.1-17.5) | ... | ... | ... | ... |
| 18. Help parity | 1 | ... | ... | ... | ... |
| 19. 6 ATS registry | 4 (19.1-19.4) | ... | ... | ... | ... |
| 20. Theme toggle | 3 | ... | ... | ... | ... |
| 21. Batch SPA | 4 | ... | ... | ... | ... |
| 22. Locale scaffold | 2 | ... | ... | ... | ... |
| 23. Doc parity finale | 4 | ... | ... | ... | ... |
| 24. Auto-pipeline SSE (v1.16.0) | 4 (24.1-24.4) | ... | ... | ... | ... |
| 25. WCAG 2.2 AA (v1.18.0) | 5 (25.1-25.5) | ... | ... | ... | ... |
| 26. Contrast + HH_USER_AGENT (v1.19.0) | 3 (26.1-26.3) | ... | ... | ... | ... |
| 27. v1.20.0 a11y + alias retired | 5 (27.1-27.5) | ... | ... | ... | ... |
| 28. v1.21.0 DNS-rebind TOCTOU closed (B-1) | 3 (28.1-28.3) | ... | ... | ... | ... |
| 29. v1.21.0 path-traversal hardening (H-4) | 4 (29.1-29.4) | ... | ... | ... | ... |
| 30. v1.21.0 LLM rate-limit (H-5) | 3 (30.1-30.3) | ... | ... | ... | ... |
| 31. v1.22.0 docs alignment (career-ops.org/docs) | 6 (31.1-31.6) | ... | ... | ... | ... |
| **Итого** | **~220** | **N** | **M** | **K** | |

Плюс:

- **Console errors суммарно:** число и список уникальных строк
- **Network failures:** все 4xx/5xx ответы (кроме сценариев 3.8–3.10, 4.6–4.7, 8.6–8.8 где они ожидаемые)
- **Скриншоты:** ссылки на artefacts
- **Среднее время отклика** UI (TTFB до first paint) — для оценки производительности

---

## Что является BLOCKER vs WARNING

**Blocker** (заваливает релиз):

- Сценарий 1 — не загрузилась хоть одна страница sidebar или mode
- Сценарий 2 — required-чек красный без обоснования
- Сценарий 3 — Profile YAML save уронил сервер (5xx) или потерял данные после reload
- Сценарий 4c — XSS payload пробрался в textarea (это security-баг)
- Сценарий 4h — multer multipart возвращает 415 (v1.13.0 регрессия)
- Сценарий 5 — `<script>` или `javascript:` оказался в сохранённом cv.md после round-trip
- Сценарий 9 — pipe в company name всё ещё ломает таблицу (BF-1 регрессия)
- Сценарий 16 — упал хоть один из 6 шагов полного flow
- Сценарий 19.1 — `ALL_ADAPTERS.length !== 6` (v1.14.0 регрессия)
- Сценарий 20.2 — белый фон на hover в dark theme (v1.13.0 регрессия)
- Сценарий 23.1 — голые "Greenhouse / Ashby / Lever" фразы в user-facing docs (v1.14.0 регрессия)
- Сценарий 23.3 — какая-то локаль help-бандла имеет ≠16 H2 (parity сломалась)
- Сценарий 24.2 — `POST /api/auto-pipeline` возвращает 5xx или зависает > 90 секунд (v1.16.0 регрессия)
- Сценарий 25.1 — Skip link отсутствует или не работает по `Tab` (v1.18.0 WCAG 2.4.1 регрессия)
- Сценарий 25.4 — `<html lang="...">` отсутствует / неправильный (v1.18.0 WCAG 3.1.1 регрессия)
- Сценарий 26.2 — score pill / badge тёмный текст на тёмном фоне (v1.19.0 контраст регрессия)
- Сценарий 27.1 — `/api/scan-ru/config` всё ещё возвращает 200 (v1.20.0 alias-retired регрессия)
- Сценарий 27.4 — есть `<input>` или `<textarea>` без `<label htmlFor=…>` / `aria-label` (v1.20.0 WCAG 3.3.2 регрессия)
- Сценарий 28.1 — `/api/pipeline/preview` или `/api/auto-pipeline` использует `globalThis.fetch` (v1.21.0 SSRF регрессия — should go through safe-fetch.mjs)
- Сценарий 29.2 — какой-то роут принимает `..pdf` или `....md` и возвращает 200 (v1.21.0 path-traversal регрессия)
- Сценарий 30.1 — `HOST=0.0.0.0` deploy + LLM endpoint без `llmRateLimit` middleware (v1.21.0 H-5 регрессия)

**Warning** (репортишь, но релиз пропускаешь):

- Сценарий 6 — отсутствие Playwright (зависит от стенда)
- Сценарий 7b — отсутствие ключа Anthropic/Gemini
- Сценарий 4d/4e — отсутствие pdftotext/pandoc на хосте (тогда тест должен фейлиться gracefully с hint-текстом — ЭТО ожидаемое поведение, не warning)
- Сценарий 19.3 — пустой `portals.yml::tracked_companies` для какого-то ATS (soft, ожидаемый SKIP)
- Сценарий 21.4 — `runnerExists: false` если parent не имеет `batch/batch-runner.sh` (warning, не blocker)

---

## Сценарий 17. career-ops.org/docs coverage в Help (v1.11.0+)

**Цель.** v1.11.0+ интегрирует все 5 канонических гайдов career-ops.org/docs в help-бандлы. Этот сценарий проверяет, что интеграция полная и работает на всех 8 локалях.

**Канонические URL** (фетчатся из help / README):

- <https://career-ops.org/docs/introduction/what-is-career-ops>
- <https://career-ops.org/docs/introduction/guides/scan-job-portals>
- <https://career-ops.org/docs/introduction/guides/apply-for-a-job>
- <https://career-ops.org/docs/introduction/guides/batch-evaluate-offers>
- <https://career-ops.org/docs/introduction/guides/set-up-playwright>

### 17.1. О career-ops секция присутствует в каждой локали Help

Для каждой из 8 локалей (`en`, `ru`, `es`, `pt-BR`, `ko`, `ja`, `zh-CN`, `zh-TW`):

```bash
curl -sf "http://127.0.0.1:4317/api/help/<lang>" | jq -r .markdown | head -100
```

**Assertions:**

- Раздел «About career-ops» / «О career-ops» / эквивалент присутствует в первой трети.
- Все 5 канонических URL career-ops.org встречаются хотя бы один раз.
- Таблица action thresholds по score (`≥ 4.5` / `4.0–4.4` / `3.5–3.9` / `< 3.5`) присутствует.
- Концепты Mode / Archetype / Pipeline / Tracker / Report / Scan history перечислены.

### 17.2. CLI-флоу обогащение в §5 / §7 / §14

В каждой из 8 локалей:

- **§5 (Portals)** содержит подсекцию `CLI flow (...)` с командами `cp templates/portals.example.yml portals.yml`.
- **§7 (Scan)** содержит подсекцию `CLI scan flow (...)` с обеими опциями: `npm run scan` и `/career-ops scan`.
- **§14 (Apply)** содержит:
  - Полный нумерованный CLI apply flow с шагами 1–8 (от `/career-ops apply <company>` до `Submitted.`).
  - Подсекцию `Batch evaluate` с командами `./batch/batch-runner.sh` (включая `--parallel`, `--min-score`, `--retry-failed`).
  - Подсекцию `Playwright setup` с командами `npx playwright install chromium` и `claude mcp add playwright npx @playwright/mcp@latest`.

**Assertion (грубая регрессия):** в EN-бандле каждая из 5 канонических URL встречается ≥ 2 раз (header front-matter + соответствующая CLI-подсекция).

### 17.3. README имеет «About career-ops» в каждой локали

```bash
grep -l "career-ops.org/docs" README*.md | wc -l   # должно быть 8
```

И в каждом из 8: блок `About career-ops` / «О career-ops» / эквивалент с 5 каноническими ссылками + таблицей action thresholds.

### 17.4. #/apply показывает Playwright setup ссылку

1. Открой `#/apply` в любой локали.
2. Info-баннер должен содержать ссылку на `career-ops.org/docs/.../set-up-playwright` (не просто текст — это `<a href>`).
3. Клик → открывает `https://career-ops.org/docs/introduction/guides/set-up-playwright` в новой вкладке.

### 17.5. #/reports score-thresholds card (v1.11.1+)

1. Открой `#/reports`.
2. Над списком отчётов должна быть карточка-подсказка с таблицей score → action.
3. Карточку можно свернуть (`<details>` с `summary`).

### Финальный gate сценария 17

| Подпункт | Что проверяет | Pass если |
|---|---|---|
| 17.1 | Front-matter блок в 8 локалях | все 8 локалей × все 5 URL присутствуют |
| 17.2 | CLI-флоу подсекции в §5/§7/§14 | в каждой локали все 3 секции содержат подсекцию с командами |
| 17.3 | README блок в 8 локалях | `grep -l 'career-ops.org/docs' README*.md` = 8 |
| 17.4 | #/apply ссылка | `<a href="https://career-ops.org/docs/.../set-up-playwright">` присутствует |
| 17.5 | #/reports подсказка | карточка с таблицей score → action видна на странице |

**PASS = все 5 подпунктов зелёные.**

---

## Сценарий 18. Help bundle parity (i18n)

Регрессия для `tests/help-ui.test.mjs::section-parity` контракта.

```bash
for f in docs/help/*.md; do
  echo "$f: $(grep -c '^## ' "$f") H2 sections"
done
```

**Assertion:** все 8 бандлов должны вернуть ровно **16** H2 секций. Любое расхождение — blocker (parity-тест в CI упадёт).

---

## Сценарий 19. Adapter registry: 6 ATS adapters (v1.14.0)

**Цель.** v1.14.0 расширил adapter registry с 3 до 6 ATSes (Workable, SmartRecruiters, Workday — beta). Этот сценарий проверяет, что resolver видит все 6 и URL-паттерны детектятся правильно.

### 19.1. Unit-уровень — ALL_ADAPTERS == 6

Через cloud-shell (если есть доступ к проектной файловой системе):

```bash
node -e "import('./server/lib/portals/registry.mjs').then(m => console.log(JSON.stringify({ count: m.ALL_ADAPTERS.length, ids: m.ALL_ADAPTERS.map(a => a.id).sort() })))"
```

Ожидается:
```json
{"count":6,"ids":["ashby","greenhouse","lever","smartrecruiters","workable","workday"]}
```

### 19.2. URL-детекция через resolveAdapter()

```bash
node -e "import('./server/lib/portals/registry.mjs').then(m => {
  const cases = [
    { name: 'Anthropic', careers_url: 'https://job-boards.greenhouse.io/anthropic' },
    { name: 'Linear', careers_url: 'https://jobs.ashbyhq.com/linear' },
    { name: 'JetBrains', careers_url: 'https://jobs.lever.co/jetbrains' },
    { name: 'Foo', careers_url: 'https://apply.workable.com/foo-corp/' },
    { name: 'Bar', careers_url: 'https://jobs.smartrecruiters.com/BarCorp' },
    { name: 'BigCo', careers_url: 'https://bigco.wd5.myworkdayjobs.com/en-US/External' },
  ];
  for (const c of cases) {
    const r = m.resolveAdapter(c);
    console.log(c.name, '→', r ? r.adapter.id + ' ' + r.endpoint : 'NO MATCH');
  }
})"
```

**Assertion:** все 6 кейсов резолвятся в соответствующие adapter id'ы, endpoint URL строится правильно (никаких `null`).

### 19.3. SPA — Active Companies card показывает 6 ATS меток (если на стенде есть company per ATS)

Open `#/scan`. Если в `portals.yml::tracked_companies` есть хотя бы по одной записи на каждый ATS — карточка «Active companies» должна показать chip для каждого из 6 (greenhouse, ashby, lever, workable, smartrecruiters, workday). Это soft-assert: при пустом portals.yml сценарий — SKIP.

### 19.4. docs/portals-examples.md содержит блоки для всех 6 ATSes

```bash
for ats in greenhouse ashby lever workable smartrecruiters workday; do
  echo -n "$ats: "
  grep -c "$ats" docs/portals-examples.md
done
```

**Assertion:** каждый id встречается минимум 1 раз.

**PASS = 19.1 + 19.2 зелёные. 19.3 soft. 19.4 структурный.**

---

## Сценарий 20. Theme toggle — dark / light (v1.12.0)

**Цель.** v1.12.0 добавил `🌓` toggle в sidebar и `var(--*)` токены в `public/css/app.css`. v1.13.0 закрыл регрессию контраста на hover-таблиц.

### 20.1. Переключение theme и persist

1. Открой `BASE_URL` (любая страница).
2. Скриншот текущей темы → запиши какая активна (`data-theme` атрибут на `<html>` или `<body>`).
3. Клик на `🌓` в sidebar.
4. Тема инвертируется (была light → теперь dark, или наоборот). Скриншот.
5. Перезагрузи страницу (`F5`).
6. Тема сохранилась (`localStorage.theme` хранится).

### 20.2. Контраст в dark theme — table hover (v1.13.0 fix)

1. Включи dark theme.
2. Открой `#/tracker` (или `#/reports`, или `#/activity` — любая страница с таблицей).
3. Наведи мышь на любую строку таблицы.
4. **Assertion:** background строки на hover **не белый** (не `#fafafa` / `#fff` / `#f7f7f7`). Должен быть `var(--beach)` или равноценный тёмный токен.
5. Скриншот hover в dark — текст должен быть читаемым.

### 20.3. Tab buttons в dark theme

1. Dark theme активна.
2. Открой `#/config` — там есть табы (API keys / Profile / Portals / Modes).
3. Tab buttons должны иметь читаемый контраст в dark (фон `var(--paper)`, активный `var(--beach)`, не белые).

**PASS = 20.1 toggle + persist, 20.2 hover читаем, 20.3 табы читаемы.**

---

## Сценарий 21. Batch evaluate SPA page (v1.13.0)

**Цель.** v1.13.0 добавил `#/batch` SPA-страницу + 4 endpoint'а вокруг `batch/batch-runner.sh` parent-проекта.

### 21.1. `#/batch` рендерится

1. Открой `#/batch` (через прямой URL или sidebar под группой Decision).
2. Должна быть: TSV editor pane (`<textarea>`), панель run-controls (parallel select `1 / 2 / 3`, min-score input, dry-run checkbox, retry checkbox), live SSE console (пустой пока что), pending-additions list.
3. Если `batch/batch-runner.sh` отсутствует в parent — должна быть warning-card (не падать с 500).

### 21.2. TSV редактор + save

1. В TSV editor вставь (символы между колонками — настоящие tab'ы, не пробелы):

   ```tsv
   1	https://example.com/job1	LinkedIn	test
   2	https://example.com/job2	Greenhouse	priority
   ```

2. Клик `💾 Save` (или эквивалентный кнопочный текст).
3. Toast / status: `{ ok: true, rows: 2 }` или эквивалент.

### 21.3. Negative: empty rows

1. Очисти editor.
2. Save → ожидается ошибка (400) с сообщением о пустой строке или "no URLs".

### 21.4. Endpoint sweep (cloud-shell)

```bash
curl -sf http://127.0.0.1:4317/api/batch | python3 -c "import sys,json; d=json.load(sys.stdin); print('  exists=', d.get('exists'), ' runnerExists=', d.get('runnerExists'), ' rows=', len(d.get('rows', [])))"
```

**Assertion:** `exists` true (после 21.2), `runnerExists` зависит от parent (может быть false — это warning, не blocker).

**PASS = 21.1 рендер + 21.2 happy-path + 21.3 negative + 21.4 endpoint живой.**

---

## Сценарий 22. Locale-aware mode scaffolding (v1.13.0)

**Цель.** v1.13.0 добавил `SCAFFOLD_STRINGS` в `server/lib/prompts.mjs` — обёрточный текст в mode/evaluation промптах теперь локализован в 8 локалях. Парент `modes/<slug>.md` body остаётся EN (read-only per CLAUDE.md hard rule #1), но scaffolding вокруг — переводится.

### 22.1. Evaluate manual prompt на разных локалях

1. Переключи язык на `ru`.
2. `#/evaluate` → вставь любой JD → клик `▶ Evaluate` (manual fallback если ключей нет).
3. В результате (`<pre>` блок) ищи русские scaffolding-фразы: `Контекст`, `Прочитай эти файлы` или эквивалент.
4. Переключи на `ja` → повтори → ищи японский scaffold (например `コンテキスト`, `これらのファイルを読んでください`).
5. Переключи на `en` → повтори → должен быть английский scaffold (`Context`, `Read these files`).

**Assertion:** при смене языка scaffolding-обёртка переводится; тело mode-template (EN) остаётся как есть.

### 22.2. Endpoint sweep (cloud-shell)

```bash
curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"jd":"Senior Backend Engineer Python Go PostgreSQL.","mode":"manual","lang":"ru"}' \
  http://127.0.0.1:4317/api/evaluate \
  | python3 -c "import sys,json; p=json.load(sys.stdin).get('prompt',''); print('  has-ru-scaffold=', 'Контекст от пользователя' in p or 'career-ops' in p)"
```

Повтори с `lang: ja`, `lang: en`, `lang: ko-KR`. Каждый ответ должен иметь свой scaffold.

**PASS = 22.1 видишь разный scaffold в 3+ локалях; 22.2 endpoint возвращает prompt с правильным локалем.**

---

## Сценарий 23. Doc parity finale (v1.14.0)

**Цель.** v1.14.0 сделал 42 phrase upgrades в 17 user-facing файлах ("Greenhouse / Ashby / Lever" → "Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday"). Sanity-check что 0 голых 3-ATS фраз не осталось.

### 23.1. Phrase-sweep cloud-shell

```bash
# Должно вернуть 0 строк (все upgraded):
grep -rEn "Greenhouse / Ashby / Lever\b" README*.md docs/help/*.md docs/PROJECT.md \
  | grep -v "Greenhouse / Ashby / Lever / Workable" \
  | wc -l
# → 0
```

### 23.2. 6-ATS phrase count

```bash
grep -rEcn "Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday" README*.md docs/help/*.md docs/PROJECT.md \
  | awk -F: '{s+=$2} END {print s}'
# → 42
```

### 23.3. Help bundle parity (8 locales × 16 H2)

```bash
for f in docs/help/*.md; do
  echo -n "$f: "; grep -c "^## " "$f"
done
# Каждая строка должна заканчиваться на ": 16"
```

### 23.4. CHANGELOG locale presence (8 файлов с v1.14.0)

```bash
grep -l "## \[1.14.0\]" CHANGELOG*.md | wc -l
# → 8
```

**PASS = 23.1=0, 23.2=42, 23.3 каждый файл=16, 23.4=8.**

---

## Сценарий 24. Server-side auto-pipeline (v1.16.0)

**Цель.** v1.16.0 добавил `POST /api/auto-pipeline` + соответствующий SSE-стрим: один запрос прогоняет полный pipeline `validate URL → fetch JD → evaluate → save report → add to tracker` без необходимости кликать каждый шаг вручную. Этот сценарий покрывает happy-path + три edge-кейса.

### 24.1. Endpoint существует и принимает POST

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST -H "Content-Type: application/json" \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/test-cycle-cloud-1"}' \
  http://127.0.0.1:4317/api/auto-pipeline
```

**Assertion:** код 200 ИЛИ 202 (запущено) ИЛИ 400 если URL не проходит `isValidJobUrl` — НЕ 404 (endpoint должен существовать).

### 24.2. SSE stream до конца

Если у cloud-агента есть EventSource или `curl --no-buffer`:

```bash
curl --no-buffer -N \
  -H "Accept: text/event-stream" \
  "http://127.0.0.1:4317/api/stream/auto-pipeline?url=https://job-boards.greenhouse.io/anthropic/jobs/test"
```

**Assertion:** видишь поток событий `event: stage` с фазами:

- `stage: validate` → `status: ok` (или `skip` если URL invalid)
- `stage: fetch` → длина тела > 0
- `stage: evaluate` → если ANTHROPIC_API_KEY / GEMINI_API_KEY задан, получаешь score; иначе manual-prompt fallback
- `stage: save-report` → путь к файлу в `reports/`
- `stage: tracker` → добавлено в `data/applications.md`
- `event: done` финальное событие за < 90 секунд

### 24.3. Negative: invalid URL (SSRF)

```bash
curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"url":"http://127.0.0.1:22/etc/passwd"}' \
  http://127.0.0.1:4317/api/auto-pipeline
```

**Assertion:** HTTP 400 (или 422), JSON-ответ упоминает `loopback`, `invalid`, или `SSRF`. Никаких писаний в `data/pipeline.md` / `data/applications.md` (проверь diff после теста).

### 24.4. Activity log audit

После сценариев 24.1-24.3 проверь `#/activity`:

**Assertion:** появилась запись типа `auto-pipeline` с timestamp ISO, URL = тот что в 24.1, и `status: success` (для happy) или `error` (для 24.3).

**PASS = 24.1 endpoint exists, 24.2 SSE даёт все 5 фаз + done, 24.3 SSRF rejected, 24.4 запись в activity log.**

---

## Сценарий 25. WCAG 2.2 AA — Skip link + Focus Visible + Target Size + Lang (v1.18.0)

**Цель.** v1.18.0 закрыл WCAG 2.2 AA по 5 критериям. Этот сценарий — регрессия каждой проверки в реальном DOM.

### 25.1. Skip link (2.4.1 Bypass Blocks)

1. Открой `BASE_URL` в текущей локали.
2. Нажми `Tab` один раз.
3. **Assertion:** первый focusable — это **skip link** с текстом локализованным («Skip to main content» / «Перейти к основному содержимому» / эквивалент), видимый visually (не `display: none`).
4. Нажми `Enter`.
5. **Assertion:** фокус прыгнул на `#content` (или `<main>`) — не на sidebar nav.

### 25.2. Focus Visible (2.4.7)

1. Tab через 5+ интерактивных элементов на любой странице.
2. **Assertion:** у каждого сфокусированного элемента видимая outline (не `outline: none` без замены). CSS должен иметь `*:focus-visible { outline: 2px solid var(--linen); outline-offset: 2px }` (или эквивалент с min 2px и контраст 3:1).

### 25.3. Target Size (2.5.5 — global floor)

1. Открой DevTools.
2. Выполни:

   ```js
   Array.from(document.querySelectorAll('.btn:not(.btn-sm)')).filter(b => {
     const r = b.getBoundingClientRect();
     return r.height < 44 || r.width < 44;
   }).length
   ```

3. **Assertion:** 0. (Все `.btn` ≥ 44 × 44 px.)
4. То же для `.btn-sm`:

   ```js
   Array.from(document.querySelectorAll('.btn-sm')).filter(b => {
     const r = b.getBoundingClientRect();
     return r.height < 32;
   }).length
   ```

5. **Assertion:** 0. (`.btn-sm` ≥ 32 px высота.)

### 25.4. Language of Page (3.1.1)

```js
document.documentElement.getAttribute('lang')
```

**Assertion:** возвращает текущий язык SPA (`en`, `ru`, `es`, `pt-BR`, `ko-KR`, `ja`, `zh-CN`, `zh-TW`). При смене языка через `.lang-btn[data-lang-btn]` атрибут должен обновляться без перезагрузки.

### 25.5. Info & Relationships — `#content tabindex="-1"` (1.3.1)

```js
document.getElementById('content').getAttribute('tabindex')
```

**Assertion:** возвращает `"-1"`. (Это позволяет Skip link перевести фокус программно.)

**PASS = все 5 подпунктов зелёные.**

---

## Сценарий 26. WCAG 1.4.3 contrast + HH_USER_AGENT удалён (v1.19.0)

### 26.1. Badge / score pill контраст в light theme

1. Включи light theme (`🌓` в sidebar).
2. Открой `#/reports` или `#/tracker` — там есть бейджи (`.badge-ok`, `.badge-warn`, `.badge-bad`, `.badge-info`) и score pills (`.score-high`, `.score-mid`, `.score-low`).
3. Через DevTools → Inspect → Contrast (или axe browser ext) проверь каждый текст на цветном фоне.
4. **Assertion:** все ≥ 4.5:1 (AA для normal text). v1.19.0 добавил `*-text` варианты — должны использоваться.

### 26.2. Badge / score pill контраст в dark theme

1. Переключи `🌓` → dark theme.
2. Та же проверка.
3. **Assertion:** все ≥ 4.5:1 на dark background `#161a22`.

### 26.3. HH_USER_AGENT отсутствует в `/#/config`

1. Открой `#/config` → таб «App settings» (API keys).
2. **Assertion:** среди полей **НЕТ** `HH_USER_AGENT`. Известные ключи в v1.19+: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `HOST`, `PORT`. И никакой `regional` группы.

**Endpoint sweep:**

```bash
curl -sf http://127.0.0.1:4317/api/config | python3 -c "import sys,json; print('HH_USER_AGENT' in json.load(sys.stdin).get('values', {}))"
# → False
```

**PASS = 26.1 light AA, 26.2 dark AA, 26.3 HH_USER_AGENT отсутствует.**

---

## Сценарий 27. v1.20.0 — per-component a11y polish + `/api/scan-ru/config` alias retired

### 27.1. `/api/scan-ru/config` legacy alias retired

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4317/api/scan-ru/config
# → 404
```

**Assertion:** код 404. v1.19.0 был sunset релизом, v1.20.0 удалил окончательно.

### 27.2. Canonical regional config работает

```bash
curl -sf http://127.0.0.1:4317/api/scan/regional/config | python3 -c "import sys,json; d=json.load(sys.stdin); print('queries=', len(d.get('queries', [])), 'sources=', d.get('sources'))"
```

**Assertion:** код 200, JSON с непустыми `queries` и `sources`.

### 27.3. Touch targets — chips / nav-item / tab-btn (WCAG 2.5.5 / 2.5.8)

В DevTools на `#/scan` (есть chip-row):

```js
// Chips: min-height 28px + chip-row gap 8px
Array.from(document.querySelectorAll('.chip')).filter(c =>
  c.getBoundingClientRect().height < 28
).length
// → 0

// Nav items: min-height 44px
Array.from(document.querySelectorAll('.nav-item')).filter(n =>
  n.getBoundingClientRect().height < 44
).length
// → 0

// Tab buttons: min-height 44px
Array.from(document.querySelectorAll('.tab-btn')).filter(t =>
  t.getBoundingClientRect().height < 44
).length
// → 0
```

**Assertion:** каждый из трёх = 0.

### 27.4. Form labels association (WCAG 3.3.2)

Открой `#/config` → таб «App settings», `#/evaluate`, `#/pipeline`, `#/batch` и каждый из 7 modes (`#/project`, etc). На каждой странице:

```js
Array.from(document.querySelectorAll('input:not([type="checkbox"]), textarea, select')).filter(el =>
  !el.labels?.length && !el.getAttribute('aria-label')
).map(el => el.outerHTML.slice(0, 100))
// → []
```

**Assertion:** пустой массив. Каждый control имеет `<label for=…>` (через `htmlFor`) или `aria-label`.

### 27.5. aria-describedby на hint paragraphs

На `#/config → Profile`, `#/evaluate`, `#/pipeline`, `#/batch`:

```js
Array.from(document.querySelectorAll('[aria-describedby]')).map(el =>
  ({ id: el.id, describedBy: el.getAttribute('aria-describedby'), valid: !!document.getElementById(el.getAttribute('aria-describedby')) })
).filter(x => !x.valid)
// → []
```

**Assertion:** пустой массив. Каждый `aria-describedby` указывает на существующий ID.

### Bonus — non-EN README parity (offline check)

```bash
wc -l /Users/sergejemelanov/Projects/career-ops/web-ui/README*.md | head -8
# Все 8 должны быть в диапазоне 555-585 строк (EN master = 585).
```

**PASS = 27.1 alias 404, 27.2 canonical OK, 27.3 все три селектора = 0, 27.4 все form controls с label, 27.5 все aria-describedby ссылки валидны.**

---

## Сценарий 28. v1.21.0 — DNS-rebind TOCTOU closed (B-1)

**Цель.** v1.21.0 ввёл `server/lib/safe-fetch.mjs`: один DNS lookup, pinned TCP connection через `node:http(s)`, fail-CLOSED on lookup error. Закрывает TOCTOU между explicit `dnsLookup` и второй lookup внутри `fetch()`. Используется в `/api/pipeline/preview` и `/api/auto-pipeline`.

### 28.1. `safe-fetch.mjs` exists и используется в SSRF routes

Через cloud-shell (если есть доступ к файловой системе):

```bash
test -f server/lib/safe-fetch.mjs && echo OK || echo MISSING
grep -l "safeGet" server/lib/routes/{pipeline,auto-pipeline}.mjs | wc -l
# → 2 (both routes use safeGet)

grep -E "globalThis\.fetch|^fetch\(" server/lib/routes/pipeline.mjs server/lib/routes/auto-pipeline.mjs
# → 0 matches (SSRF paths must NOT use fetch directly)
```

**Assertion:** safe-fetch.mjs exists, both SSRF routes import safeGet, neither uses raw fetch.

### 28.2. `/api/pipeline/preview` rejects private-IP host

```bash
# Try a hostname that would resolve to a private IP. The server should reject.
curl -sf "http://127.0.0.1:4317/api/pipeline/preview?url=https://localhost/x" \
  -o /dev/null -w "%{http_code}\n"
# → 400 (isValidJobUrl rejects localhost)

curl -sf "http://127.0.0.1:4317/api/pipeline/preview?url=https://example.invalid/x" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('text', '')[:100])"
# Expected: error text mentioning DNS lookup failure or private address — NOT the upstream HTML body.
```

### 28.3. `tests/ssrf-redirect-rebind.test.mjs` passes

```bash
node --test tests/ssrf-redirect-rebind.test.mjs 2>&1 | tail -3
# → tests 8 / pass 8 / fail 0
```

**PASS = 28.1 safeGet wired in both SSRF routes; 28.2 private-host rejected; 28.3 all 8 rebind tests green.**

---

## Сценарий 29. v1.21.0 — path-traversal hardening (H-4)

**Цель.** v1.21.0 поднял `sanitizePathName` в `server/lib/security.mjs` и заменил 10 broken regex копий по 7 route файлам. `..pdf`, `....md`, leading-dot names теперь → 400.

### 29.1. Broken regex copies удалены

```bash
grep -r "replace(/\[\^\\\\w\\\\\\-\.\]/g," server/ | wc -l
# → 0 (все консолидированы в sanitizePathName)
```

### 29.2. Each route returns 400 for traversal-style names

```bash
for path in /api/jds /api/reports /api/modes /api/output/pdfs /api/interview-prep; do
  for name in "..pdf" "....md" "..%2fpasswd" ".hidden"; do
    code=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:4317${path}/${name}")
    echo "$path/$name → $code"
  done
done
# Expected: каждая строка должна быть 400 или 404 (никогда 200)
```

### 29.3. Тесты path-traversal зелёные

```bash
node --test tests/path-traversal.test.mjs 2>&1 | tail -3
# → tests 12 / pass 12 / fail 0
```

### 29.4. Valid names ещё работают (regression sanity)

Создай файл `jds/valid-name-2026.txt` в parent fixture, потом:

```bash
curl -sf "http://127.0.0.1:4317/api/jds/valid-name-2026.txt" | head -c 50
# → contents of the file (200, не 400)
```

**PASS = 29.1 = 0, 29.2 все 4xx, 29.3 все 12 тестов, 29.4 valid names ещё работают.**

---

## Сценарий 30. v1.21.0 — LLM rate-limit (H-5)

**Цель.** v1.21.0 ввёл `llmRateLimit` middleware на `/api/evaluate`, `/api/deep`, `/api/mode/:slug`, `/api/auto-pipeline`. No-op на loopback; 10 req/min/IP на `HOST=0.0.0.0`. Конфигурируется через `LLM_RATE_LIMIT="N/Ws"`.

### 30.1. Loopback deploy — никакого throttling

С default `HOST=127.0.0.1`:

```bash
# Прогнать 20 запросов подряд — все должны быть 200/202/4xx (но НЕ 429)
for i in $(seq 1 20); do
  code=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"jd":"Senior Backend Engineer..."}' \
    http://127.0.0.1:4317/api/evaluate)
  echo "req $i: $code"
done
# Ни одного 429 (loopback мode — limit неактивен)
```

### 30.2. Public bind с custom limit — fires правильно

Перезапусти сервер с `HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s` (cloud-shell):

```bash
HOST=0.0.0.0 LLM_RATE_LIMIT=3/60s npm start &
sleep 3
for i in 1 2 3 4; do
  code=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"jd":"Senior Backend Engineer..."}' \
    http://0.0.0.0:4317/api/evaluate)
  echo "req $i: $code"
done
# Expected: 200 200 200 429 (4-й hit лимит)
```

### 30.3. Заголовки на 429

```bash
HOST=0.0.0.0 LLM_RATE_LIMIT=1/60s curl -sI -X POST \
  -H "Content-Type: application/json" -d '{"jd":"..."}' \
  http://0.0.0.0:4317/api/evaluate
curl -sI -X POST -H "Content-Type: application/json" -d '{"jd":"..."}' \
  http://0.0.0.0:4317/api/evaluate | grep -E "Retry-After|X-RateLimit"
# Expected: Retry-After: <seconds>, X-RateLimit-Limit: 1, X-RateLimit-Reset: <epoch>
```

**PASS = 30.1 нет 429 на loopback, 30.2 4-й запрос на public bind → 429, 30.3 правильные headers.**

---

## Сценарий 31. career-ops.org/docs alignment (v1.22.0)

**Цель.** UI должен соответствовать описанному функционалу в 5 канонических гайдах на [career-ops.org/docs](https://career-ops.org/docs):

- <https://career-ops.org/docs/introduction/what-is-career-ops>
- <https://career-ops.org/docs/introduction/guides/scan-job-portals>
- <https://career-ops.org/docs/introduction/guides/apply-for-a-job>
- <https://career-ops.org/docs/introduction/guides/batch-evaluate-offers>
- <https://career-ops.org/docs/introduction/guides/set-up-playwright>

Этот сценарий — сверка реального поведения UI с описанием в документации. Если UI отклоняется от описанного behavior, фиксируй как defect.

### 31.1. Score thresholds от docs соответствуют UI

Откой [career-ops.org/docs/introduction/what-is-career-ops](https://career-ops.org/docs/introduction/what-is-career-ops) — там action thresholds:

- ≥ 4.5 → `/career-ops apply` (push immediately)
- 4.0 – 4.4 → apply, or `/career-ops contacto` for warm intro
- 3.5 – 3.9 → `/career-ops deep` (research first)
- < 3.5 → skip

**Verify:**

- Open `#/reports`. Score pills использует тот же threshold-mapping (high ≥ 4.0, mid ≥ 3.0, low < 3.0)? Допустимая дельта — score pill brackets могут быть чуть мягче (UI: ≥4, ≥3, <3; docs: ≥4.5, ≥4.0, ≥3.5, <3.5).
- Reports page карточка score-thresholds (v1.11.1) присутствует и читается? `#/reports` → expandable `<details>` с таблицей.
- Help bundle на текущей локали (`/api/help/<lang>`) упоминает все 4 бакета score → action в первой трети текста.

### 31.2. Scan job portals workflow

Сверь UI flow с [scan-job-portals.md](https://career-ops.org/docs/introduction/guides/scan-job-portals) описанием:

- Конфигурация: `portals.yml` → `tracked_companies`, `russian_portals`, `title_filter.positive` / `.negative`
- Запуск: single 🌐 Scan button → консолидированный SSE → 6 ATS + hh.ru + Habr
- Output: `data/last-scan.json` (filterable) + `data/scan-history.tsv` (history) + новые URLs в `data/pipeline.md` (filtered)

**Endpoint sweep:**

```bash
# v1.18.0+: один consolidated endpoint, никаких -en / -ru aliases.
curl -sf -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:4317/api/stream/scan?source=ats&dryRun=1"
# → 200 (SSE начинается)

# Legacy aliases должны быть мёртвы:
curl -sf -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4317/api/stream/scan-en
curl -sf -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4317/api/stream/scan-ru
curl -sf -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4317/api/scan-ru/config
# → 404 404 404 (v1.18.0 + v1.20.0 retirements)

# Canonical regional config:
curl -sf http://127.0.0.1:4317/api/scan/regional/config | python3 -c "import sys,json; d=json.load(sys.stdin); print('queries=', len(d.get('queries', [])))"
```

**UI verify:** На `#/scan` есть единая 🌐 Scan кнопка (НЕ две отдельные EN/RU), активна Active Companies card с health-чипами для каждого ATS.

### 31.3. Apply for a job workflow

Сверь с [apply-for-a-job.md](https://career-ops.org/docs/introduction/guides/apply-for-a-job):

- `/career-ops apply` (Claude Code command) — autonomous form-fill через Playwright MCP
- UI `#/apply` — НЕ автозаполняет, генерирует **checklist** для пользователя
- Чеклист включает: URL валидацию, JD intent, manual review steps, ATS-specific hints
- Banner на `#/apply` ссылается на `set-up-playwright.md` гайд (v1.11.1+)

**Verify:**

- Открой `#/apply` → проверь, что info-banner содержит `<a href="https://career-ops.org/docs/introduction/guides/set-up-playwright">` (не plain text).
- POST `/api/apply-helper` с `{ "url": "https://job-boards.greenhouse.io/anthropic/jobs/x", "jd": "Senior Backend" }` — body содержит и `career-ops apply` (упоминание parent-команды), и `NEVER auto-submit` warning.
- Help bundle §14 (Apply) содержит CLI flow с шагами 1–8 от `/career-ops apply <company>` до `Submitted.`

### 31.4. Batch evaluate offers workflow

Сверь с [batch-evaluate-offers.md](https://career-ops.org/docs/introduction/guides/batch-evaluate-offers):

- `batch/batch-input.tsv` — `id<TAB>url<TAB>source<TAB>notes` per row
- `batch/batch-runner.sh --parallel N --min-score X --retry-failed`
- Output: `batch/results/run-<ts>.tsv` + `batch/tracker-additions/*.md` (pending merge)
- UI surface: `#/batch` (canonical, v1.13.0+)

**Verify:**

- `#/batch` рендерит TSV editor + 4 контролы (parallel, min-score, dry-run, retry) + live console
- Endpoint `GET /api/batch` возвращает `{ exists, runnerExists, rows: [...] }` (runnerExists может быть false на стенде — soft)
- `batch.parallel`, `batch.minScore`, `batch.dryRun`, `batch.retry` ARIA-описаны (v1.20.0 wiring, v1.21.0 H-2 fix)
- TSV save → backend парсит таб-разделители корректно (НЕ split по пробелам)

### 31.5. Playwright setup workflow

Сверь с [set-up-playwright.md](https://career-ops.org/docs/introduction/guides/set-up-playwright):

- `npx playwright install chromium` (one-time) — установка браузеров для PDF + apply
- `claude mcp add playwright npx @playwright/mcp@latest` (для apply form-fill)
- Setup нужен только для PDF generation (`#/cv → Generate PDF`) + apply workflow

**Verify:**

- `#/apply` banner ссылается на этот URL
- Если Playwright НЕТ — `📄 Generate PDF` падает с graceful hint, не 500
- Help bundle §14 (Apply) подсекция `Playwright setup` содержит обе команды

### 31.6. Help bundle ↔ docs URL coverage в 8 локалях

```bash
for lang in en es pt-BR ko-KR ja ru zh-CN zh-TW; do
  echo -n "$lang: "
  for url in 'what-is-career-ops' 'scan-job-portals' 'apply-for-a-job' 'batch-evaluate-offers' 'set-up-playwright'; do
    if curl -sf "http://127.0.0.1:4317/api/help/${lang%-*}" | grep -q "$url"; then echo -n "✓ "; else echo -n "✗ "; fi
  done
  echo ""
done
# Expected: каждая локаль показывает 5 ✓
```

### Финальный gate сценария 31

| Подпункт | Что проверяет | PASS если |
|---|---|---|
| 31.1 | Score thresholds | UI score pills + reports card матчат docs action-thresholds |
| 31.2 | Scan workflow | один 🌐 Scan endpoint, legacy aliases 404 |
| 31.3 | Apply workflow | `#/apply` banner + checklist response соответствуют docs |
| 31.4 | Batch workflow | `#/batch` рендерит TSV-editor + 4 controls, batch endpoints работают |
| 31.5 | Playwright setup | gracefully fails если нет Playwright, banner ссылается на гайд |
| 31.6 | Help docs coverage | 5 URLs × 8 локалей = 40 ✓ |

**PASS = все 6 подпунктов зелёные.**

**BLOCKER если:**

- Сценарий 31.1 — score thresholds в UI противоречат docs (e.g. UI mid начинается с 2.5 вместо 3.0)
- Сценарий 31.2 — legacy alias всё ещё возвращает 200 (v1.18 или v1.20 регрессия)
- Сценарий 31.3 — `#/apply` form-fill автозаполняет (нарушает CLAUDE.md "Never auto-submit")
- Сценарий 31.6 — какая-то локаль help-бандла теряет хотя бы 1 из 5 URLs

---

## Last verified live execution — 2026-05-14 (v1.24.0)

> Этот блок обновляется каждый раз, когда сценарии прогоняются против живого сервера. Полная история — в `docs/reviews/REVIEW-*.md`.

### Server context

- Server: `http://127.0.0.1:4317`
- Build: v1.24.0 (commit `dca60f7` + v1.24 docs refresh)
- Node: ≥18, Playwright resolved via parent `node_modules`

### Scenario 31 sub-test results (local execution)

| Sub | Description | Status | Detail |
|---|---|---|---|
| 31.1 | Score thresholds in help bundles | ✅ PASS | `4.5` × 3, `4.0` × 9, `3.5` × 6 mentions in `docs/help/en.md`; thresholds table preserved across all 8 locales |
| 31.2 | Scan workflow endpoints | ✅ PASS | `/api/stream/scan-{en,ru}` + `/api/scan-ru/config` → **404**; `/api/scan/regional/config` → **200** |
| 31.3 | `/api/apply-helper` checklist | ✅ PASS | POST returns body containing `career-ops apply` (parent-command mention) + `auto-submit` warning |
| 31.4 | `/api/batch` endpoint | ✅ PASS | GET returns keys `[exists, runnerExists, raw, rows, additions]` |
| 31.5 | Playwright availability | ✅ PASS | `/api/health` reports `Playwright (parent node_modules)` check `ok: true, value: installed` |
| 31.6 | Help-bundle URL coverage (5 URLs × 8 locales) | ✅ PASS | **40 / 40 ✓** — every locale carries every canonical URL |

### Scenario 31.6 detailed coverage matrix

| Locale | what-is | scan-job | apply-for | batch-eval | playwright |
|---|---|---|---|---|---|
| en | ✓ | ✓ | ✓ | ✓ | ✓ |
| es | ✓ | ✓ | ✓ | ✓ | ✓ |
| pt-BR | ✓ | ✓ | ✓ | ✓ | ✓ |
| ko | ✓ | ✓ | ✓ | ✓ | ✓ |
| ja | ✓ | ✓ | ✓ | ✓ | ✓ |
| ru | ✓ | ✓ | ✓ | ✓ | ✓ |
| zh-CN | ✓ | ✓ | ✓ | ✓ | ✓ |
| zh-TW | ✓ | ✓ | ✓ | ✓ | ✓ |

### How this was executed (reproducible)

```bash
# Server up locally on loopback
PORT=4317 HOST=127.0.0.1 npm start &
sleep 3

# 31.2 — retired aliases vs canonical
for ep in /api/stream/scan-en /api/stream/scan-ru /api/scan-ru/config /api/scan/regional/config; do
  curl -sS -o /dev/null -w "$ep: %{http_code}\n" "http://127.0.0.1:4317$ep"
done

# 31.3 — apply-helper checklist sanity
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"url":"https://job-boards.greenhouse.io/anthropic/jobs/test","jd":"Senior Backend Engineer"}' \
  http://127.0.0.1:4317/api/apply-helper | python3 -c "
import sys, json
b = json.load(sys.stdin)
print('career-ops apply' in json.dumps(b), 'auto-submit' in json.dumps(b).lower())"

# 31.4 — batch endpoint shape
curl -sS http://127.0.0.1:4317/api/batch | python3 -c "
import sys, json
print(list(json.load(sys.stdin).keys()))"

# 31.5 — Playwright check from /api/health
curl -sS http://127.0.0.1:4317/api/health | python3 -c "
import sys, json
d = json.load(sys.stdin)
print([c for c in d['checks'] if 'laywright' in c['name']])"

# 31.6 — Help-bundle URL coverage matrix
for lang in en es pt-BR ko ja ru zh-CN zh-TW; do
  echo -n \"$lang: \"
  for url in what-is-career-ops scan-job-portals apply-for-a-job \\
             batch-evaluate-offers set-up-playwright; do
    curl -sS \"http://127.0.0.1:4317/api/help/$lang\" \\
      | python3 -c \"import sys,json; print(json.load(sys.stdin).get('markdown',''))\" \\
      | grep -q \"$url\" && echo -n \"✓ \" || echo -n \"✗ \"
  done
  echo
done
```

### Manual / UI-only sub-tests (require browser)

These 31 sub-tests need a browser-driven agent (Claude Cowork or local Playwright session) — not coverable via curl:

- **31.1 visual** — `#/reports` shows score-thresholds card with table (`<details>` element); score-high / score-mid / score-low pills render with v1.22.0 `::before` glyphs (✓ / ◐ / ○).
- **31.2 visual** — `#/scan` shows a SINGLE `🌐 Scan` button (not two EN/RU buttons).
- **31.3 visual** — `#/apply` info-banner contains a real `<a href="https://career-ops.org/docs/.../set-up-playwright">` link element (not plain text).
- **31.4 visual** — `#/batch` renders TSV editor + 4 controls (parallel select, min-score input, dry-run checkbox, retry checkbox); console pane shows SSE log lines after Save.
- **31.5 visual** — `#/cv` → `📄 Generate PDF` button. If Playwright missing → graceful warning, NOT 500.

Run those via Claude Cowork or `npm run test:e2e:browser` (Playwright Smoke covers the canonical happy-paths).


