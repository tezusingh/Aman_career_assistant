/**
 * SmartRecruiters adapter (v1.14.0 registry contract).
 *
 * Detects SmartRecruiters boards from a `careers_url` like
 * `jobs.smartrecruiters.com/<slug>` or `careers.smartrecruiters.com/<slug>`,
 * also honours an explicit `api:` field pointing at api.smartrecruiters.com.
 */
import { fetchSmartRecruiters } from '../../sources/smartrecruiters.mjs';

const URL_PATTERN = /(?:jobs|careers)\.smartrecruiters\.com\/([^/?#]+)/;

export const smartRecruitersAdapter = {
  id: 'smartrecruiters',
  label: 'SmartRecruiters',
  matches(company) {
    if (company.api && company.api.includes('smartrecruiters.com')) return true;
    return URL_PATTERN.test(company.careers_url || '');
  },
  buildEndpoint(company) {
    if (company.api && company.api.includes('smartrecruiters.com')) return company.api;
    const m = (company.careers_url || '').match(URL_PATTERN);
    if (!m) return null;
    return `https://api.smartrecruiters.com/v1/companies/${m[1]}/postings`;
  },
  fetch: fetchSmartRecruiters,
};
