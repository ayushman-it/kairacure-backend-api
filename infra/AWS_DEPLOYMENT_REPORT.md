# Kairacure Production Deployment Report

**Date:** August 19, 2026  
**AWS Account:** `987119352718`  
**Region:** `ap-south-1` (Mumbai)  
**Monthly Budget:** ~$78/month  

---

## Live Endpoints

| Service | URL | Status |
|---------|-----|--------|
| **API (HTTPS)** | https://kairacure-api-alb-1564771128.ap-south-1.elb.amazonaws.com/api/health | Live |
| **Patient Website** | http://kairacure-web-prod.s3-website.ap-south-1.amazonaws.com/ | Live |
| **Admin Panel** | http://kairacure-admin-prod.s3-website.ap-south-1.amazonaws.com/ | Live |
| **Grafana Dashboard** | https://kairacure-api-alb-1564771128.ap-south-1.elb.amazonaws.com:8443 | Live |
| **GitHub Repo** | https://github.com/5h4d0wn1k/Kairacure (private) | Live |

**Grafana:** Username `admin` / Password `Kairacure2026` / Dashboard "Kairacure Production"

---

## Monthly Cost Breakdown

| Service | Cost/Month | Why |
|---------|-----------|-----|
| EC2 t3.small | $15 | API server + MongoDB + Grafana |
| NAT Gateway | $32 | Outbound internet for private EC2 |
| ALB | $22 | HTTPS termination, load balancing |
| EBS 50GB gp3 | $4 | Encrypted storage |
| S3 (4 buckets) | $2 | Frontend hosting, backups, artifacts |
| KMS | $1 | Encryption keys |
| Secrets Manager | $1 | 5 secrets |
| VPC Endpoints | $29 | 4 interface endpoints |
| **TOTAL** | **~$106/mo** | |

**Note:** VPC endpoints ($29) are offset by reduced NAT Gateway data charges.

---

## AWS Resources

