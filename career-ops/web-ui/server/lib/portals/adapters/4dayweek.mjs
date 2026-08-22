/**
 * 4 Day Week adapter (registry contract).
 *
 * Board-wide aggregator — matches ONLY on `provider: 4dayweek`. Endpoint is
 * the fixed public JSON API, overridable via `4dayweek:` / `api:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: 4 Day Week
 *       provider: 4dayweek
 *       enabled: true
 */
import { fetch4DayWeek, FEED_BASE } from '../../sources/4dayweek.mjs';

export const fourDayWeekAdapter = {
  id: '4dayweek',
  label: '4 Day Week',
  matches(company) {
    return company.provider === '4dayweek';
  },
  buildEndpoint(company) {
    return company['4dayweek'] || company.api || FEED_BASE;
  },
  fetch: fetch4DayWeek,
};
