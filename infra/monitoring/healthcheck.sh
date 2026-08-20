#!/bin/bash
# Quick health check for Kairacure stack
API_URL="${API_URL:-http://kairacure-api-alb-1564771128.ap-south-1.elb.amazonaws.com}"

echo "=== Kairacure Health Check ==="
echo "Time: $(date -u)"

# API Health
HEALTH=$(curl -s --connect-timeout 5 --max-time 10 "$API_URL/api/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"ok"'; then
  echo "API: OK"
  echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
  echo "API: FAILED"
  echo "$HEALTH"
fi

# Frontend check
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://kairacure-web-prod.s3-website.ap-south-1.amazonaws.com/" 2>/dev/null)
echo "Web Frontend: $WEB_STATUS"

ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://kairacure-admin-prod.s3-website.ap-south-1.amazonaws.com/" 2>/dev/null)
echo "Admin Frontend: $ADMIN_STATUS"
