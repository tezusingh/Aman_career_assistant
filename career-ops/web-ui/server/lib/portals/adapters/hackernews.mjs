/**
 * Hacker News adapter (registry contract).
 *
 * Board-wide source — matches ONLY on `provider: hackernews`. The endpoint
 * returned by buildEndpoint is nominal (fetchHackerNews always uses SEARCH_URL
 * internally), but must be a non-null string so resolveAdapter accepts it.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Hacker News
 *       provider: hackernews
 *       enabled: true
 */
import { fetchHackerNews } from '../../sources/hackernews.mjs';

export const hackernewsAdapter = {
  id: 'hackernews',
  label: 'Hacker News (Who is hiring)',
  matches(company) {
    return company.provider === 'hackernews';
  },
  buildEndpoint() {
    // Nominal, FIXED value — fetchHackerNews ignores it and always uses the
    // Algolia SEARCH_URL internally. Returning a constant (never a user-supplied
    // company.api / company.hackernews) keeps an arbitrary URL out of the slot.
    return 'https://hn.algolia.com';
  },
  fetch: fetchHackerNews,
};
