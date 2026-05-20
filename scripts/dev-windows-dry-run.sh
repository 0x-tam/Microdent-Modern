#!/usr/bin/env bash
# Dev dry-run for Windows pilot packaging (macOS/Linux). No qa:sandbox unless env set.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[dev-windows-dry-run] desktop tests"
pnpm --filter @microdent/desktop run test

echo "[dev-windows-dry-run] bridge + web + desktop build"
pnpm --filter @microdent/bridge run build
pnpm build:web
pnpm --filter @microdent/desktop run build

echo "[dev-windows-dry-run] release-smoke"
pnpm --filter @microdent/desktop run release-smoke

echo "[dev-windows-dry-run] stage + verify"
pnpm stage:pilot-release
pnpm pilot:verify-release

if [[ -n "${DATA_ROOT:-}" && -n "${SQLITE_PATH:-}" ]]; then
  echo "[dev-windows-dry-run] sandbox env detected — running qa:sandbox"
  pnpm qa:sandbox
else
  echo "[dev-windows-dry-run] skip qa:sandbox (set DATA_ROOT + SQLITE_PATH to include)"
fi

echo "[dev-windows-dry-run] complete"
