#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy all Anna edge functions to Supabase
#
# One-time setup:
#   1. Go to https://supabase.com/dashboard/account/tokens
#   2. Create a new token and copy it
#   3. Run:  export SUPABASE_ACCESS_TOKEN=sbp_xxxxx
#   4. Then: bash deploy-functions.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_REF="rxjcxbbdyewerpeeljjz"
FUNCTIONS=("check-availability" "book-reservation" "lookup-reservation" "modify-reservation" "cancel-reservation")

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is not set."
  echo ""
  echo "Get yours at: https://supabase.com/dashboard/account/tokens"
  echo "Then run:     export SUPABASE_ACCESS_TOKEN=sbp_xxxxx"
  echo "              bash deploy-functions.sh"
  exit 1
fi

echo "Deploying to project: $PROJECT_REF"
echo ""

for fn in "${FUNCTIONS[@]}"; do
  echo "→ Deploying $fn..."
  supabase functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt
  echo "  ✓ $fn deployed"
  echo ""
done

echo "All functions deployed."
echo ""
echo "Your function URLs:"
for fn in "${FUNCTIONS[@]}"; do
  echo "  https://$PROJECT_REF.supabase.co/functions/v1/$fn?rid=<restaurant_uuid>"
done
