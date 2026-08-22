# Fix-prompt for Claude Code · career-ops-ui v1.10.0 → v1.11.0

> Paste this whole file into Claude Code with the working dir set to
> `/Users/sergejemelanov/Projects/career-ops/web-ui/`.
>
> Each block below is one PR. Commit messages use Conventional Commits (`fix:`,
> `feat:`, `refactor:`, `docs:`, scoped). Land them in the order given —
> later PRs assume earlier ones merged. After each PR run `npm test` and
> `npm run test:e2e:full`.

---

## PR-1 · `fix(scan): kill EN/RU split, ship locale-agnostic adapter registry`

Rolls up findings F-010, F-011, F-014, F-018. The biggest single win.

### Goal
The product is multi-language. There is no "EN scanner" or "RU scanner" — there are *portal adapters* that happen to know how to talk to specific ATSes. Today every layer (UI, API, source code, help docs) hardcodes a binary EN/RU split. Collapse it into a single adapter registry.

### Changes

1. **`server/lib/portals/adapters/`** (new folder). Move the per-ATS scraping logic out of `en-scanner.mjs` / `ru-scanner.mjs` into one file per adapter:
   - `greenhouse.mjs`, `ashby.mjs`, `lever.mjs`, `workable.mjs`, `smartrecruiters.mjs`, `workday.mjs`, `hh.mjs`, `habr.mjs`.
   - Each exports `{ id, label, matches(portalsYml), scan({ filter, signal }) → AsyncIterable<job> }`.

2. **`server/lib/portals/registry.mjs`** (new). Exports `ALL_ADAPTERS` and `resolveEnabled(portalsYml)`.

3. **`server/lib/routes/runners.mjs`** — replace `/api/stream/scan-en` and `/api/stream/scan-ru` with one `/api/stream/scan`. Old endpoints return `410 Gone` with `{ error: "use /api/stream/scan", since: "1.11.0" }`. The new stream emits SSE events `start`, `adapter-start`, `hit`, `adapter-done`, `done`, `error` — front-end subscribes once, renders one log column.

4. **`/api/scan-results`** — change shape from `{ en, ru }` to `{ bySource: { 'greenhouse:anthropic': [...], 'hh': [...] }, hits: [...flat], stats: { totalHits, perAdapter } }`. Provide `/api/scan-results?legacy=1` for one release as a deprecated EN/RU shim.

5. **`/api/portals`** — add a `stats` field with `last_hits` per company derived from `data/last-scan.json` so the UI can show truly active companies (F-011).

6. **Front-end `public/js/views/scan.js`** —
   - Remove the `EN: 80 · RU: hh.ru + Habr Career` summary line. Replace with `i18n.scan.summary` keyed string driven by adapter/company counts.
   - Source dropdown: rebuild from the adapter registry (`Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday / hh.ru / Habr Career`) — alphabetical, no geo-tag.
   - Company filter caption: `Компания (для EN, опционально)` → `Компания (опционально)`. Same in every locale bundle.
   - Empty-state: `Запустите EN или RU scan выше — после завершения таблица появится здесь.` → `Запустите скан выше — после завершения таблица появится здесь.` Same key in every locale bundle.
   - "Active companies — N/M" — derive `N` from `stats.bySource` aggregation (companies with ≥1 hit in last scan), `M` from `tracked_companies.length`.

7. **Front-end results table** — auto-refresh on the new SSE `done` event (no manual reload needed).

8. **`portals.yml`** — add ~14 more enabled boards (GitLab, HashiCorp, Cloudflare, Datadog, Stripe, Notion, Linear, Posthog, Hugging Face, Replicate, Modal Labs, Tabby, Fly.io, Render). Run `node scripts/portals-health-check.mjs` after.

9. **CI gate** — `scripts/check-no-enru-bleed.mjs`:
```bash
grep -RIn -E '(EN|RU)-(sweep|scanner|sources|portals|источник|sweep)|EN: 80|для EN|EN или RU' \
  server/ public/ docs/ web-ui/i18n/ web-ui/help/ README.md && exit 1 || exit 0
```

### Tests
- `tests/scan-adapter-registry.test.mjs` — every adapter passes a smoke `scan()` against a recorded fixture.
- `tests/scan-stream-single-endpoint.test.mjs` — old `/api/stream/scan-en` returns 410, new `/api/stream/scan` emits the documented event sequence.
- Snapshot: `#/scan` rendered in each locale contains zero matches against the bleed-grep regex above.

---

## PR-2 · `feat(i18n): help bundles parity + Korean help body + locale propagation to LLM`

Rolls up F-002, F-012, F-014.

### Goal
Every locale ships a complete help bundle, and every LLM-prompt route honors the user's UI locale so the model responds in the right language.

### Changes

1. **`web-ui/help/help.ko.md`** (new). Translate the EN bundle in full — preserve the 16-section structure, every `## H2`, every walkthrough step (Step 1…Step 21). Code blocks (`portals.yml`, env keys table, troubleshooting table) stay verbatim. Add to git.

2. **`scripts/help-i18n-check.mjs`** (new) — CI fails if any `help.<locale>.md` has a different H2 count, code-fence count, or walkthrough-step count from `help.en.md`. Run against `LOCALES = ['en','ru','es','pt-BR','ko','ja','zh-CN','zh-TW']`.

3. **`server/lib/routes/llm.mjs`** — every prompt-builder route reads locale from the request. Order of precedence: `req.body.lang` → `req.body.locale` → `req.headers['accept-language']` first 2 chars (with `-region` re-attached for `pt-BR`, `zh-CN`, `zh-TW`) → `'en'`. Inject a one-line directive into the assembled prompt:
```
# Output language
Respond in {LOCALE_NAME[lang]} (locale: {lang}). Keep code/identifiers in English; translate prose.
```
Apply to: `/api/mode/<slug>` (×7), `/api/evaluate`, `/api/deep`, `/api/apply-helper`.

4. **`/api/evaluate`** — additionally honor `mode: 'manual'` body flag exactly like `/api/deep` does today (F-009). When manual, return `{ mode: 'manual', prompt, message }` without calling Anthropic/Gemini even if the API key is set.

5. **Front-end `public/js/api.js`** — every prompt POST sends `Accept-Language: <currentLocale>` header AND `lang: <currentLocale>` body field. Add a unit test asserting the header is set.

6. **Mode templates `modes/<slug>.md`** — leave English for now; the directive does most of the work. Schedule a follow-up "translate mode templates" task in `.planning/`.

### Tests
- `tests/help-i18n-parity.test.mjs` — every locale bundle has exact same section count.
- `tests/llm-honors-locale.test.mjs` — `POST /api/mode/project { lang:'ru' }` returns prompt containing "Respond in Russian".
- `tests/evaluate-honors-manual-flag.test.mjs` — `POST /api/evaluate { jd:'…', mode:'manual' }` returns within 100 ms with `mode:'manual'` in body even when ANTHROPIC_API_KEY is set.

---

## PR-3 · `fix(security): tighten isValidJobUrl against RFC1918 / link-local / 0.0.0.0 / DNS-rebind`

Rolls up F-003. Deliver this **before** PR-1 if the production stand runs with `HOST=0.0.0.0` — it's a credential-exfiltration vector on AWS hosts.

### Goal
The validator rejects loopback, scheme-misuse, and template chars but lets RFC1918, link-local (incl. AWS IMDS `169.254.169.254`), `0.0.0.0`, and DNS-rebind hostnames slip through. Close the gap.

### Changes

