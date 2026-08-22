# F-016 · `POST /api/cv/import` accepts multipart but stores raw wire body · MAJOR

**Severity:** Major (user data corruption with no error returned)
**Module:** `server/lib/routes/content.mjs` (or wherever the CV import handler lives)

## Repro (executed during regression)

```js
const fd = new FormData();
fd.append('file', new Blob(['# Hello world'], { type: 'text/markdown' }), 'one.md');
const r = await fetch('/api/cv/import', { method: 'POST', body: fd });
const j = await r.json();
// status: 200
// j.markdown.length = 199
// j.markdown.startsWith('------WebKitFormBoundary') === true
//   ↑ multipart wire body became cv.md
```

Same for `Content-Type: multipart/form-data` from a real `<input type="file">` element on the page (which is what the CV upload widget uses on `#/cv`). The 200 response is misleading — the server *thinks* it succeeded, the file was *not* parsed, and `cv.md` was *overwritten* with the multipart envelope.

This is how cv.md was clobbered to a 290-character stub during the regression run (see F-006). Any user who hits a tooling glitch (browser misbehavior, network hiccup, server-side parser missing) will silently lose their CV.

## Likely cause

`/api/cv/import` is mapped to a handler that pipes `req.body` straight to `fs.writeFile('cv.md', body)` without first running `multer` / `formidable` / `busboy`. The multipart body is just bytes, so it gets persisted verbatim.

## Fix

### 1. Parse multipart correctly or 400

```js
// server/lib/routes/content.mjs
import multer from 'multer';   // already a candidate; or use formidable, both are tiny

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

app.post('/api/cv/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'multipart "file" field required' });
  }
  const { originalname, mimetype, buffer } = req.file;
  const ext = path.extname(originalname).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return res.status(415).json({ error: `unsupported format "${ext}"` });
  }
  let markdown;
  try {
    markdown = await convertToMarkdown({ ext, mimetype, buffer });
  } catch (err) {
    return res.status(422).json({ error: 'conversion failed', detail: err.message });
  }
  const sanitized = stripDangerousMarkdown(markdown);
  await fs.writeFile(PATHS.cv, sanitized.text);
  return res.json({
    ok: true,
    sanitized: sanitized.changed,
    via: convertersUsed[ext],
    bytes: Buffer.byteLength(sanitized.text),
    markdown: sanitized.text
  });
});
```

`convertToMarkdown` dispatch:
- `.md / .markdown / .txt`         → passthrough (decode utf-8, normalize line endings)
- `.html / .htm`                   → spawn `pandoc -f html -t gfm`
- `.docx / .doc / .odt / .rtf`     → spawn `pandoc -f docx -t gfm` (etc.)
- `.pdf`                           → spawn `pdftotext -layout -nopgbrk - -`
- anything else                    → throw → 415

### 2. Strict size check (10 MB cap from the help)

Already partially enforced if multer is configured with `limits.fileSize`. Add server-side:

```js
app.use('/api/cv/import', (req, res, next) => {
  const cl = parseInt(req.headers['content-length'] || '0', 10);
  if (cl > 10 * 1024 * 1024) return res.status(413).json({ error: 'too large' });
  next();
});
```

### 3. Don't persist on conversion failure

Today the failure mode (200-with-garbage) silently overwrites `cv.md`. Even after the multer fix, wrap the write in:

```js
const tmp = PATHS.cv + '.tmp';
await fs.writeFile(tmp, sanitized.text);
await fs.rename(tmp, PATHS.cv);   // atomic
```

So a crash mid-write doesn't truncate the user's file.

### 4. Backup before overwrite

```js
if (await fs.access(PATHS.cv).then(()=>true).catch(()=>false)) {
  await fs.copyFile(PATHS.cv, PATHS.cv + '.bak');
}
```

(Keep the last `.bak` only — it's not a version history, it's a "I just imported and it looks wrong" panic-button.)

## Test

```js
test('POST /api/cv/import returns 400 when no file part', async () => {
  const r = await fetch('/api/cv/import', { method:'POST', body: 'plain' });
  assert.equal(r.status, 400);
});

test('POST /api/cv/import correctly parses .md', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['# Hello'], { type: 'text/markdown' }), 'a.md');
  const r = await fetch('/api/cv/import', { method:'POST', body: fd });
  const j = await r.json();
  assert.equal(j.markdown.startsWith('# Hello'), true);
  assert.equal(/WebKitFormBoundary/.test(j.markdown), false);
});

test('POST /api/cv/import strips XSS from HTML', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['<h1>X</h1><script>alert(1)</script>'], { type: 'text/html' }), 'a.html');
  const j = await fetch('/api/cv/import', { method:'POST', body: fd }).then(r => r.json());
  assert.match(j.markdown, /# X/);
  assert.equal(/<script/i.test(j.markdown), false);
});

test('413 on > 10MB upload', async () => {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(11*1024*1024)], { type: 'text/plain' }), 'huge.txt');
  const r = await fetch('/api/cv/import', { method:'POST', body: fd });
  assert.equal(r.status, 413);
});
```
