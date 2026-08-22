# F-012 · `⚡ Run live` / `Generate prompt` ignore the selected UI locale · MAJOR (UX)

**Severity:** Major (the entire LLM output reaches the user in EN regardless of UI locale)
**Module:** `server/lib/routes/llm.mjs` (mode + apply-helper + deep + evaluate); `modes/<slug>.md` templates

## Repro (executed against live stand)

```js
// Three runs against /api/mode/project — UI was on RU, ES, JA respectively
for (const lang of ['ru','es','ja']) {
  await fetch('/api/mode/project', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Accept-Language': lang },
    body: JSON.stringify({ idea: 'rate limiter library', target: 'Staff SRE', lang, locale: lang })
  });
}
```

All three returned an identical 1449-character prompt that begins:

> `You are career-ops in project mode.\n\nRead these files first (they exist in the project root):\n  • cv.md\n  • config/profile.yml\n  …`

No locale information propagates to the LLM. Searched for any "respond in", "answer in", "на русском", "in spanish", "in japanese" — `false` on all three. The Anthropic / Gemini call therefore returns its default English response no matter what UI language the user is on.

## Why this matters

A Spanish speaker on `#/training` clicking `⚡ Запустить вживую` (button label is in their UI locale) gets back a fully English curriculum. UX promise vs. delivery mismatch — and unhelpful for users who don't read English well.

## Fix

### 1. Server: thread locale through the request → prompt

```js
// server/lib/routes/llm.mjs
function buildPrompt({ slug, form, lang }) {
  const tpl = readModeTemplate(slug);                     // existing
  const ctx = bundleProjectContext({ cv, profile });      // existing
  const langDirective = lang && lang !== 'en'
    ? `\n\n# Output language\nRespond in ${LOCALE_NAMES[lang]} (locale: ${lang}). Keep code/identifiers/keywords in English; translate everything else.\n`
    : '';
  return `You are career-ops in ${slug} mode.${langDirective}\n\nRead these files first…\n${ctx}\n\n${tpl}\n\n${userBlock}`;
}

const LOCALE_NAMES = {
  ru: 'Russian', es: 'Spanish', 'pt-BR': 'Brazilian Portuguese',
  ko: 'Korean', ja: 'Japanese', 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese'
};

app.post('/api/mode/:slug', (req, res) => {
  const lang = req.body.lang || req.body.locale || (req.headers['accept-language']||'').split(',')[0]?.split('-')[0] || 'en';
  // …
  const prompt = buildPrompt({ slug, form: req.body, lang });
  return res.json({ slug, mode: keyPresent ? 'live' : 'manual', lang, prompt });
});
```

Apply the same change to `/api/evaluate`, `/api/deep`, `/api/apply-helper`.

### 2. Client: send `Accept-Language` and a `lang` body field on every prompt request

```js
// public/js/api.js
function postMode(slug, form) {
  const lang = currentLocale();   // already exists for UI rendering
  return fetch(`/api/mode/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': lang },
    body: JSON.stringify({ ...form, lang })
  }).then(r => r.json());
}
```

### 3. Mode templates that contain English fixed instructions

`modes/oferta.md`, `modes/deep.md`, `modes/<slug>.md` open with English structural cues like *"A. Role Summary — 3 bullet points"*. The model usually mirrors the section headers from the template. Two options:

- **Cheap:** keep templates English, rely on the `Output language` directive — works ~90% of the time but final report headers may stay English.
- **Right:** ship `modes/<slug>.<locale>.md` translations and load by locale. Reuses the F-002 / F-014 i18n bundle pattern.

I'd ship the cheap fix first (one-line directive) and fold the locale-keyed mode templates into the same task that fixes F-002 (Korean help bundle) and F-014 (README localization).

## Test

```js
test('mode prompt embeds Russian output directive when lang=ru', async () => {
  const r = await fetch('http://127.0.0.1:4317/api/mode/project', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea: 'x', target: 'y', lang: 'ru' })
  });
  const j = await r.json();
  assert.match(j.prompt, /Respond in Russian|на русском/i);
});
```
