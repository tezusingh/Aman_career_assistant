/**
 * Jobicy adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: jobicy`. Endpoint is
 * the fixed public JSON feed, overridable via `api:` / `jobicy:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Jobicy
 *       provider: jobicy
 *       enabled: true
 */
import { fetchJobicy, FEED_URL } from '../../sources/jobicy.mjs';

export const jobicyAdapter = {
  id: 'jobicy',
  label: 'Jobicy',
  matches(company) {
    return company.provider === 'jobicy';
  },
  buildEndpoint(company) {
    return company.jobicy || company.api || FEED_URL;
  },
  fetch: fetchJobicy,
};
