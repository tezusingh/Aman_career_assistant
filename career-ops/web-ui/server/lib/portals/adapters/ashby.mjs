/**
 * Ashby adapter (v1.13.0 registry contract).
 *
 * Detects Ashby boards from `careers_url` like `jobs.ashbyhq.com/<slug>`,
 * also honours an explicit `api:` field. The HTTP fetcher in
 * server/lib/sources/ashby.mjs already requests `?includeCompensation=true`
 * so salary information surfaces in the SPA where the board exposes it.
 */
import { fetchAshby } from '../../sources/ashby.mjs';

const URL_PATTERN = /jobs\.ashbyhq\.com\/([^/?#]+)/;

export const ashbyAdapter = {
  id: 'ashby',
  label: 'Ashby',
  matches(company) {
    if (company.api && company.api.includes('ashbyhq')) return true;
    return URL_PATTERN.test(company.careers_url || '');
  },
  buildEndpoint(company) {
    if (company.api && company.api.includes('ashbyhq')) return company.api;
    const m = (company.careers_url || '').match(URL_PATTERN);
    if (!m) return null;
    return `https://api.ashbyhq.com/posting-api/job-board/${m[1]}?includeCompensation=true`;
  },
  fetch: fetchAshby,
};
