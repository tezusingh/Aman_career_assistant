#!/usr/bin/env bash
# WS8.1 (v1.38.0) — unified CLI dispatcher (AutoResearchClaw-style).
#
#   career-ops-ui setup    → one-command bootstrap (bin/setup.sh)
#   career-ops-ui init     → choose LLM provider + set its key (interactive)
#   career-ops-ui doctor   → verify env/tooling/keys (reuses /api/health)
#   career-ops-ui run      → launch the server (bin/start.sh)
#   career-ops-ui open     → open + RAISE the dashboard in your browser
#   career-ops-ui help     → this text
#
# One command does the whole chain: `setup` runs install → doctor →
# (unless SKIP_START=1) run. Every verb is also usable standalone.
set -euo pipefail
# Resolve the real script location, following symlinks. npm/npx expose this
# bin as a symlink under node_modules/.bin/career-ops-ui — a plain `dirname`
# of "${BASH_SOURCE[0]}" then points at `.bin`, making WEB_UI=node_modules and
# breaking `node "$WEB_UI/scripts/init.mjs"` (it looked for the script directly
# under node_modules/). Canonicalize through the symlink chain so verbs work
# whether the script is run from the repo, via `npm link`, or via `npx`.
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  SOURCE="$( readlink "$SOURCE" )"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
WEB_UI="$( cd "$SCRIPT_DIR/.." && pwd )"
VERB="${1:-help}"; shift || true

# Single source of truth for the usage text — a heredoc, so it can never
# leak surrounding shell source the way the old `sed -n` line-scrape did
# (v1.40.0 fix; an off-by-one had printed `set -euo pipefail`).
usage() {
  cat <<'USAGE'
career-ops-ui — unified CLI dispatcher (AutoResearchClaw-style).

  career-ops-ui setup    → one-command bootstrap (bin/setup.sh)
  career-ops-ui init     → choose LLM provider + set its key (interactive)
  career-ops-ui doctor   → verify env/tooling/keys (reuses /api/health)
  career-ops-ui run      → launch the server (bin/start.sh)
  career-ops-ui open     → open + RAISE the dashboard in your browser
  career-ops-ui help     → this text

One command does the whole chain: `setup` runs install → doctor →
(unless SKIP_START=1) run. Every verb is also usable standalone.
USAGE
}

case "$VERB" in
  setup)
    bash "$SCRIPT_DIR/setup.sh" "$@"
    ;;
  run|start)
    bash "$SCRIPT_DIR/start.sh" "$@"
    ;;
  doctor)
    node "$WEB_UI/scripts/doctor.mjs" "$@"
    ;;
  init)
    node "$WEB_UI/scripts/init.mjs" "$@"
    ;;
  open|dash|focus)
    node "$WEB_UI/scripts/open-dashboard.mjs" "$@"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "unknown verb: $VERB" >&2
    usage >&2
    exit 2
    ;;
esac
