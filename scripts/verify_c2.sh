#!/usr/bin/env bash
# Verifies the C2 (delivery loop) change end to end.
# Usage:  bash scripts/verify_c2.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> 1/4  Syntax-checking API modules + operator CLI"
while IFS= read -r f; do node --check "$f"; done < <(find api -name '*.js')
node --check scripts/deliver.mjs
echo "    all modules parse"

echo "==> 2/4  C1 regression (access tokens still gate get-order)"
node tests/c1_order_access.test.mjs >/dev/null && echo "    C1 OK"

echo "==> 3/4  C2 loop tests (intake auth, notifications, delivery, visibility)"
node tests/c2_delivery_loop.test.mjs

echo "==> 4/4  Production build"
pnpm build >/dev/null
echo "    build succeeded"

echo
echo "C2 verification complete."
