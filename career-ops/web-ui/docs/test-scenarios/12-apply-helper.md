# 12 — Apply checklist

## Goal

User pastes a job URL on `#/apply`, optionally a JD excerpt. Server returns a 7-step checklist that always ends with **"NEVER auto-submit — you (the human) click the final button."**

## Inputs

`POST /api/apply-helper { url, jd? }`.

## Expected outputs

- `200 { checklist: "<multi-line text>", message }`.
- Checklist contains the strings `career-ops apply` and `NEVER auto-submit`.
- JD excerpt, if provided, is appended (truncated to 600 chars).

## Negative cases

| Case | Expected |
|---|---|
| Missing `url` | `400 { error: "url required" }` |
| Anything else | Always 200 — pure string-template renderer |
