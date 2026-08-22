/**
 * GeekJob.ru scanner — IT-focused Russian job-board.
 *
 * Endpoint: https://geekjob.ru/?qs=<query>
 * Auth:     none (public HTML).
 * Geo:      no IP gate.
 *
 * Same defensive HTML-scrape strategy as `getmatch.mjs` — best-effort
 * regex parsers, empty-array fallback on unparseable bodies, never
 * throws on a healthy 200. See the GetMatch adapter file header for
 * the rationale.
 *
 * NOTE: parser regexes are baseline-best-effort; HTML may need a tweak
 * after the first live run.
 */

const GEEKJOB_BASE = 'https://geekjob.ru';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'geekjob',
  label: 'GeekJob',
  region: 'ru',
  configKey: 'geekjob',
};

/**
 * Search GeekJob for one query string.
 * Returns array of normalized job objects. Empty on parse failure.
 */
export async function searchGeekJob(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const params = new URLSearchParams({ qs: query });
  if (onlyRemote) params.set('remote', '1');

  const res = await fetchImpl(`${GEEKJOB_BASE}/?${params}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });

  if (!res.ok) {
    const err = new Error(`GeekJob: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const html = await res.text();
  const out = parseGeekJobCards(html);
  return onlyRemote ? out.filter((j) => j.isRemote) : out;
}

/**
 * Parse vacancy-cards from a GeekJob HTML page.
 * Pure function — exported for testing with fixture HTML.
 *
 * GeekJob historically renders each vacancy as an `<article>` or `<div
 * class="vacancy">` block with `<h2><a href="/vacancy/<id>">Title</a></h2>`,
 * `<div class="company">Company</div>`, `<div class="info"...>` for salary
 * + location/remote chips. We match both `article` and `div`-wrapped
 * variants so a minor template rotation doesn't break the parser.
 */
export function parseGeekJobCards(html) {
  if (!html) return [];
  const out = [];

  // Pattern: <a href="/vacancy/<id>">Title</a> + nearby content.
  const cardRe = /<a[^>]+href="(\/vacancy\/[^"]+)"[^>]*>\s*([^<][^<]{1,180}?)\s*<\/a>([\s\S]{0,2000}?)(?=<a[^>]+href="\/vacancy\/|$)/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const [_, href, title, block] = m;
    if (!title || title.length < 4) continue;
    const company = (
      block.match(/class="?(?:company|employer)"?[^>]*>\s*([^<]{2,100}?)\s*</i) ||
      []
    )[1];
    const salary = (block.match(/(\d[\d\s,]*\s*[—–-]\s*\d[\d\s,]*\s*(?:₽|\$|€|руб|RUB))/i) || [])[1];
    const isRemote = /(удал[её]н|remote)/i.test(block);
    const hasReloc = /(релок|relocation)/i.test(block);

    out.push({
      id: `geekjob-${href.replace(/^\/vacancy\//, '').replace(/\/$/, '')}`,
      title: title.trim(),
      company: company?.trim() || '',
      url: GEEKJOB_BASE + href,
      salary: (salary || '').replace(/\s+/g, ' ').trim(),
      location: isRemote ? 'Remote' : 'Russia',
      isRemote,
      relocates: hasReloc,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      date: '',
      snippet: '',
      source: 'geekjob',
    });
  }
  return out;
}

export const GEEKJOB = { searchGeekJob, parseGeekJobCards };
