# F-005 · Activity log records URLs that 400'd — audit-trail noise · MINOR

**Severity:** Minor (correctness / docs alignment)
**Module:** `data/activity.jsonl` writes for `pipeline.add`

## Repro

```js
// Pipeline insert that should be rejected
await fetch('/api/pipeline', { method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ url: 'javascript:alert(1)' }) });
// → 400 invalid url

// But:
await fetch('/api/activity').then(r => r.json())
// .events tail contains:
// { action: "pipeline.add", target: "javascript:alert(1)", timestamp: "..." }
```

## Why this matters

The Help (section 16) describes the activity log as:

> Audit trail of every **state-changing** request hitting the server.

A 400-rejected POST is not a state change — `data/pipeline.md` was not modified. Two concerns:

1. **Audit signal pollution** — operators looking for "what was added" see attempts that didn't take effect.
2. **Spam vector** — an attacker who can hit the API can grow `data/activity.jsonl` arbitrarily large by spamming bad URLs at line speed.

## Suggested fix

In the route handler, only call the activity recorder *after* validation succeeds:

```js
// server/routes/pipeline.mjs (illustrative)
app.post('/api/pipeline', (req, res) => {
  if (!isValidJobUrl(req.body.url)) {
    return res.status(400).json({ error: 'invalid url …' });
    // ↑ no activity record
  }
  appendToPipeline(req.body.url);
  recordActivity('pipeline.add', { target: req.body.url });  // moved here
  res.json({ ok: true, deduped: false, urls: … });
});
```

Same pattern for `/api/cv` save (sanitize-and-then-record), `/api/tracker` add (whitelist-and-then-record), `/api/profile` save (validate-and-then-record).

## Test

```js
test('activity log skips rejected pipeline adds', async () => {
  const before = (await fetch('/api/activity').then(r=>r.json())).events.length;
  await fetch('/api/pipeline', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ url: 'not-a-url' }) });
  const after = (await fetch('/api/activity').then(r=>r.json())).events.length;
  assert.equal(after, before);  // no new event
});
```
