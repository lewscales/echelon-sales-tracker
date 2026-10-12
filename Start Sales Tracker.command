#!/bin/bash
# Double-click this file to launch the Echelon Sales Tracker on this Mac.
# First run installs everything and loads demo data; after that it just starts.
cd "$(dirname "$0")" || exit 1

echo "──────────────────────────────────────────"
echo "  Starting Echelon Sales Tracker…"
echo "──────────────────────────────────────────"

if [ ! -d "node_modules" ]; then
  echo "First run: installing (one-time, ~1 min)…"
  npm install
fi
if [ ! -f "prisma/dev.db" ]; then
  echo "Setting up the database with demo data…"
  npx prisma db push --skip-generate && npm run db:seed
fi
if [ ! -d ".next" ]; then
  echo "Building the app (one-time)…"
  npm run build
fi

# Stop an older copy if one is still running.
lsof -ti:3002 | xargs kill 2>/dev/null

(sleep 4 && open "http://localhost:3002") &
echo ""
echo "  Open http://localhost:3002 and log in with: $(grep '^ADMIN_CODE=' .env | cut -d= -f2)"
echo "  Keep this window open while you use it. Close it to stop."
echo ""
npm run start
