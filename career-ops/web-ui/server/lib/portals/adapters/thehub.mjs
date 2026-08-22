/**
 * The Hub adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: thehub`. Endpoint is
 * the fixed public API, overridable via `thehub:` / `api:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: The Hub
 *       provider: thehub
 *       enabled: true
 */
import { fetchTheHub, FEED_BASE } from '../../sources/thehub.mjs';

export const thehubAdapter = {
  id: 'thehub',
  label: 'The Hub',
  matches(company) {
    return company.provider === 'thehub';
  },
  buildEndpoint(company) {
    return company.thehub || company.api || FEED_BASE;
  },
  fetch: fetchTheHub,
};
