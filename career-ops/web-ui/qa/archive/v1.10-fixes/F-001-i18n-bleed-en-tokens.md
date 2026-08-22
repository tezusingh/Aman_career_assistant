# F-001 · i18n: English tokens bleed into RU UI · MINOR

**Severity:** Minor (cosmetic, no functional break)
**Locale affected:** ru (likely also es, pt-BR, ja, ko, zh-CN, zh-TW — to verify)
**Module:** sidebar nav + page titles + global header buttons

## Repro

1. Open `http://127.0.0.1:4317/`
2. Click language button `[data-lang-btn="ru"]` (or whatever ref the sidebar exposes — ours was ref_58)
3. Observe sidebar + header

## Strings that should be localized but stay English on RU

Sidebar items still EN:
- `Outreach` (route `#/contacto`) — should be e.g. «Аутрич» / «LinkedIn outreach» (matches body title)
- `CV` (route `#/cv`) — proper noun, arguable, but body says «CV» too
- `Health` (route `#/health`) — should be e.g. «Здоровье» / «Диагностика»
- `Follow-up` (route `#/followup`)
- `Deep research` (route `#/deep`)

Header chrome (always visible):
- `Doctor` button (top-right next to search)
- `Quick scan` button (primary CTA)

Page titles (h1.page-title):
- `/#/pipeline` → "Pipeline" (proper noun, OK)
- `/#/deep` → "Deep research"
- `/#/contacto` → "LinkedIn outreach"
- `/#/health` → "Health"

## Suggested fix

Add the missing keys to the i18n bundles. Example for `web-ui/i18n/ru.json` (paths assumed):

```json
{
  "sidebar.outreach": "Аутрич",
  "sidebar.health": "Диагностика",
  "sidebar.followup": "Follow-up",
  "sidebar.deep": "Глубокий ресёрч",
  "sidebar.cv": "Резюме",
  "header.doctor": "Доктор",
  "header.quick_scan": "Быстрый скан",
  "page.pipeline.title": "Очередь",
  "page.deep.title": "Глубокий ресёрч",
  "page.contacto.title": "LinkedIn-аутрич",
  "page.health.title": "Диагностика"
}
```

And mirror into `es.json`, `pt-BR.json`, `ja.json`, `ko.json`, `zh-CN.json`, `zh-TW.json`. If the strings live in JS (e.g. `web-ui/js/i18n.js`), grep for the EN literal first:

```bash
grep -RIn "Health\|Outreach\|Follow-up\|Deep research\|Quick scan\|Doctor" web-ui/js/ web-ui/i18n/
```

## Why minor

Routes still resolve, page titles still render, scoring/profile/CV flows work in any locale. This is purely visual brand consistency.
