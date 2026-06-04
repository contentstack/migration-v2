#!/bin/sh
set -e

# Fix permissions for extracted_files volume at runtime (runs as root)
chown -R nodeapp:nodeapp /app/extracted_files || true

# Apply Docker/env overrides to src/config/index.json before the app starts
if [ -f /app/package.json ]; then
  cd /app
  npx ts-node --transpile-only -r dotenv/config scripts/hydrate-config.ts || {
    echo "hydrate-config failed" >&2
    exit 1
  }
fi

# Drop to nodeapp user for the main process
exec su-exec nodeapp "$@"