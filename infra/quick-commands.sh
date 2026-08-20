#!/bin/bash
# Kairacure Quick Commands
# Usage: ./quick-commands.sh <command>

set -euo pipefail
REGION="ap-south-1"
INSTANCE="i-048117c391049faa7"
ALB="kairacure-api-alb-1564771128.ap-south-1.elb.amazonaws.com"

case "${1:-help}" in
  health)
    curl -sk "https://$ALB/api/health" | python3 -m json.tool
    ;;
  logs)
    aws logs tail /kairacure/api --since "${2:-1h}" --region $REGION
    ;;
  status)
    aws ec2 describe-instances --region $REGION --instance-ids $INSTANCE --query 'Reservations[0].Instances[0].{State:State.Name,IP:PrivateIpAddress,Uptime:LaunchTime}' --output table
    ;;
  ssh)
    aws ssm start-session --region $REGION --target $INSTANCE
    ;;
  pm2)
    aws ssm send-command --region $REGION --instance-ids $INSTANCE --document-name "AWS-RunShellScript" --parameters "commands=[\"pm2 status\"]" --output text
    ;;
  alarms)
    aws cloudwatch describe-alarms --region $REGION --alarm-name-prefix kairacure --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue}' --output table
    ;;
  backups)
    aws s3 ls s3://kairacure-backups-prod/mongodb/ --region $REGION --human-readable
    ;;
  deploy)
    echo "Zipping and uploading..."
    cd "$(dirname "$0")/.."
    zip -r /tmp/backend.zip kairacure-backend-api/ -x "kairacure-backend-api/node_modules/*"
    aws s3 cp /tmp/backend.zip s3://kairacure-artifacts-prod/backend/latest.zip --region $REGION
    echo "Uploaded. Deploy via SSM session:"
    echo "  aws ssm start-session --region $REGION --target $INSTANCE"
    echo "  cd /opt/kairacure/kairacure-backend-api && unzip -o /tmp/latest.zip -d /opt/kairacure/ && cp .env.backup .env && npm install --production && pm2 restart kairacure-api"
    ;;
  *)
    echo "Usage: $0 {health|logs|status|ssh|pm2|alarms|backups|deploy}"
    echo ""
    echo "Commands:"
    echo "  health  - Check API health"
    echo "  logs    - View API logs (optional: logs 2h)"
    echo "  status  - Check EC2 status"
    echo "  ssh     - SSH via SSM"
    echo "  pm2     - Check PM2 status"
    echo "  alarms  - Check CloudWatch alarms"
    echo "  backups - List MongoDB backups"
    echo "  deploy  - Deploy latest code"
    ;;
esac