1. **`server/lib/url-validator.mjs`** (or wherever `isValidJobUrl` lives) — add private-range checks:
```js
const PRIVATE_IPV4 = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,                 // link-local (AWS IMDS)
  /^127\./,                       // loopback range, not just .0.0.1
  /^0\.0\.0\.0$/,                 // any-address alias
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./   // CGNAT
];
function isPrivateOrLoopback(host) {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return PRIVATE_IPV4.some(rx => rx.test(host));
  if (host.startsWith('[')) {
    const ip = host.slice(1, -1).toLowerCase();
    return ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  }
  return /^localhost$/i.test(host) || host.endsWith('.localhost');
}
```

2. **Pipeline preview proxy** — after DNS resolution, re-validate the resolved IP against `PRIVATE_IPV4`. Pin the connection to the resolved IP via a custom HTTP agent so DNS isn't re-resolved between TLS and HTTP (defeats DNS-rebind).

3. **Per-hop validation on redirects** — already present per REVIEW-B1; verify the new helper is called at every hop.

### Tests
- `tests/url-validator-rfc1918.test.mjs` — every entry in the matrix below is rejected:
```
http://10.0.0.1/x · http://172.16.0.1/x · http://192.168.1.1/x ·
http://169.254.169.254/x · http://0.0.0.0/x · http://127.0.0.1.nip.io/x
```
- `tests/preview-proxy-blocks-dns-rebind.test.mjs` — mock DNS lookup to return `127.0.0.1`; assert proxy returns 400.

---

## PR-4 · `fix(cv): parse multipart upload correctly, return structured 413/415/422`

Rolls up F-016, F-019. Closes the silent-cv-corruption hole that ate this user's CV during the regression run.

### Goal
`/api/cv/import` today is wired through `express.raw()` — it stores whatever bytes arrive into `cv.md`. A small multipart blob ends up persisting the multipart wire envelope as the CV; an 11-MB blob throws `PayloadTooLargeError` at the parser with no JSON body to the client. Fix both.

### Changes

1. Add `multer` to dependencies (`npm i multer` — under `dependencies`, not `devDependencies`).

2. **`server/lib/routes/content.mjs`** — replace the raw parser with multer:
```js
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

app.post('/api/cv/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'multipart "file" field required' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) return res.status(415).json({ error: `unsupported format "${ext}"` });
    const md = await convertToMarkdown({ ext, buffer: req.file.buffer });
    const sanitized = stripDangerousMarkdown(md);
    await atomicWriteFile(PATHS.cv, sanitized.text);
    res.json({ ok: true, sanitized: sanitized.changed, via: ext, bytes: Buffer.byteLength(sanitized.text), markdown: sanitized.text });
  } catch (e) { next(e); }
});
```

`atomicWriteFile` writes to `cv.md.tmp` then `fs.rename()` → atomic. Backup with `fs.copyFile(cv.md → cv.md.bak)` before each successful write.

3. **`convertToMarkdown`** dispatch:
```js
{ '.md': passthrough, '.markdown': passthrough, '.txt': passthrough,
  '.html': pandocHtmlToGfm, '.htm': pandocHtmlToGfm,
  '.docx': pandocOfficeToGfm, '.doc': pandocOfficeToGfm,
  '.odt': pandocOfficeToGfm, '.rtf': pandocOfficeToGfm,
  '.pdf': pdftotext }
```
Throw `ConversionError` with friendly message; route handler turns it into 422 with `{ error, detail }`.

4. **Global error handler `server/index.mjs`** — register at the bottom, ahead of the 404 fallback:
```js
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'file too large (max 10 MB)', limit: '10mb' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'request body too large', limit: err.limit, length: err.length });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'malformed request body' });
  if (err instanceof ConversionError) return res.status(422).json({ error: 'conversion failed', detail: err.message });
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'internal server error' });
});
```

5. **Front-end** — when 413/415/422 arrive, surface a localized toast: «Файл слишком большой (>10 МБ)» / «Format не поддерживается: .exe» / «Не удалось сконвертировать файл».

