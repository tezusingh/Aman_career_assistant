/**
 * Minimal .env loader. Zero dependencies (we promise express + js-yaml only),
 * good enough for KEY=value, KEY="quoted value", # comments, blank lines.
 * Existing process.env values win — env vars set on the command line aren't
 * silently shadowed by the file.
 *
 * The error messages in scanner code already point users at .env (e.g.
 * "set HH_USER_AGENT in .env or run from a Russian IP"); this module
 * makes that hint actually work.
 */
import { readFileSync, existsSync } from 'node:fs';

export function loadEnvFile(path) {
  if (!path || !existsSync(path)) return { loaded: 0 };
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { loaded: 0 };
  }
  let loaded = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s+|\s+$/g, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
      loaded++;
    }
  }
  return { loaded };
}
