#!/bin/bash
# Start the Dotted API server from WSL
# Usage: wsl bash /mnt/c/Users/mdomit/Desktop/code/dotted/start-api.sh

export PATH="/root/.local/share/fnm:$PATH"
eval "$(fnm env)"

# Ensure PostgreSQL is running
service postgresql start 2>/dev/null

cd /root/dotted/apps/api
DATABASE_URL="postgresql://dotted:dotted@localhost:5432/dotted?schema=public" \
  npx tsx src/index.ts
