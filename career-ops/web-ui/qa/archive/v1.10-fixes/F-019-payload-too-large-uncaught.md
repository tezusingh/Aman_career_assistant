# F-019 · `PayloadTooLargeError` from `express.raw` parser surfaces unhandled · MAJOR

**Severity:** Major (server-side error, no JSON body to client, cousin of F-016)
**Module:** body-parser middleware on `/api/cv/import` (and any other route using `express.raw({ limit })`)

## Evidence (server log, captured during regression)

```
PayloadTooLargeError: request entity too large
    at readStream (.../node_modules/raw-body/index.js:163:17)
    at getRawBody (.../node_modules/raw-body/index.js:116:12)
    at read (.../node_modules/body-parser/lib/read.js:79:3)
    at rawParser (.../node_modules/body-parser/lib/types/raw.js:81:5)
    at Layer.handle [as handle_request] (.../express/lib/router/layer.js:95:5)
    at next (.../express/lib/router/route.js:149:13)
    at Route.dispatch (.../express/lib/router/route.js:119:3)
    …
```

Three identical traces logged sequentially — corresponding to the three 11-MB upload attempts I made during scenario 4g.

## What this confirms (root cause for F-016)

The `/api/cv/import` route is wired through `express.raw({ type: '*/*', limit: '10mb' })` — it reads the entire request body into a Buffer regardless of content-type. That's why:

1. A `multipart/form-data` POST with a small `.md` blob produces a 200 with the raw multipart wire body persisted as `cv.md` (F-016).
2. An 11-MB upload throws `PayloadTooLargeError` at the parser layer, *before* the route handler ever runs — Express has no per-route error handler that converts this into a structured 413 JSON.

The client today sees the default Express HTML error page (or empty body, depending on how the front-end handles it). The Help docs §4 promise:

> Hard cap: **10 MB** per upload. Larger files → 413.

The error code is correct, but the response body isn't the friendly `{ error: "too large" }` users get from other endpoints (e.g. `/api/cv` PUT cap is enforced inline and returns proper JSON).

## Combined fix (rolls up F-016 + F-019)

### 1. Replace `express.raw` with proper multipart parsing

```js
// server/lib/routes/content.mjs (illustrative)
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

app.post('/api/cv/import',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'multipart "file" field required' });
      const { originalname, buffer } = req.file;
      const ext = path.extname(originalname).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) return res.status(415).json({ error: `unsupported format "${ext}"` });
      const md = await convertToMarkdown({ ext, buffer });
      const sanitized = stripDangerousMarkdown(md);
      await atomicWrite(PATHS.cv, sanitized.text);
      res.json({ ok: true, sanitized: sanitized.changed, via: convertersUsed[ext], bytes: Buffer.byteLength(sanitized.text), markdown: sanitized.text });
    } catch (err) { next(err); }
  }
);
```

### 2. Convert multer / body-parser errors into structured JSON

```js
// server/index.mjs — global error handler, mounted LAST
app.use((err, req, res, next) => {
  // multer-specific
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file too large (max 10 MB)', limit: '10mb' });
  }
  // body-parser raw
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'request body too large', limit: err.limit, length: err.length });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'malformed request body' });
  }
  // catch-all
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'internal server error' });
});
```

### 3. Front-end shows the limit nicely

```js
// public/js/views/cv.js
async function uploadCv(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/cv/import', { method: 'POST', body: fd });
  if (r.status === 413) {
    const j = await r.json().catch(() => ({}));
    toast(`Файл слишком большой (>10 МБ). ${j.length ? 'Размер: ' + (j.length / 1024 / 1024).toFixed(1) + ' МБ' : ''}`);
    return;
  }
  // …
}
```

Localize the toast through the same i18n bundle.

## Tests

```js
test('413 returns structured JSON, not Express HTML', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(11*1024*1024)], { type: 'text/plain' }), 'huge.txt');
  const r = await fetch('/api/cv/import', { method:'POST', body: fd });
  assert.equal(r.status, 413);
  const j = await r.json();
  assert.match(j.error, /too large/i);
  assert.equal(j.limit, '10mb');
});

test('multer error handler produces 413 (not unhandled stack trace)', async () => {
  // monkey-patch app to capture error events; the request should resolve, server should not throw
});
```

## Side note: silent CV corruption (already covered in F-016)

Once F-016's multer fix lands, the multipart-bytes-as-cv.md path closes. Same fix kills both tickets. Recommend bundling F-016 + F-019 in one PR titled "fix: parse cv upload as multipart, return structured 413/415/422".
