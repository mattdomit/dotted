#!/bin/bash
FNM_NODE=/root/.local/share/fnm/node-versions/v20.20.0/installation/bin
export PATH="$FNM_NODE:$PATH"
echo "Node: $(node --version)"

service postgresql start 2>/dev/null

# Start API in background
echo "=== Starting API on :4000 ==="
cd /root/dotted/apps/api
DATABASE_URL="postgresql://dotted:dotted@localhost:5432/dotted?schema=public" \
  npx tsx src/index.ts > /tmp/api.log 2>&1 &
API_PID=$!
sleep 4

# Verify API is up
if curl -sf http://localhost:4000/api/health > /dev/null 2>&1; then
  echo "API: OK (pid $API_PID)"
else
  echo "API: FAILED to start"
  cat /tmp/api.log
  exit 1
fi

# Build and start web app
echo "=== Building and starting Web on :3000 ==="
cd /root/dotted/apps/web
npx next dev -p 3000 2>&1 &
WEB_PID=$!

echo "Web PID: $WEB_PID"
echo "API PID: $API_PID"
echo ""
echo "Web app starting at http://localhost:3000"
echo "API running at http://localhost:4000"
echo "Press Ctrl+C to stop both"

trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait
