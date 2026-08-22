/**
 * Jobspresso adapter (registry contract).
 *
 * A board-wide aggregator, so it matches ONLY on an explicit
 * `provider: jobspresso` field — never on careers_url. The endpoint is the
 * fixed public RSS feed, overridable via `api:` / `jobspresso:` for testing
 * or a mirror.
 *
 *   tracked_companies:
 *     - name: Jobspresso
 *       provider: jobspresso
 *       enabled: true
 */
import { fetchJobspresso, FEED_URL } from '../../sources/jobspresso.mjs';

export const jobspressoAdapter = {
  id: 'jobspresso',
  label: 'Jobspresso',
  matches(company) {
    return company.provider === 'jobspresso';
  },
  buildEndpoint(company) {
    return company.jobspresso || company.api || FEED_URL;
  },
  fetch: fetchJobspresso,
};
