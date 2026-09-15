#!/usr/bin/env bash
set -euo pipefail

HQ_URL="${HQ_URL:-http://localhost:3000}"
ADMIN_SECRET="${AGENT_ADMIN_SECRET:?Set AGENT_ADMIN_SECRET}"

curl -sS "$HQ_URL/api/agents/register" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{
    "slug": "spanish-assistant",
    "name": "Spanish Assistant",
    "description": "Spanish assistant for school",
    "capabilities": ["homework","grammar","translation","study"]
  }'
