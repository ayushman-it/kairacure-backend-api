#!/bin/bash
set -euxo pipefail

# Kairacure EC2 Bootstrap Script
# Run as root on Ubuntu 22.04

export DEBIAN_FRONTEND=noninteractive

# System updates
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget unzip python3 python3-pip mongosh jq

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs

# Install pm2
npm install -g pm2

# Install CloudWatch Agent
cd /tmp
curl -O https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb
rm -f ./amazon-cloudwatch-agent.deb

# Install fail2ban
apt-get install -y -qq fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF
systemctl enable fail2ban
systemctl start fail2ban

# Install unattended upgrades
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# MongoDB setup
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -qq
apt-get install -y -qq mongodb-org

# MongoDB keyfile
MONGO_PASS=$(aws secretsmanager get-secret-value --region ap-south-1 --secret-id kairacure/prod/mongodb --query SecretString --output text | python3 -c "import sys,json;print(json.load(sys.stdin)['MONGO_ADMIN_PASS'])")
openssl rand -base64 756 > /etc/mongo-keyfile
chmod 400 /etc/mongo-keyfile
chown mongodb:mongodb /etc/mongo-keyfile

# Configure MongoDB
cat > /etc/mongod.conf << MCONF
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
security:
  authorization: enabled
  keyFile: /etc/mongo-keyfile
MCONF

systemctl enable mongod
systemctl restart mongod
sleep 5

# Create MongoDB users
mongosh --eval "
db = db.getSiblingDB('admin');
db.createUser({user:'kairacure_admin',pwd:'$MONGO_PASS',roles:[{role:'root',db:'admin'}]});
db = db.getSiblingDB('kairacure_public');
db.createCollection('init');
db = db.getSiblingDB('kairacure_patient_records');
db.createCollection('init');
db = db.getSiblingDB('admin');
db.createUser({user:'kairacure_app',pwd:'$(aws secretsmanager get-secret-value --region ap-south-1 --secret-id kairacure/prod/mongodb --query SecretString --output text | python3 -c "import sys,json;print(json.load(sys.stdin)['MONGO_APP_PASS'])")',roles:[{role:'readWrite',db:'kairacure_public'},{role:'readWrite',db:'kairacure_patient_records'}]});
" 2>/dev/null || echo "Users may already exist"

# Kernel tuning
cat > /etc/sysctl.d/99-kairacure.conf << 'SYSEOF'
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.core.netdev_max_backlog = 5000
vm.overcommit_memory = 1
vm.swappiness = 10
fs.file-max = 2097152
SYSEOF
sysctl -p /etc/sysctl.d/99-kairacure.conf

# Deploy app
mkdir -p /opt/kairacure
cd /opt/kairacure
aws s3 cp s3://kairacure-artifacts-prod/backend/latest.zip /tmp/backend.zip --region ap-south-1
unzip /tmp/backend.zip
rm -f /tmp/backend.zip
cd kairacure-backend-api
npm install --production

# Create .env from Secrets Manager
# (Same as the SSM bootstrap script)

# Start with pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root

# UFW
ufw allow 22/tcp
ufw allow 5000/tcp
ufw --force enable

# CloudWatch Agent config
mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/
cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << 'CWCONFIG'
{
  "agent": {"metrics_collection_interval": 60, "run_as_user": "root"},
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {"file_path": "/var/log/mongodb/mongod.log", "log_group_name": "/kairacure/mongodb", "log_stream_name": "mongod", "retention_in_days": 30},
          {"file_path": "/root/.pm2/logs/*.log", "log_group_name": "/kairacure/api", "log_stream_name": "pm2", "retention_in_days": 30}
        ]
      }
    }
  },
  "metrics": {
    "namespace": "Kairacure",
    "metrics_collected": {
      "mem": {"measurement": ["mem_used_percent"]},
      "disk": {"measurement": ["used_percent"], "resources": ["/"]},
      "cpu": {"measurement": ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system"]}
    }
  }
}
CWCONFIG
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json
systemctl enable amazon-cloudwatch-agent

# Logrotate
cat > /etc/logrotate.d/kairacure << 'LOGEOF'
/root/.pm2/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
/var/log/mongodb/mongod.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
LOGEOF

echo "[$(date)] Kairacure bootstrap complete" >> /var/log/kairacure-bootstrap.log
