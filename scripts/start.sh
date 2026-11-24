#!/bin/sh
set -e

echo "========================================================================"
echo "  DocMate AI — Production Startup"
echo "========================================================================"

# Run database migrations with resilience
echo "Executing database migrations..."
if node scripts/migrate.mjs; then
  echo "✓ Migrations completed successfully."
else
  echo "⚠️ Database migration exited with a warning. Proceeding to launch web server in resilient mode..."
fi

echo "Starting DocMate AI Next.js production server on port ${PORT:-3000}..."
exec node_modules/.bin/next start
