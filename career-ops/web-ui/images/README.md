# Localized dashboard screenshots

The 8 PNG files in this folder are referenced as the main hero image in
each locale's README:

| File | Used by |
|---|---|
| `dashboard-en.png` | `README.md` |
| `dashboard-ru.png` | `README.ru.md` |
| `dashboard-es.png` | `README.es.md` |
| `dashboard-pt-BR.png` | `README.pt-BR.md` |
| `dashboard-ko-KR.png` | `README.ko-KR.md` |
| `dashboard-ja.png` | `README.ja.md` |
| `dashboard-zh-CN.png` | `README.zh-CN.md` (file is named `.cn` for legacy reasons; image uses canonical `zh-CN` locale tag) |
| `dashboard-zh-TW.png` | `README.zh-TW.md` |

## Regenerate

Run from the `web-ui/` root:

```bash
# Make sure the server is running
npm start &

# Then capture all 8 screenshots
node scripts/capture-dashboard-screenshots.mjs
```

Each screenshot is a viewport-only capture (`1440×900`, devicePixelRatio 2 = HiDPI) of `#/dashboard` after switching the locale via the `[data-lang-btn]` button. Idempotent: re-runs overwrite the PNGs.

## Manual capture (fallback)

If Playwright is missing on the parent project, capture each one through the running UI:

1. Open `http://127.0.0.1:4317/#/dashboard` in your browser.
2. Click each `[data-lang-btn]` (`en`, `ru`, `es`, `pt-BR`, `ko`, `ja`, `zh-CN`, `zh-TW`) in turn.
3. Use your OS screenshot tool (Cmd+Shift+4 on macOS, PrtSc on Linux/Windows) to capture just the page area.
4. Save as `dashboard-<locale>.png` here.

Target resolution: 1440×900 viewport. PNG, no compression artifacts.
