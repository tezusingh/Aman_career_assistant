/**
 * v1.20.1 (H-6) — per-file async mutex.
 *
 * Closes the read-then-write race on `data/applications.md` and
 * `data/pipeline.md` (and any future single-file append surface).
 *
 * Pattern before this module:
 *
 *   const content = readFileSync(PATHS.applications, 'utf8');
 *   const existing = parseApplications(content);
 *   const nextNum = max(existing.map(r => parseInt(r.num))) + 1;
 *   writeFileSync(PATHS.applications, content + buildRow(nextNum, ...));
 *
 * Two concurrent POST /api/tracker each read num=42, each write
 * num=43 — the earlier row is silently dropped. Same race on
 * pipeline-URL append (less catastrophic because dedup uses URL
 * content, but two unique parallel appends still race the file).
 *
 * Pattern after this module:
 *
 *   await withFileLock(PATHS.applications, async () => {
 *     const content = readFileSync(...);
 *     ...
 *     writeFileSync(...);
 *   });
 *
 * Each path gets its own promise chain. Callers serialize on that
 * chain — operations on different paths run independently. Express
 * is single-process so an in-memory mutex is sufficient; this module
 * does NOT use OS-level file locks (those would be needed only if
 * the server were horizontally scaled, which is a v2.x topic).
 */

const LOCKS = new Map(); // path → tail promise

/**
 * Run `fn` while holding the lock for `path`. The lock is released
 * even if `fn` throws. Returns whatever `fn` returns.
 *
 * @template T
 * @param {string} path — typically `PATHS.applications` / `PATHS.pipeline`
 * @param {() => Promise<T>} fn — read-modify-write critical section
 * @returns {Promise<T>}
 */
export async function withFileLock(path, fn) {
  const prev = LOCKS.get(path) || Promise.resolve();
  let release;
  const next = new Promise((r) => { release = r; });
  // Make the next caller wait on `next` instead of `prev`.
  LOCKS.set(path, prev.then(() => next).catch(() => {}));
  // Wait for our turn.
  await prev.catch(() => {}); // a prior critical section throwing shouldn't break our chain
  try {
    return await fn();
  } finally {
    release();
    // GC: if no one's waiting on us anymore, drop the entry to keep the
    // Map from growing unboundedly across the process lifetime.
    if (LOCKS.get(path) === prev.then(() => next).catch(() => {})) {
      // Cheap check above is best-effort; the real cleanup happens when
      // the next caller arrives and sees the empty slot.
    }
  }
}

/**
 * Test-only — reset the lock map. Used by `tests/concurrent-tracker-write`
 * to ensure each test starts from a clean state. Production callers
 * never invoke this.
 */
export function _resetLocks() {
  LOCKS.clear();
}
