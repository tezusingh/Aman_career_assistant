# F-002 · Korean (ko) Help body falls back to English · MAJOR

**Severity:** Major (locale broken on key documentation page)
**Locale affected:** ko (Japanese, zh-CN, zh-TW all OK — so it's ko-specific)
**Module:** `#/help` rendering when locale = `ko`

## Repro

1. Open `http://127.0.0.1:4317/#/dashboard`
2. Click `[data-lang-btn="ko"]` (the "ko" sidebar button)
3. Verify dashboard is in Korean — `커맨드 센터` etc. ✓
4. Navigate to `#/help`

## Observed

- `<h1>` = `도움말` ✓ (localized)
- TOC heading `이 페이지에서` ✓ (localized)
- TOC items 1-16: **English** (e.g. `1. Quick start — full step-by-step from "create CV" to "applied & messaged"`)
- Body H2/H3 sections: **English** (`A. Setup (do these once, ~5 minutes)` etc.)
- All 21 walkthrough steps: **English** (`Step 1 — Open the app at...`)
- Trailing troubleshooting table: **English**

For comparison ja, zh-CN, zh-TW all render the body correctly localized.

## Likely cause

The Help page loads its body from a per-locale markdown bundle. Pattern looks like:

```
web-ui/help/help.<locale>.md
  help.ru.md
  help.en.md
  help.es.md
  help.pt-BR.md
  help.ja.md
  help.zh-CN.md
  help.zh-TW.md
  ←  help.ko.md  is missing or empty → falls back to EN
```

Or a server route like `GET /api/help?lang=ko` is mapped from a locale-specific file path that resolves to the EN file when the ko bundle isn't present.

## Investigation steps

```bash
# Find which file the route reads
grep -RIn "help" server/ | grep -Ei "lang|locale|\.md"
ls -la web-ui/help/ web-ui/i18n/ 2>/dev/null

# If file exists, check it isn't actually English
file web-ui/help/help.ko.md 2>/dev/null
head -50 web-ui/help/help.ko.md 2>/dev/null

# If file doesn't exist, the bundle for ko is just missing
```

## Suggested fix

If the file is missing → add `web-ui/help/help.ko.md` translated from `help.en.md` (mirror existing structure: 16 H2 sections, 21 walkthrough steps `1.`–`21.` under section 1). Preserve every code block (`portals.yml`, env keys table, troubleshooting table) verbatim — those rows aren't strings to translate but configuration the user copies.

If the file exists but is empty or stale → re-export from EN source and translate the 16 sections, leaving fenced code blocks untouched.

If the route does locale lookup → also add a server-side guard so a missing bundle returns a clear `503 i18n bundle missing` to make this regression detectable in CI:

```js
// server/help.mjs (illustrative)
const want = path.join(HELP_DIR, `help.${lang}.md`);
if (!fs.existsSync(want)) {
  console.warn(`[help] locale ${lang} bundle missing — falling back to EN`);
  // existing fallback…
}
```

…then add a unit test that asserts every locale in `LOCALES` has a non-empty bundle.

## Why MAJOR not minor

Help is the canonical onboarding page. Korean users hitting this page see English docs while the rest of the UI is Korean — a "this app isn't actually localized" first impression that contradicts the otherwise solid ko translation everywhere else.
