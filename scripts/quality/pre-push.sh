#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo
echo "NFA PRE-PUSH QUALITY GATE"
echo "========================="
echo

echo "[1/4] Repository quality contract"

if ! npm run ci:verify; then
  echo
  echo "FAILED"
  echo "Repository quality contract failed."
  echo "Push blocked."
  exit 1
fi

echo "PASS"
echo

echo "[2/4] E2E configuration"

if [[ -z "${E2E_ADMIN_EMAIL:-}" || -z "${E2E_ADMIN_PASSWORD:-}" ]]; then
  echo
  echo "FAILED"
  echo "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required."
  echo "Push blocked."
  exit 1
fi

if [[ -z "${E2E_DATABASE_URL:-}" ]]; then
  if [[ ! -f backend/.env ]]; then
    echo
    echo "FAILED"
    echo "backend/.env does not exist and E2E_DATABASE_URL is not set."
    echo "Push blocked."
    exit 1
  fi

  E2E_DATABASE_URL="$(
    node <<'NODE'
const fs = require('fs');

const text = fs.readFileSync('backend/.env', 'utf8');

const line = text
  .split(/\r?\n/)
  .find(line => line.trim().startsWith('DATABASE_URL='));

if (!line) {
  process.exit(1);
}

let value = line
  .trim()
  .slice('DATABASE_URL='.length)
  .trim();

if (
  (value.startsWith('"') && value.endsWith('"')) ||
  (value.startsWith("'") && value.endsWith("'"))
) {
  value = value.slice(1, -1);
}

process.stdout.write(value);
NODE
  )"
fi

if [[ -z "${E2E_DATABASE_URL:-}" ]]; then
  echo
  echo "FAILED"
  echo "Could not resolve E2E_DATABASE_URL."
  echo "Push blocked."
  exit 1
fi

export E2E_DATABASE_URL

echo "E2E credentials: configured"
echo "E2E database: configured"
echo "PASS"
echo

echo "[3/4] E2E database readiness"

ROOT_DIR="$(git rev-parse --show-toplevel)"

if ! DATABASE_URL="$E2E_DATABASE_URL" npx prisma migrate deploy --config "$ROOT_DIR/prisma.config.ts"; then
  echo
  echo "FAILED"
  echo "E2E database migration failed."
  echo "Push blocked."
  exit 1
fi

if ! (
  cd backend
  DATABASE_URL="$E2E_DATABASE_URL" npx tsx src/checkDb.ts
); then
  echo
  echo "FAILED"
  echo "E2E database schema verification failed."
  echo "Push blocked."
  exit 1
fi

echo "PASS"
echo

echo "[4/4] End-to-end authentication tests"

if ! npm run test:e2e; then
  echo
  echo "FAILED"
  echo "End-to-end tests failed."
  echo "Push blocked."
  exit 1
fi

echo "PASS"
