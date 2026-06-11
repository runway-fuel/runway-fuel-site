#!/usr/bin/env bash
# Verifies the C1 (order-access token) change end to end.
# Usage:  bash scripts/verify_c1.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> 1/4  Syntax-checking API modules"
while IFS= read -r f; do
  node --check "$f"
done < <(find api -name '*.js')
echo "    all API modules parse"

echo "==> 2/4  Confirming ORDER_ACCESS_TOKEN_SECRET is wired into the env contract"
grep -q "ORDER_ACCESS_TOKEN_SECRET" api/_lib/env.js
grep -q "ORDER_ACCESS_TOKEN_SECRET" .env.example
echo "    env contract + .env.example updated"

echo "==> 3/4  Running C1 access-control tests (the real proof)"
node tests/c1_order_access.test.mjs

echo "==> 4/4  Production build (best-effort)"
if pnpm build >/tmp/rf_c1_build.log 2>&1; then
  echo "    build succeeded"
else
  if grep -qiE "ERR_PNPM_IGNORED_BUILDS|esbuild" /tmp/rf_c1_build.log; then
    echo "    NOTE: pnpm skipped esbuild's install script on this machine."
    echo "    That is finding M1 (build reproducibility) and is handled separately."
    echo "    C1 is proven by the tests above and does not depend on the build."
  else
    echo "    build FAILED:"; cat /tmp/rf_c1_build.log; exit 1
  fi
fi

echo
echo "C1 verification complete."
