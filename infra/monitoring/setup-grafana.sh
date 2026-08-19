#!/bin/bash
# Grafana Cloud Setup for Kairacure
# Run this after creating a Grafana Cloud account at https://grafana.com/signup

set -euo pipefail

GRAFANA_CLOUD_URL="${GRAFANA_CLOUD_URL:-}"
GRAFANA_API_KEY="${GRAFANA_API_KEY:-}"

if [ -z "$GRAFANA_CLOUD_URL" ] || [ -z "$GRAFANA_API_KEY" ]; then
  echo "Usage: GRAFANA_CLOUD_URL=https://xxx.grafana.net GRAFANA_API_KEY=xxx ./setup-grafana.sh"
  echo ""
  echo "Steps:"
  echo "1. Go to https://grafana.com/signup"
  echo "2. Create a free account"
  echo "3. Go to Grafana Cloud Portal > Grafana > Send Metrics"
  echo "4. Get your CloudWatch data source URL and API key"
  echo "5. Run this script with those values"
  exit 1
fi

echo "Configuring Grafana Cloud..."
echo "Grafana URL: $GRAFANA_CLOUD_URL"
echo ""
echo "Manual steps needed:"
echo "1. In Grafana Cloud, go to Connections > Data Sources > Add CloudWatch"
echo "2. Set AWS region to ap-south-1"
echo "3. Use the EC2 instance role (kairacure-ec2-role) for authentication"
echo "4. Import the dashboard from infra/monitoring/kairacure-dashboard.json"
echo ""
echo "Dashboard will show:"
echo "- API response time"
echo "- Error rates (5xx)"
echo "- CPU/Memory/Disk usage"
echo "- MongoDB connections"
echo "- Request rate"
