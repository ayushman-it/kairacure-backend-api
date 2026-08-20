# Kairacure Infrastructure - Disaster Recovery

## Overview

This directory contains scripts to rebuild the Kairacure EC2 instance from scratch.

**Instance:** `i-048117c391049faa` | **Region:** `ap-south-1`

## Recovery Procedure

### Prerequisites

- AWS CLI configured with appropriate IAM permissions
- Access to the `kairacure-artifacts-prod` S3 bucket
- Access to Secrets Manager secrets:
  - `kairacure/prod/mongodb` (MongoDB credentials)
  - `kairacure/prod/env` (Application environment variables)

### Step 1: Launch New EC2 Instance

1. Launch a new Ubuntu 22.04 LTS instance (t3.medium or larger)
2. Use the security group from the original instance (allow ports 22 and 5000)
3. Attach an IAM role with access to S3, Secrets Manager, and CloudWatch
4. Paste the contents of `ec2-userdata.sh` as User Data

### Step 2: Wait for Bootstrap

Monitor bootstrap completion:

```bash
# On the new instance
tail -f /var/log/cloud-init-output.log
# or check the bootstrap log
cat /var/log/kairacure-bootstrap.log
```

Bootstrap typically takes 10-15 minutes.

### Step 3: Generate .env File

```bash
cd /opt/kairacure
bash /path/to/generate-env.sh
```

### Step 4: Restart the Application

```bash
cd /opt/kairacure/kairacure-backend-api
pm2 restart ecosystem.config.cjs
pm2 save
```

### Step 5: Verify

1. Check API health: `curl http://localhost:5000/health`
2. Verify MongoDB: `mongosh --eval "db.adminCommand('ping')"`
3. Check CloudWatch logs are flowing
4. Test external access

## Files

| File | Purpose |
|------|---------|
| `ec2-userdata.sh` | Cloud-init bootstrap script for new EC2 instances |
| `generate-env.sh` | Generates `.env` from Secrets Manager |
| `README.md` | This file |

## Secrets Required

| Secret ID | Keys |
|-----------|------|
| `kairacure/prod/mongodb` | `MONGO_ADMIN_PASS`, `MONGO_APP_PASS` |
| `kairacure/prod/env` | `MONGODB_URI`, `JWT_SECRET`, SMTP credentials |

## Notes

- The S3 bucket `kairacure-artifacts-prod` must contain the backend ZIP at `backend/latest.zip`
- MongoDB data is local to the instance; ensure regular backups if needed
- The `ec2-userdata.sh` script creates a fresh database schema on each run
