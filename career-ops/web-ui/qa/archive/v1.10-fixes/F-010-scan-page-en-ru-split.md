# F-010 · `#/scan` UI hardcodes "EN" / "RU" split — kill it for a multi-language project · MAJOR (UX)

**Severity:** Major (UX — breaks the multi-language premise of the product)
**Module:** `web-ui/public/js/views/scan.js` (or whatever renders `#/scan`); also string bundles for every locale
**Locales affected:** all 8 — currently the app pretends there are only "English boards" and "Russian boards"

## What's on the page today (verified at runtime)

`#/scan` (RU locale snapshot, but text is the same on every locale because the strings aren't keyed):

```
EN: 80 · RU: hh.ru + Habr Career      ← header summary
Компания (для EN, опционально)         ← company filter caption
все источники                          ← source dropdown label
  Greenhouse
  Ashby
  Lever
  hh.ru        ← RU-specific
  Habr         ← RU-specific
Запустите EN или RU scan выше — после завершения таблица появится здесь.
                                       ← empty-state caption
▸ Активные компании 96/80              ← collapsible section header
```

Phrase hits found by literal search (just on the RU rendering): `EN: 80`, `RU: hh.ru`, `для EN`, `EN или RU`, `RU scan`, `Запустите EN`, `(для EN`. None of these are i18n-keyed — they're literal strings in the markup.

## Why this matters

The product ships in 8 locales (en, ru, es, pt-BR, ko, ja, zh-CN, zh-TW). A Spanish user opening `#/scan` shouldn't see:
- `(для EN, опционально)` — Russian bleed
- `EN или RU scan` — meaningless geo-binary
- `Greenhouse / Ashby / Lever / hh.ru / Habr` — a regional checklist that pretends only Russia + the US ATSes exist

The split is also factually wrong: Greenhouse / Ashby / Lever serve EU companies (HelloFresh, N26, DeepL — already in the tracked list), and `hh.ru` / `Habr Career` are not "the RU sweep" — they're two specific portals out of dozens that exist in CIS / EE / EU job markets.

## Three concrete things to fix

### 1. Header summary — replace geo-coded count with a portal-agnostic count

```diff
- EN: 80 · RU: hh.ru + Habr Career
+ {{i18n.scan.summary}}
+ // RU bundle: "80 компаний · 2 портала"
+ // EN bundle: "80 companies · 2 portals"
+ // ES/PT-BR/JA/KO/zh-CN/zh-TW: same pattern, locale-keyed
```

Drive numbers from `/api/portals`: `tracked_companies.filter(c => c.enabled).length` and `portals.length`.

### 2. Empty-state caption — replace the EN-or-RU instruction

User-reported phrase to specifically replace:

> «Нет результатов. Запустите **EN или RU** scan выше — после завершения таблица появится здесь.»

→

> «Нет результатов. Запустите скан выше — после завершения таблица появится здесь.»

EN equivalent: «No results yet. Run a scan above — results land here once it finishes.»

### 3. Source dropdown — drop the geo-binary, show the actual portal list

`все источники` → list every portal known to the scanner, ordered alphabetically and i18n-keyed if needed. Today it shows literally:

```
все источники / Greenhouse / Ashby / Lever / hh.ru / Habr
```

The fix is: pull the source list from `portals.yml::all_sources` (or build it from `tracked_companies[].api` patterns + `russian_portals.sources`), and label each source by its proper name without prepending an EN / RU tag.

### 4. Company filter caption

```diff
- Компания (для EN, опционально)
+ Компания (опционально)
```

EN: `Company (optional)`. The "for EN" qualifier was lying anyway — companies are filtered regardless of which sources you include in the scan.

## i18n bundle work

Each of the 8 locale bundles (`web-ui/i18n/<locale>.json` or wherever they live) needs the new keys:

```json
{
  "scan.summary": "{count} companies · {portals} portals",
  "scan.companyFilterLabel": "Company (optional)",
  "scan.allSources": "All sources",
  "scan.emptyState": "No results yet. Run a scan above — results land here once it finishes.",
  "scan.activeCompaniesHeader": "Active companies — {enabled}/{total}"
}
```

Translate naturally for each locale; preserve the `{placeholder}` tokens.

## Test

```js
test('scan page never contains hardcoded EN or RU literals', async () => {
  const html = await fetch('http://127.0.0.1:4317/').then(r => r.text());
  // load /#/scan in jsdom, render, assert
  for (const phrase of ['EN: ', 'RU: ', 'для EN', 'для RU', 'EN или RU', 'EN scan', 'RU scan']) {
    assert.equal(scanRenderedHtml.includes(phrase), false, phrase);
  }
});
```

Add a snapshot test that renders `#/scan` in each locale and asserts no English bleed in non-EN bundles.
