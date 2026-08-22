/**
 * Workable adapter (v1.14.0 registry contract).
 *
 * Detects Workable boards from a `careers_url` like
 * `apply.workable.com/<account>/...` or `<account>.workable.com/...`,
 * also honours an explicit `api:` field pointing at the v3 endpoint.
 */
import { fetchWorkable } from '../../sources/workable.mjs';

// apply.workable.com hosts every customer; <subdomain>.workable.com is
// the legacy shape. Both expose the same v3 jobs API.
const APPLY_URL_PATTERN  = /apply\.workable\.com\/([^/?#]+)/;
const LEGACY_URL_PATTERN = /https?:\/\/([^./]+)\.workable\.com/;

export const workableAdapter = {
  id: 'workable',
  label: 'Workable',
  matches(company) {
    if (company.api && company.api.includes('workable.com')) return true;
    const u = company.careers_url || '';
    return APPLY_URL_PATTERN.test(u) || LEGACY_URL_PATTERN.test(u);
  },
  buildEndpoint(company) {
    if (company.api && company.api.includes('workable.com')) return company.api;
    const u = company.careers_url || '';
    const m1 = u.match(APPLY_URL_PATTERN);
    if (m1) return `https://apply.workable.com/api/v3/accounts/${m1[1]}/jobs?details=true`;
    const m2 = u.match(LEGACY_URL_PATTERN);
    if (m2) return `https://apply.workable.com/api/v3/accounts/${m2[1]}/jobs?details=true`;
    return null;
  },
  fetch: fetchWorkable,
};
