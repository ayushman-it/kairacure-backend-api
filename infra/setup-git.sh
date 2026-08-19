#!/bin/bash
# Setup git remote and push to GitHub
# Usage: ./setup-git.sh <github-repo-url>
# Example: ./setup-git.sh git@github.com:cynik/Kairacure.git

set -euo pipefail

REPO_URL="${1:-}"

if [ -z "$REPO_URL" ]; then
  echo "Usage: $0 <github-repo-url>"
  echo "Example: $0 git@github.com:cynik/Kairacure.git"
  exit 1
fi

cd /media/cynik/cynik-storage/projects/Kairacure

# Configure git
git config user.email "admin@kairacure.com"
git config user.name "Kairacure Deploy"

# Add remote
git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"

# Stage all files
git add -A

# Commit
git commit -m "Initial production deployment

- Full AWS infrastructure (EC2, ALB, S3, CloudFront-ready)
- Security: Helmet, rate limiting, CORS, XSS protection
- Monitoring: CloudWatch + Grafana Cloud
- CI/CD: GitHub Actions with OIDC
- Backups: Daily MongoDB dumps to S3
- Disaster recovery: ec2-userdata.sh"

# Push
git push -u origin main

echo ""
echo "Repository pushed to: $REPO_URL"
echo "CI/CD will activate automatically on push to main"
