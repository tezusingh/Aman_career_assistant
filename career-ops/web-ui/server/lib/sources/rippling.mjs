// @ts-check
/**
 * Rippling source — per-tenant ATS board API. v1.80.0 parity.
 *
 * Detection: careers_url host is `ats.rippling.com`; the slug is the first
 * path segment (e.g. `https://ats.rippling.com/acme-jobs/jobs` → `acme-jobs`).
 *
 * API endpoint is on a DIFFERENT host — the slug is transplanted into:
 *   https://api.rippling.com/platform/api/ats/v1/board/<slug>/jobs
 *
 * Response shape: a top-level JSON ARRAY of
 *   { uuid, name, url, workLocation: { id, label } | string, ... }
 *
 * Used by the rippling adapter (server/lib/portals/adapters/rippling.mjs).
 */
import { fetchJson } from '../http-json.mjs';

const UA = 'Mozilla/5.0 (compatible; career-ops/1.3)';

export const RIPPLING_CAREERS_HOST_RE = /(^|\.)ats\.rippling\.com$/i;
export const RIPPLING_API_HOST = 'api.rippling.com';
export const API_BASE = 'https://api.rippling.com/platform/api/ats/v1/board';

export const meta = { value: 'rippling', label: 'Rippling', region: 'en' };

/**
 * Extract the tenant slug from a Rippling careers URL.
 * Accepts `https://ats.rippling.com/<slug>/jobs` or `https://ats.rippling.com/<slug>`.
 * Returns the slug string, or null when the URL is not a valid Rippling careers URL.
 *
 * @param {string} raw
 * @returns {string|null}
 */
export function ripplingSlugFromCareersUrl(raw) {
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!RIPPLING_CAREERS_HOST_RE.test(u.hostname)) return null;
  const segment = u.pathname.split('/').filter(Boolean)[0] || '';
  return segment || null;
}

/**
 * Build the board API URL for a validated slug.
 * @param {string} slug
 * @returns {string}
 */
export function buildRipplingEndpoint(slug) {
  return `${API_BASE}/${encodeURIComponent(slug)}/jobs`;
}

/**
 * Defence-in-depth: assert the endpoint is an api.rippling.com HTTPS URL.
 * @param {string} url
 */
function assertRipplingApiUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`rippling: invalid URL: ${url}`);
  }
  if (u.protocol !== 'https:') throw new Error(`rippling: URL must use HTTPS: ${url}`);
  if (u.hostname !== RIPPLING_API_HOST) {
    throw new Error(`rippling: untrusted hostname "${u.hostname}" — must be ${RIPPLING_API_HOST}`);
  }
}

function toIsoDate(value) {
  if (!value) return '';
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

const REMOTE_RE = /remote|anywhere|distributed|home\s*office/i;

/**
 * Normalize one raw Rippling posting into the 12-field web-ui job shape.
 * @param {any} j raw posting object
 * @param {string} slug used as fallback company name
 */
function normalize(j, slug) {
  const title = (typeof j?.name === 'string' ? j.name : typeof j?.title === 'string' ? j.title : '').trim();
  if (!title) return null;

  // URL: must be absolute https; display-only, never server-fetched from here.
  let url = '';
  const rawUrl = typeof j?.url === 'string' ? j.url.trim() : '';
  if (rawUrl) {
    try {
      const p = new URL(rawUrl);
      if (p.protocol === 'https:') url = p.href;
    } catch { /* drop */ }
  }
  if (!url) return null;

  // Location: workLocation may be an object with a label, or a bare string.
  const wl = j?.workLocation;
  const location =
    wl && typeof wl === 'object' && typeof wl.label === 'string'
      ? wl.label.trim()
      : typeof wl === 'string'
        ? wl.trim()
        : '';

  const isRemote = REMOTE_RE.test(location) || REMOTE_RE.test(title);

  // Company: feed is per-tenant; capitalize slug as fallback.
  const company =
    typeof j?.company === 'string' && j.company.trim()
      ? j.company.trim()
      : slug.charAt(0).toUpperCase() + slug.slice(1);

  // Unique id: prefix with source name.
  const rawId = j?.uuid || j?.id || '';
  const id = `rippling-${rawId || url}`;

  const date = toIsoDate(j?.created || j?.published || j?.created_at || '');

  return {
    id,
    title,
    url,
    company,
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : 'Onsite',
    salary: '',
    date,
    snippet: '',
    relocates: false,
    source: 'rippling',
  };
}

/**
 * Fetch + normalize a Rippling board API endpoint.
 *
 * @param {string} endpoint  `https://api.rippling.com/platform/api/ats/v1/board/<slug>/jobs`
 * @param {{ fetchImpl?: typeof fetch, signal?: AbortSignal, company?: object }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchRippling(endpoint, opts = {}) {
  const { fetchImpl = fetch, signal } = opts;
  assertRipplingApiUrl(endpoint);

  // Extract slug from the API URL for use as company name fallback.
  // Path: /platform/api/ats/v1/board/<slug>/jobs
  const slugFromPath = new URL(endpoint).pathname.split('/').filter(Boolean)[5] || '';

  const json = await fetchJson(fetchImpl, endpoint, {
    signal,
    redirect: 'error',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });

  const arr = Array.isArray(json) ? json : Array.isArray(json?.jobs) ? json.jobs : [];
  return arr.map((j) => normalize(j, slugFromPath)).filter(Boolean);
}
