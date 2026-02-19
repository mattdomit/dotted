#!/bin/bash
FNM_NODE=/root/.local/share/fnm/node-versions/v20.20.0/installation/bin
export PATH="$FNM_NODE:$PATH"
export PGPASSWORD=dotted
echo "Node: $(node --version)"

service postgresql start 2>/dev/null

echo ""
echo "=== Database check ==="
psql -U dotted -d dotted -h 127.0.0.1 -c "SELECT COUNT(*) as users FROM users;"
psql -U dotted -d dotted -h 127.0.0.1 -c "SELECT COUNT(*) as zones FROM zones;"
psql -U dotted -d dotted -h 127.0.0.1 -c "SELECT COUNT(*) as inventory FROM supplier_inventory;"

cd /root/dotted/apps/api

echo "=== Build API ==="
npx tsc 2>&1
echo "Build exit code: $?"

echo ""
echo "=== Start API ==="
DATABASE_URL="postgresql://dotted:dotted@localhost:5432/dotted?schema=public" \
  npx tsx src/index.ts > /tmp/api.log 2>&1 &
API_PID=$!
sleep 5

echo ""
echo "=== Test 1: Health ==="
curl -sf http://localhost:4000/api/health
echo ""

echo ""
echo "=== Test 2: Zones ==="
curl -sf http://localhost:4000/api/zones | python3 -c "import sys,json; d=json.load(sys.stdin); print('Zones:', len(d.get('data',[])))" 2>/dev/null || echo "FAILED"

echo ""
echo "=== Test 3: Register new user ==="
curl -sf -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"testrun2@dotted.dev","password":"Test1234!","name":"Test Runner","role":"CONSUMER"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Register:', d.get('success'))" 2>/dev/null || echo "Register: failed or already exists"

echo ""
echo "=== Test 4: Login with seeded user ==="
LOGIN=$(curl -sf -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"consumer1@dotted.local","password":"password123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
if [ -n "$TOKEN" ]; then
  echo "Login: OK"

  echo ""
  echo "=== Test 5: Get /auth/me ==="
  curl -sf http://localhost:4000/api/auth/me -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('Me:', d['name'], '('+d['role']+')')" 2>/dev/null || echo "FAILED"

  echo ""
  echo "=== Test 6: Get today cycle ==="
  ZONE_ID=$(curl -sf http://localhost:4000/api/zones | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null)
  curl -sf "http://localhost:4000/api/cycles/today?zoneId=$ZONE_ID" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('Cycle:', d.get('data') or 'none yet')" 2>/dev/null || echo "No cycle (expected)"

  echo ""
  echo "=== Test 7: Join zone ==="
  curl -sf -X POST "http://localhost:4000/api/zones/$ZONE_ID/join" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('Join zone:', d.get('success'))" 2>/dev/null || echo "Already joined or failed"

  echo ""
  echo "=== Test 8: Login as restaurant owner ==="
  RLOGIN=$(curl -sf -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"restaurant1@dotted.local","password":"password123"}')
  RTOKEN=$(echo "$RLOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
  if [ -n "$RTOKEN" ]; then
    echo "Restaurant login: OK"
  else
    echo "Restaurant login: FAILED"
  fi

  echo ""
  echo "=== Test 9: Login as supplier ==="
  SLOGIN=$(curl -sf -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"supplier1@dotted.local","password":"password123"}')
  STOKEN=$(echo "$SLOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
  if [ -n "$STOKEN" ]; then
    echo "Supplier login: OK"
    echo ""
    echo "=== Test 10: Get supplier inventory ==="
    curl -sf http://localhost:4000/api/suppliers/inventory \
      -H "Authorization: Bearer $STOKEN" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print('Inventory items:', len(items))" 2>/dev/null || echo "FAILED"
  else
    echo "Supplier login: FAILED"
  fi

  echo ""
  echo "=== Test 11: Admin login + analytics ==="
  ALOGIN=$(curl -sf -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@dotted.local","password":"admin123"}')
  ATOKEN=$(echo "$ALOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
  if [ -n "$ATOKEN" ]; then
    echo "Admin login: OK"
    curl -sf http://localhost:4000/api/admin/analytics \
      -H "Authorization: Bearer $ATOKEN" \
      | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('Users:', d['totalUsers'], '| Zones:', d['totalZones'], '| Restaurants:', d['totalRestaurants'], '| Suppliers:', d['totalSuppliers'])" 2>/dev/null || echo "Analytics: FAILED"
  else
    echo "Admin login: FAILED"
  fi
else
  echo "Login: FAILED"
  echo "API logs:"
  cat /tmp/api.log | tail -20
fi

echo ""
echo "========================================="
echo "=== ALL TESTS COMPLETE ==="
echo "========================================="
kill $API_PID 2>/dev/null
wait $API_PID 2>/dev/null
