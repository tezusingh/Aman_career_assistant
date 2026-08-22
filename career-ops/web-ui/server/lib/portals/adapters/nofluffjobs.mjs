/**
 * NoFluffJobs adapter (registry contract).
 *
 * Board-wide POST search — matches on `provider: nofluffjobs` OR a
 * careers_url/api whose host is nofluffjobs.com (https only).
 * Endpoint is always the fixed POST search API (API_URL); a browser-facing
 * careers_url is NOT the POST endpoint, so we never forward it as-is.
 * The caller may override via an explicit `nofluffjobs:` key in the entry.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: NoFluffJobs
 *       provider: nofluffjobs
 *       enabled: true
 */
import { fetchNoFluffJobs, API_URL, NOFLUFF_HOST_RE } from '../../sources/nofluffjobs.mjs';

function isNoFluffHost(raw) {
  if (!raw || typeof raw !== 'string') return false;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return u.protocol === 'https:' && NOFLUFF_HOST_RE.test(u.hostname);
}

export const nofluffjobsAdapter = {
  id: 'nofluffjobs',
  label: 'NoFluffJobs',

  matches(company) {
    if (company.provider === 'nofluffjobs') return true;
    return isNoFluffHost(company.api) || isNoFluffHost(company.careers_url);
  },

  /**
   * Always returns the POST search API endpoint.
   * An explicit `nofluffjobs:` key in the config entry can override it,
   * but a browser careers_url is not the POST API — ignore it for endpoint.
   */
  buildEndpoint(company) {
    // Defence-in-depth: host-pin an explicit `nofluffjobs:` override here too
    // (the source-level assertNoFluffUrl is the hard SSRF guard, but an
    // off-host override should never reach the fetch slot in the first place).
    const override = company.nofluffjobs;
    if (override) {
      try {
        const u = new URL(override);
        if (u.protocol === 'https:' && NOFLUFF_HOST_RE.test(u.hostname)) return override;
      } catch { /* fall through to API_URL */ }
    }
    return API_URL;
  },

  fetch: fetchNoFluffJobs,
};
