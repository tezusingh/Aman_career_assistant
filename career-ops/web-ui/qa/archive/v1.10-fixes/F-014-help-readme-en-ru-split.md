# F-014 · Help + README hardcode the "EN-sources / RU-sources" framing · MAJOR (i18n / docs)

**Severity:** Major (the framing trickles into the UI — see F-010)
**Modules:** Help bundles (`web-ui/help/help.<locale>.md`), `README.md` at repo root

## Where it bleeds

### Help, section 7 (Scan)

> «🌐 Scan запускает все источники в одном sweep:
>   • Greenhouse / Ashby / Lever (**EN sweep**) для каждой компании в `tracked_companies`
>   • hh.ru API + Habr Career HTML для каждого query в `russian_portals`.»

> «hh.ru API + Habr Career HTML for every query in `russian_portals`.»

Same EN/RU framing in every locale bundle that ships (RU, ES, pt-BR, JA, zh-CN, zh-TW), so the bias is replicated 7×.

### Help, section 5 (`portals.yml`)

> «**EN scanner** определяет ATS по URL (job-boards.greenhouse.io/<slug> → Greenhouse) и фетчит публичные boards-api напрямую.»

The scanner that handles Greenhouse / Ashby / Lever isn't "the EN scanner" — it's "the ATS-aware scanner". It works for German, Brazilian, Korean, Japanese companies that happen to use those ATSes.

### README

(Cannot read directly without filesystem access, but per your statement it follows the same EN/RU split.)

## Fix

### 1. Replace EN/RU labels with portal-type labels

| Old | New |
|---|---|
| EN sweep | ATS-aware sweep |
| EN scanner | ATS adapter |
| EN sources | Greenhouse / Ashby / Lever / Workable / SmartRecruiters / Workday |
| RU sources / RU sweep | Regional portals: hh.ru, Habr Career (configured under `russian_portals`) |
| EN-источники | ATS-адаптеры |
| RU-источники если включены | Региональные порталы (hh.ru / Habr Career), если включены |

### 2. Help bundle keying

Even after the prose edits, every locale bundle (`help.<locale>.md`) should be a faithful translation of the same EN base. Ship a script:

```bash
# scripts/help-i18n-check.mjs
# Compares H2 / step counts / fence counts across all locale help bundles.
# CI fails if a bundle drifts (e.g. ko has 12 sections vs. en's 16 — that's how F-002 happened).
```

### 3. README

Replace the "Russian sources are second-class" framing with portal-tier framing. Also add a one-line headline:

> career-ops-ui is locale-agnostic. The scanner consumes any portal adapter; `portals.yml::russian_portals` is one example regional source — replace or extend with your country's portals.

## Tie-in

This fix lives in the same PR as F-002 (Korean help body fallback) and F-010 (scan-page EN/RU split). All three are symptoms of the same product framing.

## Test

```bash
# CI gate
grep -RIn -E '(EN|RU)-(sweep|scanner|sources|portals|источник)' web-ui/help/ README.md && exit 1
```
