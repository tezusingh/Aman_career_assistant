/**
 * GetMatch.ru scanner — tech-focused Russian job-board.
 *
 * Endpoint: https://getmatch.ru/vacancies?q=<query>
 * Auth:     none (public HTML).
 * Geo:      no IP gate.
 *
 * Parse strategy (defensive HTML scrape):
 *   GetMatch's vacancy index is server-rendered HTML. v1.29.0 ships a
 *   best-effort parser that looks for the common patterns observed at
 *   build time. If the site rotates class names the parser returns []
 *   silently — the scanner logs zero hits and the user can file a
 *   parser-tuning ticket. We intentionally do NOT throw on empty parse:
 *   a healthy 200 + unparseable body is treated as "no results", not
 *   "error", to keep the multi-source scanner robust.
 *
 * NOTE: parser regexes are baseline-best-effort; HTML may need a tweak
 * after the first live run. The `parseGetMatchCards` function is
 * exported so it can be tuned independently with new fixtures.
 */

const GETMATCH_BASE = 'https://getmatch.ru';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'getmatch',
  label: 'GetMatch',
  region: 'ru',
  configKey: 'getmatch',
};

/**
 * Search GetMatch for one query string.
 * Returns array of normalized job objects. Empty array on parse failure
 * (NOT an exception — see the file header for rationale).
 */
export async function searchGetMatch(query, opts = {}) {
  const { onlyRemote = false, fetchImpl = fetch, signal } = opts;
  const params = new URLSearchParams({ q: query });
  if (onlyRemote) params.set('format', 'remote');

  const res = await fetchImpl(`${GETMATCH_BASE}/vacancies?${params}`, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });

  if (!res.ok) {
    const err = new Error(`GetMatch: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const html = await res.text();
  const out = parseGetMatchCards(html);
  return onlyRemote ? out.filter((j) => j.isRemote) : out;
}

/**
 * Parse vacancy-cards from a GetMatch HTML page.
 * Pure function — exported for testing with fixture HTML.
 *
 * Looks for two patterns: anchored vacancy links and embedded JSON
 * (some versions of the site inline a JSON payload for hydration).
 */
export function parseGetMatchCards(html) {
  if (!html) return [];
  const out = [];

  // Pattern 1: anchor-style cards.
  //   <a href="/vacancies/<slug>" class="...">Title</a>
  //   <... class="...vacancy-card...">...company / salary / remote chips
  // We pair each <a href="/vacancies/..."> with the surrounding card.
  const cardRe = /<a[^>]+href="(\/vacancies\/[^"]+)"[^>]*>\s*([^<][^<]{1,180}?)\s*<\/a>([\s\S]{0,2000}?)(?=<a[^>]+href="\/vacancies\/|$)/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const [_, href, title, block] = m;
    if (!title || title.length < 4) continue;
    // Skip nav anchors that re-use /vacancies/<slug-style> URLs.
    if (/^(все\s+вакансии|all\s+jobs)$/i.test(title.trim())) continue;
    const company = (block.match(/company[^>]*>\s*([^<]{2,100}?)\s*</i) || [])[1];
    const salary = (block.match(/(\d[\d\s,]*\s*[—–-]\s*\d[\d\s,]*\s*(?:₽|\$|€|руб|RUB))/i) || [])[1];
    const isRemote = /(удал[её]н|remote)/i.test(block);
    const hasReloc = /(релок|relocation|reloc)/i.test(block);

    out.push({
      id: `getmatch-${href.replace(/^\/vacancies\//, '').replace(/\/$/, '')}`,
      title: title.trim(),
      company: company?.trim() || '',
      url: GETMATCH_BASE + href,
      salary: (salary || '').replace(/\s+/g, ' ').trim(),
      location: isRemote ? 'Remote' : 'Russia',
      isRemote,
      relocates: hasReloc,
      workplaceType: isRemote ? 'Remote' : 'Onsite',
      date: '',
      snippet: '',
      source: 'getmatch',
    });
  }
  return out;
}

export const GETMATCH = { searchGetMatch, parseGetMatchCards };
