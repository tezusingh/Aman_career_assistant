#!/usr/bin/env bash
# bootstrap.sh — one-time setup on a fresh machine (macOS / Linux).
# Run from the repo root:  ./bootstrap.sh
#
# It will:
#   1. Create local .env files from templates (if missing) — you paste keys after.
#   2. Install Node dependencies for career-ops and its web-ui.
#   3. Tell you what to do next (keys + Docker + launch).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

copy_env_if_missing() {
  if [ -f "$2" ]; then
    echo "  kept existing $2"
  else
    cp "$1" "$2"
    echo "  created $2 (paste your keys)"
  fi
}

echo "== 1/3  Local env files =="
copy_env_if_missing "$ROOT/setup/env/career-ops.env.template" "$ROOT/career-ops/.env"
copy_env_if_missing "$ROOT/setup/env/job-ops.env.template"    "$ROOT/job-ops/.env"

echo "== 2/3  Installing Node dependencies =="
( cd "$ROOT/career-ops"        && npm install )
( cd "$ROOT/career-ops/web-ui" && npm install )

cat <<'EOF'
== 3/3  Next steps ==

  1. Paste your API keys into:
       career-ops/.env      (ANTHROPIC_API_KEY and/or OPENAI_API_KEY)
       job-ops/.env         (same keys)
  2. Put your real resume into  career-ops/cv.md  and edit  career-ops/config/profile.yml
  3. (JobOps) On a machine WITH Docker:
       cd job-ops && docker compose up -d      ->  http://localhost:3005
  4. Launch the career-ops web-ui:
       cd career-ops/web-ui && node server/index.mjs   ->  http://localhost:4317
  5. Pull JobOps' scored jobs into career-ops any time:
       node pipeline/import-jobs.mjs --min-score 70

Bootstrap complete.
EOF
