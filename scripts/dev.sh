#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_PID=""

stop_app() {
  if [[ -n "${APP_PID:-}" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    echo "[dev] stopping app pid=$APP_PID"
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  APP_PID=""
}

launch_app() {
  echo "[dev] launching .build/debug/EchoCopilot"
  ./.build/debug/EchoCopilot &
  APP_PID=$!
  echo "[dev] app pid=$APP_PID"
}

build_and_reload() {
  echo "[dev] building..."
  if swift build; then
    stop_app
    launch_app
  else
    echo "[dev] build failed; keeping previous app process."
  fi
}

fingerprint() {
  {
    stat -f "%m %N" Package.swift
    find Sources -type f -name "*.swift" -print0 | xargs -0 stat -f "%m %N"
  } | shasum | awk '{print $1}'
}

trap stop_app EXIT INT TERM

last_fingerprint="$(fingerprint)"
build_and_reload

echo "[dev] watching for changes..."
while true; do
  sleep 1
  current_fingerprint="$(fingerprint)"
  if [[ "$current_fingerprint" != "$last_fingerprint" ]]; then
    last_fingerprint="$current_fingerprint"
    echo "[dev] change detected"
    build_and_reload
  fi
done
