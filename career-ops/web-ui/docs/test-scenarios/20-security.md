# 20 — Security

## Goal

Routes that fetch user-supplied URLs reject every private-network destination. The SPA shell ships strict security headers. CV / JD ingress is sanitized server-side.

## SSRF surface

`isValidJobUrl(input)` rejects (v1.10.1 hardening, PR-3):

- Non-http/https schemes (`javascript:`, `data:`, `file:`, `ftp:`, `vbscript:`).
- Template chars `< > " ' \` \\` in the URL string.
- Lengths < 10 or > 2000.
- Hostnames in any of:
  - RFC1918 IPv4: `10/8`, `172.16/12`, `192.168/16`.
  - Entire `127/8` loopback range.
  - Link-local `169.254/16` — covers AWS IMDS `169.254.169.254`.
  - `0.0.0.0` and `100.64/10` (CGNAT).
  - IPv6 `::1`, `::`, ULA `fc00::/7`, link-local `fe80::/10`.
  - `localhost`, `*.localhost`.

## DNS-rebind defense

`/api/pipeline/preview` calls `dns.lookup(host, { verbatim: true })` on every redirect hop. If the resolved IP is private (per `isPrivateOrLoopbackHost`), the request is blocked with `{ status: 0, text: "(blocked: host resolves to private address)" }`. DNS lookup failure fails OPEN so test stubs / DNS-less sandboxes don't false-positive.

## Security headers (server/index.mjs)

- `Content-Security-Policy` — script-src self, no `'unsafe-inline'`, no `'unsafe-eval'`, frame-ancestors `'none'`.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- `Referrer-Policy: same-origin`.

## Sanitizers

- `stripDangerousMarkdown` — applied to every CV / JD ingress. Strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>`, `<svg>`, on*= handlers, `javascript:`, `vbscript:`, `data:text/html`.
- `sanitizeJobDescription` — applied to JD before assembling LLM prompts. Removes ANSI escapes, null bytes, `<script>`. 50 KB cap.

## Test coverage

- `tests/security-headers.test.mjs` — every header present + values pinned.
- `tests/url-validation.test.mjs` — every reject path incl. the v1.10.1 RFC1918 / link-local / IPv6 set.
- `tests/critical-fixes.test.mjs` — DNS-rebind defense via `127.0.0.1.nip.io`; `isPrivateOrLoopbackHost` unit tests for every range.
- `tests/cv-xss.test.mjs` — every dangerous CV pattern stripped.
- `tests/jd-sanitize.test.mjs` — JD ingress.
