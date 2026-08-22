---
description: Give a 90-second tour of the career-ops-ui codebase for an agent joining fresh.
---

Walk through the repo in this order, ONE sentence per item:

1. Stack — Node 18+, Express 4, vanilla SPA, no build step, no TS.
2. Server entry — `server/index.mjs` (createApp factory + ~50 routes).
3. Server lib — list `server/lib/*.mjs` with a one-line purpose each.
4. Client entry — `public/index.html` → `public/js/app.js` → `public/js/router.js`.
5. Views — `public/js/views/*.js`, one per route.
6. Tests — `node --test tests/*.test.mjs`, in-process via `createApp()`.
7. Parent integration — `paths.mjs::resolveProjectRoot()` finds the parent career-ops; this UI reads/writes via `PATHS.*`.
8. Streaming — `/api/stream/*` endpoints emit SSE for long-running scans / PDF generation.
9. Hard rules — never edit outside `web-ui/`, never log secrets, never relax CSP.
10. Where to start — `docs/architecture/OVERVIEW.md`.

Output as a numbered list. Under 250 words.
