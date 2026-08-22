#!/usr/bin/env bash
# career-ops-ui launcher
#
# Layouts supported:
#   1. career-ops/web-ui/         (this repo cloned as web-ui inside career-ops)
#   2. career-ops-ui/             (standalone clone — set CAREER_OPS_ROOT)
#
# Usage:
#   bash bin/start.sh                              # default port 4317
#   PORT=8080 bash bin/start.sh
#   HOST=0.0.0.0 PORT=4317 bash bin/start.sh       # expose on LAN
#   CAREER_OPS_ROOT=/path/to/career-ops bash bin/start.sh
#
# What it does:
#   1. Verifies Node ≥ 18.
#   2. npm install (only on first run, three deps: express + js-yaml + multer).
#   3. Starts the Express server.
#   4. Opens the browser when ready (macOS / Linux).

set -euo pipefail

# Resolve the real script location, following symlinks. npm/npx expose this
# bin as a symlink under node_modules/.bin/career-ops-ui-start; a plain
# `dirname` of "${BASH_SOURCE[0]}" would point at `.bin` and make WEB_UI wrong.
# Canonicalize through the symlink chain so `npx career-ops-ui-start` works too.
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  SOURCE="$( readlink "$SOURCE" )"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
WEB_UI="$( cd "$SCRIPT_DIR/.." && pwd )"

PORT="${PORT:-4317}"
HOST="${HOST:-127.0.0.1}"

# Resolve project root: explicit env var, then ../, then cwd.
if [[ -n "${CAREER_OPS_ROOT:-}" ]]; then
  PROJECT_ROOT="$( cd "$CAREER_OPS_ROOT" && pwd )"
elif [[ -f "$WEB_UI/../cv.md" || -f "$WEB_UI/../portals.yml" ]]; then
  PROJECT_ROOT="$( cd "$WEB_UI/.." && pwd )"
elif [[ -f "$PWD/cv.md" || -f "$PWD/portals.yml" ]]; then
  PROJECT_ROOT="$PWD"
else
  PROJECT_ROOT="$( cd "$WEB_UI/.." && pwd )"
fi

export CAREER_OPS_ROOT="$PROJECT_ROOT"

echo ""
echo "  career-ops-ui"
echo "  ─────────────"
echo "  project: $PROJECT_ROOT"
echo "  ui dir : $WEB_UI"
echo "  bind   : http://${HOST}:${PORT}"
echo ""

# 1. node check
if ! command -v node >/dev/null 2>&1; then
  echo "  error: node not found. Install Node.js >= 18 from https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -p "parseInt(process.versions.node, 10)")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "  error: Node.js >= 18 required (found $(node -v))"
  exit 1
fi

cd "$WEB_UI"

# 2. install web-ui deps if missing
if [ ! -d "node_modules" ]; then
  echo "  installing web-ui dependencies (one-time)…"
  npm install --silent --no-audit --no-fund
  echo "  done."
  echo ""
fi

# 2b. install parent project deps if needed (FIX-C12)
#     scan.mjs / generate-pdf.mjs / check-liveness.mjs all need
#     parent's node_modules (js-yaml, playwright, jsdom, …).
if [ -f "$PROJECT_ROOT/package.json" ] && [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo "  installing parent project dependencies (one-time)…"
  ( cd "$PROJECT_ROOT" && npm install --silent --no-audit --no-fund )
  echo "  done."
  echo ""
fi

# 2c. install Playwright Chromium if missing (FIX-C4 / C9)
#     Required for /api/stream/pdf and /api/stream/liveness streams.
if [ -d "$PROJECT_ROOT/node_modules/playwright" ]; then
  if ! ( cd "$PROJECT_ROOT" && npx --no-install playwright --version >/dev/null 2>&1 ); then
    :  # playwright resolved but CLI not callable — skip silently
  fi
  if [ ! -d "$HOME/Library/Caches/ms-playwright" ] && [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo "  installing Playwright Chromium (~150 MB, one-time)…"
    ( cd "$PROJECT_ROOT" && npx playwright install chromium ) || \
      echo "  warning: Playwright install failed — PDF + liveness streams will error until fixed"
    echo ""
  fi
fi

# 3. open AND raise the browser when the port responds.
#    v1.43.0 (user-requested): bare `open`/`xdg-open` left the dashboard
#    tab in the background when the browser was already running. Delegate
#    to scripts/open-dashboard.mjs, which opens the URL then force-raises
#    the browser window (same code path as `career-ops-ui open`). Honors
#    NO_OPEN=1 for headless / CI starts.
open_when_ready() {
  [[ "${NO_OPEN:-}" == "1" ]] && return 0
  for i in {1..30}; do
    sleep 0.4
    if curl -fsS -o /dev/null "http://${HOST}:${PORT}/api/health" 2>/dev/null; then
      PORT="$PORT" HOST="$HOST" node "$WEB_UI/scripts/open-dashboard.mjs" --no-wait 2>/dev/null || true
      return 0
    fi
  done
}
open_when_ready &

# 4. start server (foreground, so Ctrl-C kills it cleanly)
PORT="$PORT" HOST="$HOST" CAREER_OPS_ROOT="$PROJECT_ROOT" exec node server/index.mjs
