#!/usr/bin/env bash
# Test board scrapers — see test-site-scrapers.ps1 for usage.
set -euo pipefail

SITE="${1:-all}"
LIMIT="${2:-2}"
PROJECT_URL="${SUPABASE_URL:-https://eqkctzjyqmafpytvdepf.supabase.co}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$KEY" ]]; then
  echo "Set SUPABASE_SERVICE_ROLE_KEY (service_role eyJ... from Supabase API settings)"
  exit 1
fi
if [[ "$KEY" == sb_publishable_* ]]; then
  echo "Use service_role JWT, not sb_publishable_*"
  exit 1
fi

PROJECT_URL="${PROJECT_URL%/}"
BODY="{\"limit\":$LIMIT}"
OUT_DIR="$(dirname "$0")/scraper-test-results"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

invoke() {
  local fn="$1"
  local url="$PROJECT_URL/functions/v1/$fn"
  if [[ "$fn" != "scrape-all-sites" ]]; then
    url="${url}?limit=${LIMIT}"
  fi
  echo ""
  echo "POST $url"
  local out="$OUT_DIR/${STAMP}-${fn}.json"
  local code
  code=$(curl -s -o "$out" -w "%{http_code}" -X POST "$url" \
    -H "Authorization: Bearer $KEY" \
    -H "apikey: $KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY")
  echo "HTTP $code → $out"
  cat "$out"
  echo ""
  [[ "$code" == "200" ]]
}

case "$SITE" in
  all) invoke scrape-all-sites ;;
  fuzu) invoke scrape-fuzu ;;
  brightermonday) invoke scrape-brightermonday ;;
  myjobmag) invoke scrape-myjobmag ;;
  myjobsinkenya) invoke scrape-myjobsinkenya ;;
  linkedin) invoke scrape-linkedin ;;
  *)
    echo "Usage: $0 [all|fuzu|brightermonday|myjobmag|myjobsinkenya|linkedin] [limit]"
    exit 1
    ;;
esac
