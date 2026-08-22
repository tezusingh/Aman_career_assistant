/**
 * Himalayas adapter (registry contract).
 *
 * Board-wide remote-only aggregator — matches ONLY on `provider: himalayas`.
 * Endpoint is the fixed public feed, overridable via `api:` / `himalayas:`.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Himalayas
 *       provider: himalayas
 *       enabled: true
 */
import { fetchHimalayas, FEED_URL } from '../../sources/himalayas.mjs';

export const himalayasAdapter = {
  id: 'himalayas',
  label: 'Himalayas',
  matches(company) {
    return company.provider === 'himalayas';
  },
  buildEndpoint(company) {
    return company.himalayas || company.api || FEED_URL;
  },
  fetch: fetchHimalayas,
};
