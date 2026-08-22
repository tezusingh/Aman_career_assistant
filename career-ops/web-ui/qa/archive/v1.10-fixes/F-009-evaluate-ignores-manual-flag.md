# F-009 · /api/evaluate ignores `mode: 'manual'` flag · MINOR

**Severity:** Minor (UX / parity gap)
**Module:** `POST /api/evaluate` route
**Confirmed on:** v1.10.0

## Repro

```js
// Stand: ANTHROPIC_API_KEY is set in .env
fetch('/api/evaluate', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ jd: 'Senior Backend Engineer at TestCo. PHP+Go.', mode: 'manual' })
})
```

Observed: the request hangs while the server makes the live Anthropic call. There is no opt-out short-circuit for the client.

## Why this matters

The other prompt routes accept `mode: 'manual'` and return a copy-pasteable prompt without spending API credits:

- `POST /api/deep { company, role, mode: 'manual' }` → returns `{ mode: 'manual', prompt, message }`
- `POST /api/mode/<slug>` → all seven mode pages already return manual prompt by default

Evaluate is the only one of the four prompt-builder surfaces (`evaluate`, `deep`, `apply-helper`, `mode/*`) that doesn't honor the flag. Side effects:

1. **Cost surprise** — a user testing an evaluate flow burns one Sonnet 4.6 call (~$0.30) on every click.
2. **Long blocking call** — UI freezes for 1-3 minutes; the spinner has to be cancelled by navigating away.
3. **CI flakiness** — any test of `/api/evaluate` against a stand that has the API key set will timeout.
4. **Documentation contradicts the implementation** — Help (section 9) says: *"3. Manual — no key set. The page returns a fully-formed prompt you can paste into Claude Code…"*. The current implementation gates "manual" on `!ANTHROPIC_API_KEY && !GEMINI_API_KEY`, not on a client request flag.

## Suggested fix

In `server/lib/routes/llm.mjs` (or wherever the evaluate route lives), respect a client-supplied flag before falling into the key check:

```js
// pseudocode
app.post('/api/evaluate', async (req, res) => {
  const { jd, mode, save = false } = req.body;
  if (!jd) return res.status(400).json({ error: 'jd required' });

  // NEW: honor explicit manual request
  if (mode === 'manual') {
    return res.json({ mode: 'manual', prompt: buildOfertaPrompt(jd), message: 'Paste this into Claude Code or any LLM.' });
  }

  // existing key-detection chain follows…
});
```

Mirror the pattern from `/api/deep`. Add a unit test:

```js
test('POST /api/evaluate honors mode:manual even when key is set', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-test-fake';
  const r = await fetch(URL + '/api/evaluate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jd: 'Test JD', mode: 'manual' })
  });
  const j = await r.json();
  assert.equal(j.mode, 'manual');
  assert.match(j.prompt, /career-ops/i);
});
```
