#!/bin/bash
# user-data.sh — EC2 bootstrap script.
# Installs Puppet, Docker, Docker Compose, then applies the monitoring_stack
# Puppet manifest to bring up the full monitoring stack automatically.
set -e

LOG=/var/log/user-data.log
exec > >(tee -a $LOG) 2>&1

echo "[$(date)] Bootstrap starting..."

# ── System update + packages ─────────────────────────────────────────────────
apt-get update -y
apt-get install -y \
  puppet \
  docker.io \
  docker-compose \
  curl \
  git \
  ufw

# ── Enable Docker ─────────────────────────────────────────────────────────────
systemctl enable --now docker

# ── Puppet module directory structure ────────────────────────────────────────
PUPPET_BASE=/etc/puppet
mkdir -p ${PUPPET_BASE}/manifests
mkdir -p ${PUPPET_BASE}/modules/monitoring_stack/{manifests,files}
mkdir -p ${PUPPET_BASE}/modules/monitoring_stack/files/{prometheus,grafana/provisioning/{datasources,dashboards},grafana/dashboards}

# ── Write Puppet manifests inline ────────────────────────────────────────────
# (In production these would be fetched from S3 or a git repo)

cat > ${PUPPET_BASE}/manifests/site.pp << 'PUPPET_SITE'
node default {
  include monitoring_stack
}
PUPPET_SITE

# Fetch module files from S3 (placeholder — adapt to your S3 bucket)
# aws s3 sync s3://your-bucket/puppet-modules/ ${PUPPET_BASE}/modules/

# For demo: write config files directly
# In a real deployment, replace with S3 fetch or git clone

mkdir -p /opt/monitoring/{prometheus,grafana/provisioning/{datasources,dashboards},grafana/dashboards}

cat > /opt/monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 10s
  evaluation_interval: 10s

rule_files:
  - "alerts.yml"

scrape_configs:
  - job_name: hardware_agent
    static_configs:
      - targets: ["AGENT_HOST_PLACEHOLDER:9100"]
        labels:
          instance: home-pc
EOF

cat > /opt/monitoring/prometheus/alerts.yml << 'EOF'
groups:
  - name: hardware_alerts
    rules:
      - alert: HardwareGPUTempCritical
        expr: hardware_gpu_temp_celsius > 80
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "GPU temperature critical on {{ $labels.instance }}"
          description: "GPU temp is {{ $value }}°C"

      - alert: HardwareCPUTempCritical
        expr: hardware_cpu_temp_celsius > 80
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CPU temperature critical on {{ $labels.instance }}"
          description: "CPU temp is {{ $value }}°C"

      - alert: HardwareAgentDown
        expr: up{job="hardware_agent"} == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Hardware agent is down on {{ $labels.instance }}"

      - alert: HardwarePowerDrawHigh
        expr: hardware_power_draw_watts > 200
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High power draw on {{ $labels.instance }}"
EOF

cat > /opt/monitoring/grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
EOF

cat > /opt/monitoring/grafana/provisioning/dashboards/dashboards.yml << 'EOF'
apiVersion: 1
providers:
  - name: hardware-monitor
    orgId: 1
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
EOF

# ── Docker Compose ────────────────────────────────────────────────────────────
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-changeme}"

cat > /opt/monitoring/docker-compose.yml << EOF
version: "3.9"

services:
  prometheus:
    image: prom/prometheus:v2.51.0
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=30d"
      - "--web.enable-lifecycle"
    volumes:
      - /opt/monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - /opt/monitoring/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:10.4.0
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - /opt/monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - /opt/monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
EOF

# ── systemd service for compose ───────────────────────────────────────────────
cat > /etc/systemd/system/monitoring-stack.service << 'EOF'
[Unit]
Description=Hardware Monitor Compose Stack
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/monitoring
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now monitoring-stack

# ── UFW firewall ──────────────────────────────────────────────────────────────
ufw --force enable
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 9090/tcp

echo "[$(date)] Bootstrap complete. Grafana at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
