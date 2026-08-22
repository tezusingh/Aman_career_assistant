# F-017 · `DELETE /api/pipeline` requires `?url=` query, ignores JSON body · MINOR

**Severity:** Minor (API surface inconsistency)
**Module:** `server/lib/routes/pipeline.mjs`

## Repro

These two calls superficially look interchangeable. They aren't:

```js
// Form A — DELETE with JSON body
fetch('/api/pipeline', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'http://192.168.1.1/x' })
});
// → 200 ok, but pipeline still contains the URL

// Form B — DELETE with ?url= query string
fetch('/api/pipeline?url=' + encodeURIComponent('http://192.168.1.1/x'), {
  method: 'DELETE'
});
// → 200 ok, URL actually removed
```

Form A returns `{ ok: true }` even though it didn't remove anything. The handler reads `req.query.url` and silently ignores `req.body.url`. Cleanup tooling that follows the more REST-y "DELETE with body" convention will run, log success, and leave the data unchanged.

## Why this matters

It looks like correctness — the response says success, the operation happened. Two real consequences:

1. **Test cleanup hides finding F-003** — during this regression, every "evil" URL the SSRF probe pushed in (10.x, 172.16.x, 192.168.x, link-local, IMDS, nip.io) was supposed to be deleted in a `finally` block. Form A was used. None of those URLs were actually removed. The pipeline grew to 1236 entries and contained dangerous probe URLs alongside legitimate scan results.
2. **Scripted automation breaks silently** — anyone wrapping a cleanup script around `DELETE /api/pipeline` will believe their cleanup worked.

## Fix — accept both shapes

```js
// server/lib/routes/pipeline.mjs
app.delete('/api/pipeline', async (req, res) => {
  const url = req.query.url || req.body?.url || null;
  if (!url) return res.status(400).json({ error: 'url required (query ?url= or body.url)' });
  const removed = await removeFromPipeline(url);
  if (!removed) return res.status(404).json({ error: 'url not found in pipeline', url });
  recordActivity('pipeline.remove', { target: url });
  res.json({ ok: true, removed });
});
```

Two changes vs today:
- Reads from query OR body.
- Returns 404 when the URL wasn't actually present (instead of "200 ok, but didn't do anything").

## Test

```js
test('DELETE /api/pipeline with body removes', async () => {
  await fetch('/api/pipeline', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url:'https://example.com/x'}) });
  const r = await fetch('/api/pipeline', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url:'https://example.com/x'}) });
  assert.equal(r.status, 200);
  const after = await fetch('/api/pipeline').then(r => r.json());
  assert.equal(after.urls.includes('https://example.com/x'), false);
});

test('DELETE /api/pipeline with no url returns 400', async () => {
  const r = await fetch('/api/pipeline', { method:'DELETE' });
  assert.equal(r.status, 400);
});

test('DELETE /api/pipeline with missing url returns 404', async () => {
  const r = await fetch('/api/pipeline?url=https://does-not-exist.test/x', { method:'DELETE' });
  assert.equal(r.status, 404);
});
```
