/**
 * Pinpoint adapter (registry contract). Per-tenant ATS.
 *
 * Detects a Pinpoint tenant from a `careers_url`/`api:` whose host matches
 * `<slug>.pinpointhq.com`, or from an explicit `provider: pinpoint`. The feed
 * is the tenant's public JSON endpoint (`/postings.json`); the HTTP fetch +
 * normalization live in server/lib/sources/pinpoint.mjs.
 */
import { fetchPinpoint, PINPOINT_HOST_RE } from '../../sources/pinpoint.mjs';

function tenantOrigin(company) {
  const raw = String(company.api || company.careers_url || '').trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!PINPOINT_HOST_RE.test(u.hostname)) return null;
  return `https://${u.hostname}`;
}

export const pinpointAdapter = {
  id: 'pinpoint',
  label: 'Pinpoint',
  matches(company) {
    if (company.provider === 'pinpoint') return true;
    return tenantOrigin(company) !== null;
  },
  buildEndpoint(company) {
    const origin = tenantOrigin(company);
    return origin ? `${origin}/postings.json` : null;
  },
  fetch: fetchPinpoint,
};
