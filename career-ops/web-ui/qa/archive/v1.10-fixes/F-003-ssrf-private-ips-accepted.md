# F-003 · Pipeline accepts RFC1918 / link-local / 0.0.0.0 / DNS-rebind URLs · MAJOR (security)

**Severity:** Major (SSRF surface broader than help docs claim)
**Module:** `isValidJobUrl()` in pipeline insert path; eventually exercised by `/api/pipeline/preview` proxy
**Confirmed on:** v1.10.0, http://127.0.0.1:4317/

## Repro

POST `/api/pipeline { url: <X> }` against the running stand. Expected: 400. Observed:

| URL | Expected | Observed | Notes |
|---|---|---|---|
| `http://127.0.0.1/x` | 400 | **400** ✓ | loopback IPv4 OK |
| `http://[::1]/x` | 400 | **400** ✓ | loopback IPv6 OK |
| `http://localhost/x` | 400 | **400** ✓ | hostname OK |
| `javascript:alert(1)` | 400 | **400** ✓ | scheme OK |
| `file:///etc/passwd` | 400 | **400** ✓ | scheme OK |
| `not-a-url` | 400 | **400** ✓ | format OK |
| `http://10.0.0.1/x` | 400 | **200 ❌** | RFC1918 |
| `http://172.16.0.1/x` | 400 | **200 ❌** | RFC1918 |
| `http://192.168.1.1/x` | 400 | **200 ❌** | RFC1918 |
| `http://0.0.0.0/x` | 400 | **200 ❌** | any-address (alias for loopback on Linux/macOS) |
| `http://169.254.169.254/latest/meta-data/` | 400 | **200 ❌** | **AWS IMDS — critical on cloud hosts** |
| `http://127.0.0.1.nip.io/x` | 400 | **200 ❌** | DNS-rebinding (resolves to 127.0.0.1) |

## Why this matters

The Help doc explicitly claims (section 8 Pipeline):

> Every URL passes through `isValidJobUrl()` server-side. Loopback (localhost, 127.0.0.1), `file://`, `javascript:`, **IP literals**, and strings with template chars (<, >, ") all 400.

"IP literals" suggests numeric IPs are blocked. Today only `127.0.0.1` literal is. RFC1918 + link-local + 0.0.0.0 sneak through.

Once a URL is in the pipeline, `/api/pipeline/preview` will proxy-fetch it. If the proxy uses the same validator, RFC1918 / link-local fetches succeed → SSRF on the host network. The proxy-side per-hop SSRF guard (REVIEW-B1) helps with redirects but the initial hop is gated only by `isValidJobUrl()`.

**Worst case** — if this server runs on AWS EC2 with `HOST=0.0.0.0`, an attacker who can convince the user to add a posting URL pointing to `http://169.254.169.254/latest/meta-data/iam/security-credentials/` will, on Preview click, exfiltrate IAM credentials via the SSRF-safe proxy.

## Suggested fix

Tighten `isValidJobUrl()` to reject (in addition to current rules):

```js
// pseudo — replace literal helpers
const PRIVATE_IPV4 = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,           // link-local
  /^127\./,                 // already handled but tighten the prefix
  /^0\.0\.0\.0$/,          // any-address
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
];

function isPrivateOrLoopbackHost(hostname) {
  // Numeric IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return PRIVATE_IPV4.some(rx => rx.test(hostname));
  }
  // IPv6 loopback / unique-local / link-local
  if (hostname.startsWith('[')) {
    const ip = hostname.slice(1, -1).toLowerCase();
    if (ip === '::1' || ip === '::') return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // ULA
    if (ip.startsWith('fe80')) return true; // link-local
    return false;
  }
  // Hostnames: only block exact localhost (any DNS-resolution attack still possible)
  return /^localhost$/i.test(hostname) || hostname.endsWith('.localhost');
}
```

For the DNS-rebinding case (`127.0.0.1.nip.io` resolves to 127.0.0.1), pure URL parsing can't catch it. The proxy must:
1. Resolve to IP at fetch time.
2. Re-validate the resolved IP against `PRIVATE_IPV4`.
3. Pin the connection to that IP (`fetch` with custom Agent supplying `lookup` so DNS isn't re-resolved between TLS handshake and HTTP).

## Tests to add

```js
test('isValidJobUrl rejects private IPv4 ranges', () => {
  for (const url of [
    'http://10.0.0.1/x',
    'http://172.16.0.1/x',
    'http://192.168.1.1/x',
    'http://169.254.169.254/x',
    'http://0.0.0.0/x',
  ]) {
    assert.equal(isValidJobUrl(url), false, url);
  }
});

test('preview proxy refuses post-DNS private IP', async () => {
  // mock DNS lookup to return 127.0.0.1 for an external hostname
  // assert proxy returns 400 not 200
});
```

## Cleanup needed in test data

During testing the following URLs were briefly added to `data/pipeline.md` and removed:
- 10.0.0.1, 172.16.0.1, 192.168.1.1, 169.254.169.254, 0.0.0.0, 127.0.0.1.nip.io.

DELETE happened immediately after each insert — verify `data/pipeline.md` is clean (`grep -E '10\.0|172\.16|192\.168|169\.254|0\.0\.0\.0|nip\.io' data/pipeline.md`).
