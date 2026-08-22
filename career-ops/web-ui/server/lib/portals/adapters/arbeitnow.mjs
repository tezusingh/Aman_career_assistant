/**
 * Arbeitnow adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: arbeitnow`. Endpoint is
 * the fixed public feed, overridable via `api:` / `arbeitnow:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Arbeitnow
 *       provider: arbeitnow
 *       enabled: true
 */
import { fetchArbeitnow, FEED_URL } from '../../sources/arbeitnow.mjs';

export const arbeitnowAdapter = {
  id: 'arbeitnow',
  label: 'Arbeitnow',
  matches(company) {
    return company.provider === 'arbeitnow';
  },
  buildEndpoint(company) {
    return company.arbeitnow || company.api || FEED_URL;
  },
  fetch: fetchArbeitnow,
};