### Tests
- `tests/cv-import-multipart.test.mjs` — every supported extension round-trips; unsupported returns 415; 11 MB returns 413 JSON; malformed multipart returns 400; cv.md is *not* overwritten on failure.

---

## PR-5 · `fix(activity): record only successful state changes, include profile.save`

Rolls up F-005, F-008.

### Goal
Activity log should be a clean audit trail of what changed, not a noise-fest of rejected attempts. Profile save was missing entirely.

### Changes

1. **Reorder validate → write → record** in every route that today calls the activity recorder before checking validity. Specifically `/api/pipeline` POST, `/api/cv` PUT, `/api/tracker` POST.

2. **Add recorder calls** to `/api/profile` PUT and `/api/config` POST:
```js
recordActivity('profile.save', { target: 'config/profile.yml', bytes });
recordActivity('config.save',  { target: '.env', changedKeys: changes });
```

3. **Activity event shape** — make sure every record has: `{ action, target, timestamp (ISO), bytes? , user? }`. Today some have `target: <full-newline-bearing-string>`; truncate to first line + '…' for display while keeping the full target in the JSON.

### Tests
- `tests/activity-skips-rejected.test.mjs` — `POST /api/pipeline { url:'not-a-url' }` returns 400 and `events.length` is unchanged.
- `tests/activity-records-profile-save.test.mjs` — `PUT /api/profile { yaml: ... }` produces a `profile.save` event.

---

## PR-6 · `fix(api): pipeline DELETE accepts both ?url= and JSON body, returns 404 when missing`

Rolls up F-017.

### Changes

```js
app.delete('/api/pipeline', async (req, res) => {
  const url = req.query.url || req.body?.url || null;
  if (!url) return res.status(400).json({ error: 'url required (query ?url= or body.url)' });
  const removed = await removeFromPipelineFile(url);
  if (!removed) return res.status(404).json({ error: 'url not found in pipeline', url });
  recordActivity('pipeline.remove', { target: url });
  res.json({ ok: true, removed: 1 });
});
```

### Tests as in F-017.

---

## PR-7 · `feat(pdf): Generate PDF buttons on reports/evaluate/deep/interview-prep`

Rolls up F-015.

### Changes

1. **`server/lib/routes/runners.mjs`** — add three streaming endpoints that wrap `generate-pdf.mjs`:
   - `POST /api/pdf/report` → `{ slug }` body. Renders `reports/<slug>.md` to `output/<slug>.pdf`.
   - `POST /api/pdf/deep` → `{ company, role }` body. Renders `interview-prep/<co>-<role>.md`.
   - `POST /api/pdf/inline` → `{ markdown, filename }` body. Renders ad-hoc markdown (used by `#/evaluate` for unsaved results).

2. **Front-end** — add `📄 Generate PDF` button on:
   - `#/reports/<slug>` — single-report view, top-right.
   - `#/evaluate` — appears in the result panel after a successful evaluation.
   - `#/deep` — same pattern as evaluate.
   - `#/interview-prep` (live result view).

   Each button opens an SSE-stream modal (reuse the `#/cv` PDF modal), and on `done` triggers `<a download>` so the PDF lands in the user's Downloads folder.

3. **`common.generatePdf`** i18n key — already used on `#/cv`; propagate the same key to all four new buttons. Translate per locale.

### Tests
- `tests/pdf-routes.test.mjs` — each endpoint returns 200 with SSE events; output PDF exists at expected path; unknown slug returns 404.

---

## PR-8 · `fix(config): hide HH_USER_AGENT behind regional-sources section, conditional render`

Rolls up F-013.

### Changes

1. `/api/config` schema gains `group: 'core' | 'runtime' | 'regional'`.
2. `#/config` UI renders three groups; "Regional sources" auto-collapsed and only present if `portals.yml::russian_portals.sources` is non-empty.
3. Help section 6 moves HH_USER_AGENT into a "Regional sources" subsection.

---

## PR-9 · `docs: refresh Help, Docs, README — kill EN/RU framing project-wide`

