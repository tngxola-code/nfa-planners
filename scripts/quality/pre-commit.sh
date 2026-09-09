#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo
echo "NFA PRE-COMMIT QUALITY GATE"
echo "==========================="
echo

echo "[1/6] Secret / environment-file check"

FORBIDDEN_ENV_FILES="$(
  git diff --cached --name-only |
    grep -E '(^|/)\.env($|\.)' |
    grep -Ev '(^|/)\.env\.example$|(^|/)\.env\.(local|development|production|test)\.example$' ||
    true
)"

if [[ -n "$FORBIDDEN_ENV_FILES" ]]; then
  echo
  echo "FAILED"
  echo "Environment file is staged:"
  echo "$FORBIDDEN_ENV_FILES"
  echo
  echo "QUALITY GATE FAILED"
  echo "Commit blocked."
  exit 1
fi

STAGED_ADDITIONS="$(
  git diff --cached --unified=0 -- . \
    ':!package-lock.json' \
    ':!frontend/package-lock.json' \
    ':!backend/package-lock.json' |
    grep '^+' |
    grep -v '^+++' ||
    true
)"

if printf '%s\n' "$STAGED_ADDITIONS" |
  grep -Eiq '(password123|super_secret_key|zurcuK|E2E_ADMIN_PASSWORD[[:space:]]*=[[:space:]]*[^<[:space:]]+|JWT_SECRET[[:space:]]*=[[:space:]]*[^<[:space:]]+)'
then
  echo
  echo "FAILED"
  echo "Potential secret detected in staged additions."
  echo
  echo "QUALITY GATE FAILED"
  echo "Commit blocked."
  exit 1
fi

echo "PASS"
echo

echo "[2/6] Temporary / debug endpoint check"

if find frontend/app/api \
  -path '*debug-auth*' \
  -print 2>/dev/null |
  grep -q .
then
  echo
  echo "FAILED"
  echo "Temporary debug authentication endpoint exists."
  echo
  echo "QUALITY GATE FAILED"
  echo "Commit blocked."
  exit 1
fi

echo "PASS"
echo

echo "[3/6] Backend tests"

npm --prefix backend test

echo "PASS"
echo

echo "[4/6] Frontend tests"

npm --prefix frontend test

echo "PASS"
echo

echo "[5/6] Backend production build"

npm run build:backend

echo "PASS"
echo

echo "[6/6] Frontend production build"

npm run build:frontend

echo "PASS"
echo

echo "-------------------------------------------"
echo "PRE-COMMIT QUALITY GATE PASSED"
echo "Commit allowed."
echo "-------------------------------------------"
