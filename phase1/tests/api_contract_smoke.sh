#!/usr/bin/env bash
set -euo pipefail

# 補助チェック: 詳細な契約検証は tests/api_contract/ 配下のテストで実施
rg "route_handlers\.contract\.test\.ts" phase1/tests/api_contract/README.md >/dev/null
rg "invalid_json" phase1/tests/api_contract/route_handlers.contract.test.ts >/dev/null
rg "invalid_mime" phase1/tests/api_contract/route_handlers.contract.test.ts >/dev/null
rg "invalid_range" phase1/tests/api_contract/route_handlers.contract.test.ts >/dev/null
rg "provider 429" phase1/tests/api_contract/route_handlers.contract.test.ts >/dev/null
rg "provider 5xx" phase1/tests/api_contract/route_handlers.contract.test.ts >/dev/null

echo "api_contract_smoke (supplemental): ok"
