#!/usr/bin/env bash
# Start the web dev server (Vite on 127.0.0.1:5173).

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
ROOT="$(dev_repo_root)"
cd "${ROOT}"

if ! test -f apps/web/.env.local; then
  if test -f apps/web/.env.local.example; then
    cp apps/web/.env.local.example apps/web/.env.local
    echo "Created apps/web/.env.local from .env.local.example"
  fi
fi

echo "Starting web dev server at http://127.0.0.1:5173"
echo "Bridge health (when bridge is up): curl -sS http://127.0.0.1:17890/health"
echo

exec pnpm --filter @microdent/web run dev