Rolls up F-001, F-014, plus the user's explicit ask "обнови Help, Docs, ReadMe".

### Changes

1. **`README.md`** — replace the "career-ops + Russian portals" framing with the locale-agnostic adapter framing. Add headline:
> **career-ops-ui is locale-agnostic.** The scanner consumes any portal adapter; `portals.yml::russian_portals` is one example regional source — replace or extend with portals from your country.

   Replace any "EN sources" / "RU sources" wording with "ATS adapters" / "Regional portals". Re-flow the `Quickstart` to not mention "Russian portals" first; mention them as one regional example among many.

2. **`docs/architecture/OVERVIEW.md`** — same overhaul. The diagram showing `Greenhouse | Ashby | Lever` next to `hh.ru | Habr` should be redrawn as one row of adapters, no geo split.

3. **`docs/architecture/DATA-FLOWS.md`** — reflect the single `/api/stream/scan` endpoint. Drop references to `/api/stream/scan-en` / `/api/stream/scan-ru`.

4. **`web-ui/help/help.<locale>.md`** (8 files) — for each, search-and-replace:
   - "EN sweep" → "ATS-aware sweep" (and translation)
   - "RU sweep" → "regional portals" (and translation)
   - "EN scanner / RU scanner" → "ATS adapter / regional adapter"
   - "EN sources / RU sources" → "ATS adapters / regional portals"
   - "Запустите EN или RU scan" → "Запустите скан"
   - "EN: 80 · RU: hh.ru + Habr Career" → "{N} компаний · {K} порталов"
   - Section 5: rename to "Portals & sources" everywhere; clarify that Russian portals are one *example* of regional configuration.

5. **`CHANGELOG.md`** — add v1.11.0 entry summarizing PR-1..PR-9.

6. **CI gate** (already added in PR-1, repeat here for reviewers): `scripts/check-no-enru-bleed.mjs` greps the whole tree for the bleed regex.

### Tests
- `tests/docs-no-bleed.test.mjs` — read every file under `docs/`, `README.md`, `web-ui/help/*.md` and assert none match the bleed regex.

---

## PR-10 · `feat: button-by-button audit + missing UX bits`

Catch-all from items 4 and 9 of the user's checklist. Lower priority but keeps the project polished.

### Specifically

- `#/reports`: card layout currently shows 12-per-page client-side pagination. Verify it actually renders pagination controls when reports >12 (the demo stand has 0). Add an integration test against a fixture seed of 25 reports.
- `#/tracker`: filter dropdowns (Status, Score) reset paginator to page 1 — keep that contract.
- `#/activity`: filter chips by action prefix (`pipeline.`, `cv.`, `evaluate`, `scan.`) — verify each chip filters correctly. Today the activity log includes types like `tracker.add`, `pipeline.add`, `pipeline.remove` — make sure the chip whitelist matches.
- `#/dashboard`: "System status" pill (Required 8/8, Warnings 3) — wire it to `/api/health` and show a click-through to `#/health`.
- Localize every button label that's currently English-only on non-EN locales: `Doctor`, `Quick scan`, `Refresh`, `Generate prompt`, `Run live`, `Save`, `Saved`, `Search`, `Score`, `Status`, `⚡ Evaluate first`, `Active companies`, `Pipeline is empty`, `No results yet`. (The strings I observed leaking on RU/zh-TW during the regression — the canonical list lives in F-001.)

### CI gate

`scripts/check-no-en-bleed-on-non-en-locales.mjs` — render `#/dashboard`, `#/scan`, `#/tracker`, `#/activity` in jsdom on each non-EN locale; assert no token from `EN_BLEED_LIST` appears in the rendered text.

---

## PR-11 · `chore: regression cleanup leftovers from QA run`

The QA agent left some test data in the repo:

