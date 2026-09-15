#!/usr/bin/env bash
set -euo pipefail

HQ_URL="${HQ_URL:-http://localhost:3000}"
AGENT_TOKEN="${AGENT_HQ_TOKEN:?Register the agent in the authenticated dashboard and set AGENT_HQ_TOKEN}"
EVENT_ID="${EVENT_ID:?Set a unique retry-stable EVENT_ID}"

curl -sS "$HQ_URL/api/v1/events" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -d "{\"eventId\":\"$EVENT_ID\",\"type\":\"heartbeat\",\"message\":\"Runtime is online\"}"
