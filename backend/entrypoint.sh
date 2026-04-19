#!/bin/sh
set -e

echo "Factory Dashboard Backend"
echo "=============================="

# Ensure data directory exists
mkdir -p /app/data

PORT=${PORT:-8080}

echo "→ Applying database schema..."
npx prisma db push --skip-generate

echo "→ Checking for existing data..."
WORKER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.worker.count()
  .then(n => { process.stdout.write(String(n)); p.\$disconnect(); })
  .catch(() => { process.stdout.write('0'); });
")

if [ "$WORKER_COUNT" = "0" ]; then
  echo "→ No data found — seeding initial data..."
  node prisma/seed.js
else
  echo "→ Data already exists ($WORKER_COUNT workers) — skipping auto-seed"
  echo "   (Use POST /api/seed to refresh data)"
fi

echo "→ Starting API server on port $PORT..."
exec node src/server.js
