#!/usr/bin/env bash
set -euo pipefail

rg "export async function POST" phase1/src/app/api/chat/route.ts >/dev/null
rg "text/event-stream" phase1/src/app/api/chat/route.ts >/dev/null
rg "application/pdf" phase1/src/app/api/upload/route.ts >/dev/null
rg "invalid_format" phase1/src/app/api/upload/route.ts >/dev/null
rg "invalid_format" phase1/src/app/api/chat/route.ts >/dev/null
rg "invalid_format" phase1/src/app/api/sessions/route.ts >/dev/null
rg "invalid_format" phase1/src/app/api/sessions/\[id\]/route.ts >/dev/null
rg "field: 'before'" phase1/src/app/api/sessions/\[id\]/route.ts >/dev/null
rg "invalid_format" phase1/src/app/api/documents/\[id\]/route.ts >/dev/null
rg "export const isUuid" phase1/src/lib/validation.ts >/dev/null
rg "mapProviderStatusToApiError" phase1/src/lib/http.ts >/dev/null
rg "create table if not exists sessions" phase1/supabase/migrations/20260507_001_init_phase1.sql >/dev/null

echo "api_contract_smoke: ok"
