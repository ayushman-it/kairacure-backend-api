#!/bin/bash
set -euo pipefail

# Kairacure .env Generator
# Generates the .env file from AWS Secrets Manager
# Run on the EC2 instance after bootstrap

REGION="ap-south-1"
SECRET_ID="kairacure/prod/env"
ENV_FILE="/opt/kairacure/kairacure-backend-api/.env"

echo "Fetching environment variables from Secrets Manager..."

SECRET_JSON=$(aws secretsmanager get-secret-value \
  --region "$REGION" \
  --secret-id "$SECRET_ID" \
  --query SecretString \
  --output text)

if [ -z "$SECRET_JSON" ]; then
  echo "ERROR: Failed to fetch secret from Secrets Manager"
  exit 1
fi

cat > "$ENV_FILE" << ENVEOF
# Kairacure Environment Configuration
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# Source: AWS Secrets Manager ($SECRET_ID)

# MongoDB
MONGODB_URI=$(echo "$SECRET_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin).get('MONGODB_URI',''))")

# JWT
JWT_SECRET=$(echo "$SECRET_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin).get('JWT_SECRET',''))")

# Email
SMTP_HOST=$(echo "$SECRET_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin).get('SMTP_HOST',''))")
SMTP_PORT=$(echo "$SECRET_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin).get('SMTP_PORT',''))")
SMTP_USER=$(echo "$SECRET_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin).get('SMTP_USER',''))")
SMTP_PASS=$(echo "$SECRET_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin).get('SMTP_PASS',''))")

# App
NODE_ENV=production
PORT=5000
AWS_REGION=$REGION
ENVEOF

chmod 600 "$ENV_FILE"
echo ".env created at $ENV_FILE"
