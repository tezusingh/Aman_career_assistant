/**
 * The Muse adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: themuse`. Endpoint is
 * the fixed public API base, overridable via `themuse:` / `api:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: The Muse
 *       provider: themuse
 *       enabled: true
 */
import { fetchTheMuse, FEED_BASE } from '../../sources/themuse.mjs';

export const themuseAdapter = {
  id: 'themuse',
  label: 'The Muse',
  matches(company) {
    return company.provider === 'themuse';
  },
  buildEndpoint(company) {
    return company.themuse || company.api || FEED_BASE;
  },
  fetch: fetchTheMuse,
};
