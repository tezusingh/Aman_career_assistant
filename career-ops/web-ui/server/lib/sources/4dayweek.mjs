/**
 * 4 Day Week source — board-wide aggregator of 4-day-week / reduced-hours roles.
 * Public, zero-auth JSON API: https://4dayweek.io/api/jobs
 *
 * Response shape: { jobs: [...], total, page, has_more }
 * Each job: { id, title, slug, company_name, company: { name, slug, ... },
 *   work_arrangement, remote, locations: [{ city, country, ... }],
 *   posted (epoch SECONDS), is_expired, salary?, ... }
 *
 * Paginated 25/page via ?page=N. Stop when has_more===false or maxPages reached.
 * Expired postings (is_expired===true) are dropped.
 * No per-job URL in the feed — built as https://4dayweek.io/job/<slug>.
 *
 * Used by the 4dayweek adapter (server/lib/portals/adapters/4dayweek.mjs).
 */

const UA = 'career-ops-web-ui/1.0';
const TRUSTED_HOST = '4dayweek.io';
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES_CAP = 50;
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

export const FEED_BASE = 'https://4dayweek.io/api/jobs';
export const JOB_BASE = 'https://4dayweek.io/job/';

export const meta = {
  value: '4dayweek',
  label: '4 Day Week',
  region: 'en',
};

/**
 * SSRF guard — throws unless the URL is https://4dayweek.io/...
 * @param {string} u
 * @returns {string}
 */
export function assert4DayWeekUrl(u) {
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error(`4dayweek: invalid URL: ${u}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`4dayweek: URL must use HTTPS: ${u}`);
  }
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`4dayweek: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return u;
}

/**
 * Normalize a single job object from the 4 Day Week API into the 12-field shape.
 * Returns null for expired postings or entries without a usable slug/title.
 * @param {any} j
 * @returns {object|null}
 */
function normalize(j) {
  if (!j || typeof j !== 'object') return null;
  if (j.is_expired === true) return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  const slug = typeof j.slug === 'string' ? j.slug.trim() : '';
  if (!SLUG_RE.test(slug)) return null; // need a clean slug to build the URL

  const url = `${JOB_BASE}${encodeURIComponent(slug)}`;
  assert4DayWeekUrl(url);

  // id: prefer numeric id, fall back to slug
  const rawId = j.id != null ? String(j.id) : slug;
  const id = `4dayweek-${rawId}`;

  // company: company_name field first, then nested company.name
  const company =
    typeof j.company_name === 'string' && j.company_name.trim()
      ? j.company_name.trim()
      : j.company && typeof j.company === 'object' && typeof j.company.name === 'string'
        ? j.company.name.trim()
        : '4 Day Week';

  // location: first element of locations[], append Remote when applicable
  const first =
    Array.isArray(j.locations) && j.locations[0] && typeof j.locations[0] === 'object'
      ? j.locations[0]
      : {};
  const city = typeof first.city === 'string' ? first.city.trim() : '';
  const country = typeof first.country === 'string' ? first.country.trim() : '';
  const locBase = [city, country].filter(Boolean).join(', ');
  const isRemote = j.remote === true || j.work_arrangement === 'remote' || first.work_arrangement === 'remote';
  const location = [locBase, isRemote ? 'Remote' : ''].filter(Boolean).join(', ');
  const workplaceType = isRemote ? 'Remote' : 'Onsite';

  // date: posted is epoch SECONDS → multiply by 1000 → YYYY-MM-DD
  let date = '';
  if (typeof j.posted === 'number' && Number.isFinite(j.posted)) {
    date = new Date(j.posted * 1000).toISOString().slice(0, 10);
  }

  const salary = typeof j.salary === 'string' ? j.salary.trim() : '';

  return {
    id,
    title,
    company,
    url,
    salary,
    location,
    isRemote,
    workplaceType,
    relocates: false,
    date,
    snippet: '',
    source: '4dayweek',
  };
}

/**
 * Fetch + normalize the 4 Day Week public feed, paginating up to maxPages.
 *
 * @param {string} feedUrl
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, maxPages?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetch4DayWeek(feedUrl = FEED_BASE, opts = {}) {
  const { fetchImpl = fetch, signal, maxPages: rawMax = DEFAULT_MAX_PAGES } = opts;

  // Clamp maxPages to [1, MAX_PAGES_CAP]
  const maxPages = Math.min(Math.max(1, Math.floor(rawMax)), MAX_PAGES_CAP);

  assert4DayWeekUrl(feedUrl);

  const out = [];

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = `${feedUrl}?page=${page}`;
    const res = await fetchImpl(pageUrl, {
      signal,
      redirect: 'error',
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });

    if (!res.ok) {
      // First-page failure is fatal; later pages just stop the loop
      if (page === 1) {
        const err = new Error(`4dayweek: HTTP ${res.status} (${pageUrl})`);
        err.status = res.status;
        throw err;
      }
      break;
    }

    const json = await res.json();
    if (!json || !Array.isArray(json.jobs)) {
      if (page === 1) {
        throw new Error(
          `4dayweek: unexpected API response on page ${page} — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`,
        );
      }
      break;
    }

    for (const j of json.jobs) {
      const normalized = normalize(j);
      if (normalized) out.push(normalized);
    }

    if (json.has_more === false) break;
  }

  return out;
}
