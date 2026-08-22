/**
 * Greenhouse adapter (v1.13.0 registry contract).
 *
 * Detects Greenhouse boards from a `careers_url` like
 * `job-boards.greenhouse.io/<slug>` or `job-boards.eu.greenhouse.io/<slug>`,
 * also honours an explicit `api:` field pointing at the boards-api endpoint.
 *
 * The actual HTTP fetch + response normalization lives in
 * server/lib/sources/greenhouse.mjs (kept intact for backwards compat).
 * This adapter is a thin wrapper that exposes the uniform registry contract
 * the new consolidated /api/stream/scan endpoint expects.
 */
import { fetchGreenhouse } from '../../sources/greenhouse.mjs';

const URL_PATTERN = /job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/;

export const greenhouseAdapter = {
  id: 'greenhouse',
  label: 'Greenhouse',
  matches(company) {
    if (company.api && company.api.includes('greenhouse')) return true;
    return URL_PATTERN.test(company.careers_url || '');
  },
  buildEndpoint(company) {
    if (company.api && company.api.includes('greenhouse')) return company.api;
    const m = (company.careers_url || '').match(URL_PATTERN);
    if (!m) return null;
    return `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs`;
  },
  fetch: fetchGreenhouse,
};
