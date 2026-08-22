/**
 * Landing.jobs adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: landingjobs`. Endpoint
 * is the fixed public feed, overridable via `api:` / `landingjobs:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Landing.jobs
 *       provider: landingjobs
 *       enabled: true
 */
import { fetchLandingjobs, FEED_URL } from '../../sources/landingjobs.mjs';

export const landingjobsAdapter = {
  id: 'landingjobs',
  label: 'Landing.jobs',
  matches(c) {
    return c.provider === 'landingjobs';
  },
  buildEndpoint(c) {
    return c.landingjobs || c.api || FEED_URL;
  },
  fetch: fetchLandingjobs,
};
