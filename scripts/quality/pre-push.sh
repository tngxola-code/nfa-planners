#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo
echo "NFA PRE-PUSH QUALITY GATE"
echo "========================="
echo

echo "[1/2] Running pre-commit quality gate"
echo

if ! ./scripts/quality/pre-commit.sh; then
  echo
  echo "-------------------------------------------"
  echo "PRE-PUSH QUALITY GATE FAILED"
  echo "Pre-commit quality gate failed."
  echo "Push blocked."
  echo "-------------------------------------------"
  exit 1
fi

echo
echo "[2/2] End-to-end authentication tests"

if [[ -z "${E2E_ADMIN_EMAIL:-}" || -z "${E2E_ADMIN_PASSWORD:-}" ]]; then
  echo
  echo "FAILED"
  echo "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required."
  echo
  echo "Example:"
  echo "export E2E_ADMIN_EMAIL='your-email'"
  echo "export E2E_ADMIN_PASSWORD='your-password'"
  echo
  echo "-------------------------------------------"
  echo "PRE-PUSH QUALITY GATE FAILED"
  echo "Push blocked."
  echo "-------------------------------------------"
  exit 1
fi

if ! npm run test:e2e; then
  echo
  echo "FAILED"
  echo "End-to-end tests failed."
  echo
  echo "-------------------------------------------"
  echo "PRE-PUSH QUALITY GATE FAILED"
  echo "Push blocked."
  echo "-------------------------------------------"
  exit 1
fi

echo "PASS"

echo
echo "-------------------------------------------"
echo "PRE-PUSH QUALITY GATE PASSED"
echo "Push allowed."
echo "-------------------------------------------"
