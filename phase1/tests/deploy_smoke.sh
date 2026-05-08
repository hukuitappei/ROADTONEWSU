#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DEMO_URL:-}" ]]; then
  echo "ERROR: DEMO_URL is required (e.g. https://your-app.vercel.app)" >&2
  exit 1
fi

BASE="${DEMO_URL%/}"

check() {
  local path="$1"
  local expected="$2"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE$path")
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL $path expected=$expected actual=$code" >&2
    exit 1
  fi
  echo "PASS $path -> $code"
}

# Public routes
check "/upload" "200"

# API contract smoke (unauthenticated or invalid payload responses)
check "/api/sessions" "400"
check "/api/chat" "405"
check "/api/upload" "405"

echo "Deployment smoke checks completed for $BASE"
