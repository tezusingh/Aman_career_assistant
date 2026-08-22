# Scenario 1 (Smoke Navigation) + Scenario 15 (Help) × 8 locales

| Locale | Dashboard h1 | Help h1 | Help body | TOC items | Walkthrough steps | Verdict |
|---|---|---|---|---|---|---|
| ru | Командный центр | Справка | RU | RU | 21 (Шаг 1…21) | PASS |
| en | Command Center | Help | EN | EN | 21 (Step 1…21) | PASS |
| es | Centro de Comando | Ayuda | ES | ES | 21 (1…21 nested) | PASS |
| pt-BR | Centro de Comando | Ajuda | pt-BR | pt-BR | 21 (1…21 nested) | PASS |
| **ko** | **커맨드 센터** | **도움말** | **EN ❌** | **EN ❌** | **EN ❌** | **FAIL — F-002** |
| ja | コマンドセンター | ヘルプ | JA | JA | 21 (1…21 nested) | PASS |
| zh-CN | 指挥中心 | 帮助 | zh-CN | zh-CN | 21 (1…21 nested) | PASS |
| zh-TW | 指揮中心 | 說明 | zh-TW | zh-TW | 21 (1…21 nested) | PASS |

**Routes verified per locale (21 each + back-compat /#/settings → Profile):** all 21 hash routes resolved; `#/settings` correctly renders Profile view in every locale.

**Console errors:** none captured.

**Findings:**
- F-001 (minor) — i18n bleed: `Doctor`, `Quick scan` (header), `Outreach`, `CV`, `Health`, `Follow-up`, `Deep research` (sidebar) stay English on RU. Likely also on other non-EN locales — quick to verify by re-screenshotting sidebar per locale. Cosmetic.
- F-002 (major) — `ko` Help body + TOC + walkthrough fall back to English while page chrome (h1, TOC heading) is Korean.

**Verdict:** Scenario 1 (nav routing) is PASS on 8/8 locales. Scenario 15 (help) is PASS on 7/8 locales, FAIL on `ko` (see F-002).