```bash
cd /Users/sergejemelanov/Projects/career-ops

# 1. Restore the demo CV (was clobbered to a 290-char stub during scenario 4 probing — F-006)
git checkout cv.md

# 2. Sweep test URLs out of pipeline (F-003 cleanup never fully ran because of F-017)
node -e '
  const fs = require("fs");
  const p = "data/pipeline.md";
  const lines = fs.readFileSync(p,"utf8").split("\n");
  const dirty = /test-cloud-|192\.168|10\.0\.0|172\.16|169\.254|0\.0\.0\.0|nip\.io/;
  fs.writeFileSync(p, lines.filter(l => !dirty.test(l)).join("\n"));
'

# 3. Remove the test tracker row left over from S9
node -e '
  const fs = require("fs");
  const p = "data/applications.md";
  const t = fs.readFileSync(p, "utf8");
  const out = t.split("\n").filter(l => !/Acme \| Co/.test(l)).join("\n");
  fs.writeFileSync(p, out);
'

# 4. Sanity rerun
curl -sf http://127.0.0.1:4317/api/health | jq .ok                    # → true
grep -E '10\.0|172\.16|192\.168|nip\.io|test-cloud-' data/pipeline.md  # → empty
grep "Acme" data/applications.md                                      # → empty
```

Bundle this as a one-time `scripts/post-qa-cleanup.mjs` script committed in PR-11 so a future QA pass can replay it.

---

# Summary of findings consolidated in this fix-prompt

| ID | Sev | Title | PR |
|---|---|---|---|
| F-001 | Minor | English tokens bleed into non-EN UI (Doctor / Quick scan / etc.) | PR-10 |
| F-002 | Major | Korean Help body falls back to English | PR-2 |
| F-003 | Major (sec) | Pipeline accepts RFC1918 / IMDS / DNS-rebind URLs | PR-3 |
| F-005 | Minor | Activity log records 400-rejected attempts | PR-5 |
| F-006 | Note | cv.md was overwritten during QA — restore via git | PR-11 |
| F-008 | Minor | profile.save not in activity log | PR-5 |
| F-009 | Minor | /api/evaluate ignores `mode:'manual'` | PR-2 |
| F-010 | Major | #/scan UI hardcodes EN/RU split | PR-1 |
| F-011 | Major | Active-companies + sources don't auto-update from scan | PR-1 |
| F-012 | Major | Mode prompts ignore selected locale | PR-2 |
| F-013 | Minor | HH_USER_AGENT exposed as top-level | PR-8 |
| F-014 | Major | Help + README hardcode EN/RU framing | PR-9 |
| F-015 | Minor | 📄 Generate PDF only on #/cv | PR-7 |
| F-016 | Major | /api/cv/import doesn't parse multipart, corrupts cv.md | PR-4 |
| F-017 | Minor | DELETE /api/pipeline shape inconsistency | PR-6 |
| F-018 | Major | Scanner has /api/stream/scan-en + scan-ru, hard-coded | PR-1 |
| F-019 | Major | PayloadTooLargeError uncaught from express.raw | PR-4 |

# Build order

1. PR-3 (security) — first
2. PR-4 (cv.md corruption) — first
3. PR-1, PR-2, PR-9 — main multi-language overhaul, ship together
4. PR-5, PR-6, PR-8 — supporting fixes
5. PR-7 — UX polish
6. PR-10 — catch-all polish
7. PR-11 — QA leftovers cleanup

# Final checks before tagging v1.11.0

```bash
npm test                   # all green
npm run test:coverage      # ≥ 80% line, ≥ 80% branch (current 93/83 — keep above)
npm run test:e2e:full      # comprehensive E2E
node scripts/portals-health-check.mjs                # all portals reachable
node scripts/check-no-enru-bleed.mjs                  # no leftover EN/RU literal
node scripts/check-no-en-bleed-on-non-en-locales.mjs  # no EN token on non-EN UI
node scripts/help-i18n-check.mjs                      # all help bundles parity
```

Tag and ship.
