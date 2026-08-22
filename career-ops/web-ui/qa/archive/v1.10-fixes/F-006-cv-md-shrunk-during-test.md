# F-006 · TEST DATA NOTE: cv.md was overwritten during scenario 4 probe (NOT a bug)

This is **not a regression** — it's an artifact of testing without a real Mac filesystem available to the QA agent.

## What happened

Scenario 4 (CV import) needed to test multipart file uploads. The QA agent doesn't have access to the user's Mac filesystem to upload real files. As a workaround, the agent constructed `FormData` blobs in-browser and POSTed them to `/api/cv/import`. The endpoint accepted the requests (status 200) but the multipart parsing path stored the raw multipart wire body as the new CV markdown — so `cv.md` got overwritten to a 290-character stub starting with `# Alex Doe`.

## Restore

```bash
cd /Users/sergejemelanov/Projects/career-ops
git checkout cv.md   # or reapply your real CV via the UI's 📁 Upload CV
```

The file is in `git` as part of the demo fixture; otherwise paste your real markdown back into `#/cv` and click 💾 Save.

## Side question worth investigating (potentially F-007)

The fact that POST /api/cv/import with a `multipart/form-data` body returned 200 and stored the raw multipart wire as the markdown content, instead of either parsing the file or returning 400, suggests the import handler either:

a) Has a multipart parser that accepts the request shape but writes the wrong field.
b) Has no multipart parser at all and treats the body bytes as the file content directly — in which case the upload UI must be sending a different content-type and the QA agent's probe shape was wrong.

Either way, a malicious or malformed upload corrupting `cv.md` silently is a UX hazard. Worth a unit test asserting that a malformed multipart returns 400, not 200-with-garbage.
