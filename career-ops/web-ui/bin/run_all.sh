#!/usr/bin/env bash
# career-ops-ui — single entrypoint that runs every test suite the
# project ships with.
#
# Why a script and not a single npm command? Because we ship four
# different test surfaces (unit/integration, smoke E2E, comprehensive
# E2E, Playwright browser) and each fails differently — a `&&` chain
# would skip later suites whenever an earlier one breaks. This wrapper
# runs all four no matter what, summarizes results at the end, and
# exits non-zero if anything failed.
#
# Usage:
#   bash bin/run_all.sh          # run everything against this checkout
#   bash bin/run_all.sh --quick  # only unit/integration + Playwright smoke
#   bash bin/run_all.sh --no-e2e # skip the long comprehensive E2E
#
# Environment knobs:
#   PORT            override server port for E2E suites (default 4317)
#   CAREER_OPS_ROOT point at a parent project; tests build their own
#                   throwaway fixture if unset, so this is rarely needed
#
# Exit code: 0 only if every selected suite passed.

set -u

# ─── Argument parsing ──────────────────────────────────────────────────
QUICK=0
SKIP_E2E=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --no-e2e) SKIP_E2E=1 ;;
    -h|--help)
      # Print the leading comment block as the help text — strips
      # the shebang and the closing "set -u" line.
      awk 'NR>1 && /^[^#]/ { exit } NR>1 { sub(/^# ?/, ""); print }' "$0"
      exit 0
      ;;
    *)
      echo "unknown flag: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

# ─── Locate repo root regardless of where we were invoked from ────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

bold()  { printf "\033[1m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
dim()   { printf "\033[2m%s\033[0m\n" "$1"; }

bold ""
bold "  career-ops-ui — full test sweep"
bold "  ────────────────────────────────"
dim   "  repo:  $REPO_ROOT"
dim   "  node:  $(node -v 2>/dev/null || echo 'NOT FOUND')"
dim   "  npm:   $(npm -v 2>/dev/null || echo 'NOT FOUND')"
[ "$QUICK" = "1" ]    && dim   "  mode:  quick (skip e2e + comprehensive)"
[ "$SKIP_E2E" = "1" ] && dim   "  mode:  --no-e2e (skip comprehensive E2E)"
echo  ""

# Refuse to run when node_modules is missing — we rely on Express + js-yaml.
if [ ! -d node_modules ]; then
  red "  node_modules missing. Run: npm install --no-audit --no-fund"
  exit 1
fi

declare -a SUITE_NAMES=()
declare -a SUITE_RC=()
declare -a SUITE_LOG=()

run_suite() {
  local name="$1"
  shift
  bold "── $name"
  local logfile
  logfile="$(mktemp -t cou-runall-XXXXXX)"
  set +e
  "$@" 2>&1 | tee "$logfile"
  local rc=${PIPESTATUS[0]}
  set -e
  SUITE_NAMES+=("$name")
  SUITE_RC+=("$rc")
  SUITE_LOG+=("$logfile")
  echo ""
}

# ─── 1. Unit + integration via node:test ──────────────────────────────
# Always runs. Fast (~7-18 s for 474+ tests on a recent macbook).
run_suite "unit + integration"             npm test --silent

# ─── 2. Playwright browser tests (smoke + lifecycle) ──────────────────
# Skipped automatically inside the test files when Playwright isn't
# resolvable (parent's node_modules missing). Counts as success then.
run_suite "playwright browser (smoke + lifecycle)" \
  npm run test:e2e:browser --silent

# ─── 3. Smoke E2E (Express + Chromium, full SPA flow) ─────────────────
if [ "$QUICK" = "0" ]; then
  run_suite "smoke E2E (UI flows)"          npm run test:e2e --silent
fi

# ─── 4. Comprehensive E2E (long; covers every route + screenshot) ─────
if [ "$QUICK" = "0" ] && [ "$SKIP_E2E" = "0" ]; then
  run_suite "comprehensive E2E"             npm run test:e2e:full --silent
fi

# ─── Summary ───────────────────────────────────────────────────────────
echo ""
bold "  Summary"
bold "  ───────"

total=0
fails=0
for i in "${!SUITE_NAMES[@]}"; do
  total=$((total + 1))
  if [ "${SUITE_RC[$i]}" = "0" ]; then
    green "  ✓ ${SUITE_NAMES[$i]}"
  else
    red   "  ✗ ${SUITE_NAMES[$i]}  (exit ${SUITE_RC[$i]}; full log: ${SUITE_LOG[$i]})"
    fails=$((fails + 1))
  fi
done

echo ""
if [ "$fails" -eq 0 ]; then
  green "  All $total suite(s) passed."
  exit 0
else
  red   "  $fails of $total suite(s) failed."
  exit 1
fi
