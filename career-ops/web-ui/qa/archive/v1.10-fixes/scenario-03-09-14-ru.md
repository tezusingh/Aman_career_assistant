# Scenarios 3, 5, 8, 9, 14 — RU baseline

Stand: http://127.0.0.1:4317/  ·  Locale: ru  ·  v1.10.0  ·  ANTHROPIC=set, GEMINI=unset

## Scenario 3 — Profile editor (PUT /api/profile { yaml })

| Case | Expected | Observed | Status |
|---|---|---|---|
| Happy: replace `full_name: "Cloud Tester"` | 200 ok | 200 `{ok:true, bytes:2584, candidate:"Cloud Tester"}` | PASS |
| Verify GET reads back | full_name = "Cloud Tester" | matched | PASS |
| Negative: empty yaml | 400 | 400 `"yaml body required (string under \"yaml\" key)"` | PASS |
| Negative: YAML sequence (not mapping) | 400 with "mapping" hint | 400 `"profile must be a YAML mapping"` | PASS |
| Negative: missing `candidate` key | 400 with "candidate" hint | 400 `"profile.candidate is required"` | PASS |
| Restore original | 200 | 200 `{ok:true, bytes:2582, candidate:"Jane Smith"}` | PASS |

**Verdict: PASS.**

## Scenario 5 — CV save with XSS strip (PUT /api/cv { markdown })

Payload sent: `# Cloud Tester CV` + `<script>__cloud_pwn=1</script>` + `[malicious](javascript:alert(1))` + `<iframe src="evil">` + `<img onerror="alert(1)" src="x">` + `## Summary` + `Senior backend engineer.`

| Assertion | Observed |
|---|---|
| `sanitized: true` returned | ✓ |
| Title `# Cloud Tester CV` survives in cv.md | ✓ |
| Body text "Senior backend engineer" survives | ✓ |
| `<script>` tag stripped | ✓ |
| `__cloud_pwn` token stripped | ✓ |
| `javascript:` URI stripped | ✓ |
| `<iframe>` tag stripped | ✓ |
| `onerror=` handler stripped | ✓ |

**Verdict: PASS.**

## Scenario 8 — Pipeline insert + URL validation

| URL | Expected | Observed | Status |
|---|---|---|---|
| greenhouse JD URL (random suffix) | 200, `deduped:false` | 200, deduped:false | PASS |
| same URL repeated | 200, `deduped:true` (or "deduped" toast) | 200, deduped:true | PASS |
| `javascript:alert(1)` | 400 | 400 "invalid url (must be http/https…)" | PASS |
| `http://127.0.0.1/x` | 400 | 400 | PASS |
| `not-a-url` | 400 | 400 | PASS |
| `file:///etc/passwd` | 400 | 400 | PASS bonus |
| **`http://10.0.0.1/x`** | **400** | **200** | **FAIL — F-003** |
| **`http://172.16.0.1/x`** | **400** | **200** | **FAIL — F-003** |
| **`http://192.168.1.1/x`** | **400** | **200** | **FAIL — F-003** |
| **`http://0.0.0.0/x`** | **400** | **200** | **FAIL — F-003** |
| **`http://169.254.169.254/…/iam/`** | **400** | **200** | **FAIL — F-003 (AWS IMDS)** |
| **`http://127.0.0.1.nip.io/x`** | **400** | **200** | **FAIL — F-003 (DNS-rebind)** |
| `http://[::1]/x` | 400 | 400 | PASS |
| `http://localhost/x` | 400 | 400 | PASS |

**Verdict: PARTIAL PASS — happy + dedup + 5/12 reject cases pass; 6 RFC1918 / link-local / 0.0.0.0 / DNS-rebind / IMDS bypasses logged as F-003.**

## Scenario 9 — Tracker BF-1 pipe + newline round-trip (POST /api/tracker)

Submitted: `company="Acme | Co", role="Senior Backend\nEngineer", score=4.2, status="Evaluated", notes="Cloud regression test BF-1"`

| Assertion | Observed | Status |
|---|---|---|
| Row inserted (`status:200`) | 200 | PASS |
| Reload via GET /api/tracker | row visible, total rows = 1 | PASS |
| Pipe survives round-trip | `company === "Acme \| Co"` (intact, table not split) | PASS |
| Newline normalized in role | `role === "Senior Backend Engineer"` (newline → space — **expected** per BF-1 escape rules) | PASS |
| Score format | `"4.2/5"` | PASS |
| Status whitelist | `"Evaluated"` (default since enum) | PASS |
| Notes preserved | `"Cloud regression test BF-1"` | PASS |

**Verdict: PASS — BF-1 regression NOT recurring.**

## Scenario 14 — Activity log audit (GET /api/activity)

After running 3, 5, 8, 9 above:

| Action | Count | Status |
|---|---|---|
| `cv.save` | 2 | PASS |
| `pipeline.add` | 9 | PASS (but see F-005 below) |
| `pipeline.remove` | 3 | bonus |
| `tracker.add` | 2 | PASS |
| `profile.save` | **0 ❌** | **NOT RECORDED** despite multiple PUT /api/profile calls — possible F-008 |

ISO timestamps present (e.g. `2026-05-08T20:10:36`). Tail entry shape: `{ action, target, timestamp }`.

**Verdict: PARTIAL PASS — 3 of 4 expected action types logged; profile saves apparently missing from activity log.**

## Summary

- 3 PASS, 5 PASS, 9 PASS — clean wins.
- 8 PARTIAL — 6 SSRF bypasses (F-003).
- 14 PARTIAL — profile.save action missing (probable F-008).
- Bonus finding: 400-rejected URLs still write to activity log (F-005).

CV.md was clobbered during scenario 4 probing (F-006) — restore via `git checkout cv.md` in `/Users/sergejemelanov/Projects/career-ops/`.
