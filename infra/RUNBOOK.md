# Kairacure Production Runbook

## Quick Reference

- **Account:** 987119352718
- **Region:** ap-south-1
- **EC2:** i-048117c391049faa7 (10.0.2.122, private subnet)
- **ALB:** kairacure-api-alb (HTTPS on 443, self-signed cert)
- **MongoDB:** 7.0 on EC2 (databases: kairacure_public, kairacure_patient)
- **S3 Buckets:** kairacure-artifacts-prod, kairacure-web-prod, kairacure-admin-prod, kairacure-backups-prod
- **Secrets:** kairacure/prod/mongodb, app-secrets, api-keys, smtp, admin
- **SNS:** kairacure-prod-alerts (admin@kairacure.com)

---

## Common Operations

### Check API Health
```bash
curl -sk https://kairacure-api-alb-1564771128.ap-south-1.elb.amazonaws.com/api/health
```

### SSH to EC2 (via SSM)
```bash
aws ssm start-session --region ap-south-1 --target i-048117c391049faa7
```

### Check PM2 Status
```bash
# After SSM session
pm2 status
pm2 logs kairacure-api --lines 50
```

### Restart API
```bash
pm2 restart kairacure-api
```

### Check MongoDB
```bash
mongosh --eval "db.stats()" -u kairacure_admin -p '<admin-password>' --authenticationDatabase admin kairacure_public
```

### Manual Backup
```bash
/opt/kairacure/backup.sh
```

### Restore from Backup
```bash
# List backups
aws s3 ls s3://kairacure-backups-prod/mongodb/ --region ap-south-1

# Download
aws s3 cp s3://kairacure-backups-prod/mongodb/<file>.gz /tmp/ --region ap-south-1

# Restore
gunzip /tmp/<file>.gz
mongorestore --db kairacure_public --username kairacure_admin --password '<admin-password>' --authenticationDatabase admin --archive=/tmp/<file>
```

### Deploy New Code (Manual)
```bash
cd /media/cynik/cynik-storage/projects/Kairacure
zip -r /tmp/backend.zip kairacure-backend-api/ -x "kairacure-backend-api/node_modules/*"
aws s3 cp /tmp/backend.zip s3://kairacure-artifacts-prod/backend/latest.zip --region ap-south-1

# SSH via SSM and:
cd /opt/kairacure/kairacure-backend-api
cp .env .env.backup
aws s3 cp s3://kairacure-artifacts-prod/backend/latest.zip /tmp/
unzip -o /tmp/latest.zip -d /opt/kairacure/
cp .env.backup .env
npm install --production
pm2 restart kairacure-api
```

### Rollback
```bash
# List previous deployments
aws s3 ls s3://kairacure-artifacts-prod/backend/ --region ap-south-1

# Rollback via GitHub Actions
# Go to Actions > Rollback Production > Run workflow > Enter version timestamp
```

### View CloudWatch Logs
```bash
aws logs tail /kairacure/api --since 1h --region ap-south-1
aws logs tail /kairacure/mongodb --since 1h --region ap-south-1
```

### Check Alarms
```bash
aws cloudwatch describe-alarms --region ap-south-1 --alarm-name-prefix kairacure --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue}' --output table
```

### Update Security Group
```bash
# Add IP to SSH (for emergency)
aws ec2 authorize-security-group-ingress --region ap-south-1 --group-id sg-0add6516d4f5fa4ae --protocol tcp --port 22 --cidr <YOUR_IP>/32
```

---

## Disaster Recovery

If EC2 dies:
1. Run: `infra/ec2-userdata.sh` (launches new instance)
2. Run: `infra/generate-env.sh` (generates .env from Secrets Manager)
3. Update ALB target group to point to new instance
4. Deploy latest code from S3

---

## Escalation

- AWS Support: https://console.aws.amazon.com/support/home
- SNS alerts go to: admin@kairacure.com
