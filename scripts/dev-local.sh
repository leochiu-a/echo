#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN="${DEV_LOCAL_DRY_RUN:-0}"

run_or_echo() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dev-local] dry-run: $*"
    return
  fi
  exec "$@"
}

if [[ ! -f "package.json" ]]; then
  echo "[dev-local] package.json not found."
  echo "[dev-local] this repository no longer includes legacy fallback mode."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[dev-local] npm is required for Electron dev mode but was not found."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[dev-local] node is required for Electron dev mode but was not found."
  exit 1
fi

if ! node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));process.exit(p.scripts&&p.scripts.dev?0:1)'; then
  echo "[dev-local] package.json has no scripts.dev."
  exit 1
fi

if [[ ! -d "node_modules" ]]; then
  echo "[dev-local] node_modules not found; running npm install..."
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dev-local] dry-run: npm install"
  else
    npm install
  fi
fi

echo "[dev-local] starting Electron dev mode (npm run dev)"
run_or_echo npm run dev
