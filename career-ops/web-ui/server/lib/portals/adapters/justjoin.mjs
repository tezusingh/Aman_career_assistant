/**
 * JustJoin.it adapter (registry contract). v1.80.0.
 *
 * Detects a JustJoin.it entry from:
 *   - explicit `provider: justjoin`, OR
 *   - `api:` / `careers_url:` whose host matches justjoin.it
 *
 * The API endpoint is always the candidate-api offers URL — browser
 * career URLs (justjoin.it/job-offers/...) are detection signals only
 * and are never used as fetch endpoints.
 */
import { fetchJustJoin, API_URL, JUSTJOIN_HOST_RE } from '../../sources/justjoin.mjs';

function justjoinHostMatch(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  if (!raw) return false;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return u.protocol === 'https:' && JUSTJOIN_HOST_RE.test(u.hostname);
}

export const justjoinAdapter = {
  id: 'justjoin',
  label: 'JustJoin.it',
  matches(company) {
    if (company.provider === 'justjoin') return true;
    return justjoinHostMatch(company);
  },
  buildEndpoint(company) {
    // If a dedicated API override is set use it; for browser careers_url
    // (or no URL at all) fall back to the canonical candidate-api endpoint.
    const candidate = company.justjoin || company.api;
    if (candidate) {
      try {
        const u = new URL(candidate);
        // Host-pin AND require an `/api/` path: a browser job-offers URL
        // (justjoin.it/job-offers/…) passes the host check but is NOT the
        // candidate-api endpoint — it must never become the fetch target.
        if (u.protocol === 'https:' && JUSTJOIN_HOST_RE.test(u.hostname)
            && u.pathname.startsWith('/api/')) {
          return candidate;
        }
      } catch {
        // fall through to API_URL
      }
    }
    return API_URL;
  },
  fetch: fetchJustJoin,
};
