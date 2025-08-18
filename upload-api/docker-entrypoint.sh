#!/bin/sh
set -e

# Fix permissions for extracted_files volume at runtime
chown -R nodeapp:nodeapp /app/extracted_files

exec "$@"