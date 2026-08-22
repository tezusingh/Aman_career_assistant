/**
 * OpenRouter helper routes (v1.57.0).
 *
 *   GET /api/openrouter/models → live model catalogue for the
 *     /#/config OPENROUTER_MODEL dropdown.
 *
 * Why a server-side proxy and not a direct browser fetch:
 *   1. CSP — `connect-src 'self'` (server/index.mjs) deliberately
 *      forbids the SPA from calling third-party origins. Routing the
 *      catalogue through our own origin keeps that envelope intact
 *      (CLAUDE.md hard rule #3 — never weaken security headers).
 *   2. Resilience — fetchOpenRouterModels() degrades to a curated
 *      fallback list, so the dropdown is never empty offline.
 *
 * The OpenRouter /models endpoint is public (no key), so this route
 * needs no auth and returns no secrets. A small in-memory cache keeps
 * repeat /#/config visits from re-hitting OpenRouter.
 */
import { fetchOpenRouterModels } from '../openai.mjs';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — model list changes rarely
let _cache = null; // { at:number, body:object }

/**
 * Test-only: drop the in-memory catalogue cache so a suite can assert
 * the cache-miss → cache-hit transition deterministically regardless
 * of what earlier requests (or a live network) populated. No-op in
 * normal operation; never called from request paths.
 */
export function __resetModelsCache() {
  _cache = null;
}

export function registerOpenrouterRoutes(app) {
  app.get('/api/openrouter/models', async (_req, res) => {
    if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
      return res.json({ ..._cache.body, cached: true });
    }
    const out = await fetchOpenRouterModels();
    // Only cache a real (non-fallback) catalogue — a transient outage
    // shouldn't pin the fallback list for 10 minutes.
    if (!out.fallback) _cache = { at: Date.now(), body: out };
    res.json({ ...out, cached: false });
  });
}