### Compute
- **EC2** `i-048117c391049faa7` - t3.small, Ubuntu 22.04, private IP 10.0.2.122, 50GB encrypted gp3
- Runs: Node.js API (port 5000), MongoDB 7.0, Grafana (port 3000), CloudWatch Agent
- [Console](https://ap-south-1.console.aws.amazon.com/ec2/home?region=ap-south-1#InstanceDetails:instanceId=i-048117c391049faa7)

### Networking
- **VPC** `vpc-04b170f007586966c` - 10.0.0.0/16
- **Public Subnet 1a** `subnet-0924933ae90eaeabe` - 10.0.1.0/24
- **Public Subnet 1b** `subnet-0719eb6cae102f4e3` - 10.0.3.0/24
- **Private Subnet** `subnet-098e9e61d208ef4ce` - 10.0.2.0/24 (EC2 lives here)
- **NAT Gateway** `nat-0eb4dd931375b7faf` - EIP 35.154.230.80
- **Internet Gateway** `igw-0ecc1fb70da38b96f`
- [Console](https://ap-south-1.console.aws.amazon.com/vpc/home?region=ap-south-1#VpcDetails:VpcId=vpc-04b170f007586966c)

### Load Balancer
- **ALB** `kairacure-api-alb` - Internet-facing
  - Port 443 -> API (TLS 1.2+, self-signed cert)
  - Port 80 -> HTTP to HTTPS redirect
  - Port 8443 -> Grafana dashboard
- **Target Groups:** `kairacure-api-tg` (port 5000), `kairacure-grafana-tg` (port 3000)
- [Console](https://ap-south-1.console.aws.amazon.com/ec2/home?region=ap-south-1#LoadBalancers:search=kairacure)

### Security Groups
- **kairacure-alb-sg** `sg-0361e622210d67982` - Ports 80, 443, 8443 from 0.0.0.0/0
- **kairacure-ec2-sg** `sg-0add6516d4f5fa4ae` - Port 22 (SSM), 5000+3000 from ALB only
- [Console](https://ap-south-1.console.aws.amazon.com/ec2/home?region=ap-south-1#SecurityGroups:search=kairacure)

### Storage
- **EBS** `vol-010bd376d1638d61f` - 50GB gp3, encrypted
- **S3** `kairacure-artifacts-prod` - Code deployments, versioned, KMS
- **S3** `kairacure-web-prod` - Patient SPA static hosting
- **S3** `kairacure-admin-prod` - Admin SPA static hosting
- **S3** `kairacure-backups-prod` - MongoDB daily dumps, 90-day lifecycle
- [Console](https://s3.console.aws.amazon.com/s3/buckets?region=ap-south-1)

### VPC Endpoints
- **S3** `vpce-0ec406723f7bb7488` - Gateway (free)
- **Secrets Manager** `vpce-0adf0b19808ddf560` - Interface
- **CloudWatch Logs** `vpce-0aaca360551597b41` - Interface
- **SSM** `vpce-0ccd6e694ed8a2696` - Interface
- **EC2 Messages** `vpce-0a497a0b72b5dd9c7` - Interface
- [Console](https://ap-south-1.console.aws.amazon.com/vpc/home?region=ap-south-1#VpcEndpoints)

### Secrets Manager
- `kairacure/prod/mongodb` - Database credentials
- `kairacure/prod/app-secrets` - JWT secret, session keys
- `kairacure/prod/api-keys` - External API keys
- `kairacure/prod/smtp` - Email credentials
- `kairacure/prod/admin` - Admin panel credentials
- [Console](https://ap-south-1.console.aws.amazon.com/secretsmanager/list?region=ap-south-1)

### IAM
- `kairacure-admin` - IAM User for CLI
- `kairacure-ec2-role` + `kairacure-ec2-profile` - EC2 instance permissions
- `kairacure-ec2-policy` - SSM, CloudWatch, Secrets Manager, S3
- `kairacure-github-deploy` - GitHub Actions OIDC role
- `kairacure-github-deploy-policy` - S3, SSM, CloudFront deploy permissions
- OIDC Provider - github.com
- [Console](https://ap-south-1.console.aws.amazon.com/iamv2/home?region=ap-south-1#/roles)

### Monitoring
- **CloudWatch Agent** - Logs + custom metrics
- **7 Alarms:** API health, 5xx errors, slow response, CPU, memory, disk, status check
- **SNS** `kairacure-prod-alerts` - Email alerts to admin@kairacure.com
- **Grafana 13.1.1** - Self-hosted, CloudWatch data source, 7-panel dashboard
- [Console](https://ap-south-1.console.aws.amazon.com/cloudwatch/home?region=ap-south-1#alarmsV2:alarmName=kairacure)

### CI/CD
- **GitHub Actions** - 3 workflows: CI checks, auto-deploy on merge, manual rollback
- **OIDC Auth** - Passwordless deploy from GitHub to AWS
- **Deploy:** Push to `main` branch -> auto-deploys to EC2

### Backups
- **Daily at 3 AM UTC** - MongoDB dumps to S3 with KMS encryption
- **90-day retention** with automatic lifecycle policy
- **Recovery scripts:** `infra/ec2-userdata.sh`, `infra/generate-env.sh`

---

## Security Features

- TLS 1.2+ only (ELBSecurityPolicy-TLS13-1-2-2021-06)
- HTTP to HTTPS redirect
- Helmet.js (CSP, HSTS, X-Frame, X-Content-Type, Referrer-Policy, Permissions-Policy)
- Rate limiting (100 req/15 min)
- XSS sanitization on all inputs
- CORS origin allowlist
- Cache-Control: no-store on all responses
- UFW firewall (ports 22, 5000, 3000)
- fail2ban SSH protection
- MongoDB auth + keyfile + localhost binding
- All secrets in Secrets Manager (never in code)
- KMS encryption on EBS and S3
- EC2 in private subnet (no public IP)
- IAM least-privilege policies
- Request ID tracing (UUID on every request)

---

## Repository Structure

```
.github/workflows/   - CI/CD (ci.yml, deploy.yml, rollback.yml)
infra/               - Infrastructure scripts, runbook, monitoring
kairacure-backend-api/ - Node.js Express API
kairacure-web/       - React + Vite patient SPA
kairacure-admin/     - React + Vite admin SPA
```

---

## Disclaimers

- **CloudFront:** Pending AWS account verification (support ticket filed)
- **Custom Domain:** DNS not configured yet (kairacure.com owned but not in Route53)
- **SMTP:** Using Gmail temporarily (should switch to production email)
- **HTTPS Certificate:** Self-signed (CloudFront will provide free ACM cert)
- **S3 Frontend:** Currently public-read (will revert when CloudFront is ready)

---

## Disaster Recovery

If EC2 dies:
1. Run `infra/ec2-userdata.sh` on new instance
2. Run `infra/generate-env.sh` to restore .env
3. Update ALB target group
4. Deploy latest from S3

Full recovery procedure: `infra/RUNBOOK.md`
Quick commands: `./infra/quick-commands.sh help`

---

**Prepared by:** Kairacure DevOps  
**AWS Account:** 987119352718  
**Region:** ap-south-1
