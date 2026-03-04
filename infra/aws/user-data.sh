#!/bin/bash
# user-data.sh — EC2 bootstrap script.
# Installs Docker, writes all monitoring configs, applies Puppet, starts stack.
#
# Placeholders substituted by provision.sh before upload:
#   AGENT_HOST_PLACEHOLDER   → hardware agent LAN IP
#   GRAFANA_PASSWORD_PLACEHOLDER → Grafana admin password
#   ANTHROPIC_KEY_PLACEHOLDER    → Anthropic API key
set -euo pipefail

LOG=/var/log/user-data.log
exec > >(tee -a "$LOG") 2>&1

echo "[$(date)] Bootstrap starting..."

# ── System update + packages ──────────────────────────────────────────────────
apt-get update -y
apt-get install -y \
  puppet \
  docker.io \
  docker-compose \
  curl \
  git \
  ufw \
  gettext-base   # provides envsubst

# ── Enable Docker ─────────────────────────────────────────────────────────────
systemctl enable --now docker
usermod -aG docker ubuntu

# ── Directory structure ───────────────────────────────────────────────────────
mkdir -p /opt/monitoring/{prometheus,grafana/provisioning/{datasources,dashboards},grafana/dashboards}

# ── Prometheus config (AGENT_HOST substituted by provision.sh) ────────────────
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

# ── Alert rules ───────────────────────────────────────────────────────────────
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
          description: "GPU temp is {{ $value }}°C (threshold: 80°C)"

      - alert: HardwareCPUTempCritical
        expr: hardware_cpu_temp_celsius > 80
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CPU temperature critical on {{ $labels.instance }}"
          description: "CPU temp is {{ $value }}°C (threshold: 80°C)"

      - alert: HardwareAgentDown
        expr: up{job="hardware_agent"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Hardware agent is down on {{ $labels.instance }}"
          description: "The hardware telemetry agent has been unreachable for 2 minutes"

      - alert: HardwarePowerDrawHigh
        expr: hardware_power_draw_watts > 200
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High power draw on {{ $labels.instance }}"
          description: "Power draw is {{ $value }}W (threshold: 200W)"

      - alert: HardwareFanSpeedLow
        expr: hardware_fan_rpm < 1000
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Low fan speed on {{ $labels.instance }}"
          description: "Fan RPM is {{ $value }} (minimum: 1000 RPM)"
EOF

# ── Grafana datasource ────────────────────────────────────────────────────────
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

# ── Grafana dashboard provider ────────────────────────────────────────────────
cat > /opt/monitoring/grafana/provisioning/dashboards/dashboards.yml << 'EOF'
apiVersion: 1
providers:
  - name: hardware-monitor
    orgId: 1
    type: file
    disableDeletion: true
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards
EOF

# ── Grafana dashboard JSON ────────────────────────────────────────────────────
cat > /opt/monitoring/grafana/dashboards/hardware-monitor.json << 'EOF'
{
  "title": "Hardware Monitor",
  "uid": "hardware-monitor",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "10s",
  "time": { "from": "now-30m", "to": "now" },
  "panels": [
    {
      "id": 1, "type": "stat", "title": "GPU Temperature",
      "gridPos": { "h": 4, "w": 6, "x": 0, "y": 0 },
      "datasource": "Prometheus",
      "targets": [{ "expr": "hardware_gpu_temp_celsius", "legendFormat": "GPU Temp" }],
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "background" },
      "fieldConfig": { "defaults": { "unit": "celsius",
        "thresholds": { "mode": "absolute", "steps": [
          { "color": "green", "value": null },
          { "color": "yellow", "value": 60 },
          { "color": "red", "value": 80 }
        ]}}}
    },
    {
      "id": 2, "type": "stat", "title": "CPU Temperature",
      "gridPos": { "h": 4, "w": 6, "x": 6, "y": 0 },
      "datasource": "Prometheus",
      "targets": [{ "expr": "hardware_cpu_temp_celsius", "legendFormat": "CPU Temp" }],
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "background" },
      "fieldConfig": { "defaults": { "unit": "celsius",
        "thresholds": { "mode": "absolute", "steps": [
          { "color": "green", "value": null },
          { "color": "yellow", "value": 60 },
          { "color": "red", "value": 80 }
        ]}}}
    },
    {
      "id": 3, "type": "stat", "title": "Fan Speed",
      "gridPos": { "h": 4, "w": 6, "x": 12, "y": 0 },
      "datasource": "Prometheus",
      "targets": [{ "expr": "hardware_fan_rpm", "legendFormat": "Fan RPM" }],
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "background" },
      "fieldConfig": { "defaults": { "unit": "rotrpm",
        "thresholds": { "mode": "absolute", "steps": [
          { "color": "red", "value": null },
          { "color": "yellow", "value": 800 },
          { "color": "green", "value": 1000 }
        ]}}}
    },
    {
      "id": 4, "type": "stat", "title": "Power Draw",
      "gridPos": { "h": 4, "w": 6, "x": 18, "y": 0 },
      "datasource": "Prometheus",
      "targets": [{ "expr": "hardware_power_draw_watts", "legendFormat": "Power Draw" }],
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "background" },
      "fieldConfig": { "defaults": { "unit": "watt",
        "thresholds": { "mode": "absolute", "steps": [
          { "color": "green", "value": null },
          { "color": "yellow", "value": 150 },
          { "color": "red", "value": 200 }
        ]}}}
    },
    {
      "id": 5, "type": "timeseries", "title": "Temperature History",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 4 },
      "datasource": "Prometheus",
      "targets": [
        { "expr": "hardware_gpu_temp_celsius", "legendFormat": "GPU Temp (°C)" },
        { "expr": "hardware_cpu_temp_celsius", "legendFormat": "CPU Temp (°C)" }
      ],
      "fieldConfig": { "defaults": { "unit": "celsius", "custom": { "lineWidth": 2, "fillOpacity": 10 } }},
      "options": { "tooltip": { "mode": "multi" }, "legend": { "displayMode": "list", "placement": "bottom" } }
    },
    {
      "id": 6, "type": "timeseries", "title": "Fan & Power History",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 4 },
      "datasource": "Prometheus",
      "targets": [
        { "expr": "hardware_fan_rpm", "legendFormat": "Fan (RPM)" },
        { "expr": "hardware_power_draw_watts", "legendFormat": "Power (W)" }
      ],
      "fieldConfig": { "defaults": { "custom": { "lineWidth": 2, "fillOpacity": 10 } },
        "overrides": [
          { "matcher": { "id": "byName", "options": "Fan (RPM)" }, "properties": [{ "id": "unit", "value": "rotrpm" }] },
          { "matcher": { "id": "byName", "options": "Power (W)" }, "properties": [{ "id": "unit", "value": "watt" }] }
        ]},
      "options": { "tooltip": { "mode": "multi" }, "legend": { "displayMode": "list", "placement": "bottom" } }
    }
  ]
}
EOF

# ── Docker Compose (Prometheus + Grafana + AI Insights) ───────────────────────
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
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:9090/-/ready"]
      interval: 15s
      timeout: 5s
      retries: 3

  grafana:
    image: grafana/grafana:10.4.0
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=GRAFANA_PASSWORD_PLACEHOLDER
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - /opt/monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - /opt/monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    depends_on:
      prometheus:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  ai-insights:
    image: python:3.12-slim
    container_name: ai-insights
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - ANTHROPIC_API_KEY=ANTHROPIC_KEY_PLACEHOLDER
      - PROMETHEUS_URL=http://prometheus:9090
    depends_on:
      prometheus:
        condition: service_healthy
    command: >
      bash -c "pip install -q fastapi uvicorn[standard] httpx anthropic python-dotenv &&
               python -c '
import urllib.request, os
url = \"https://raw.githubusercontent.com/OchubaEkene/hardware-telemetry-monitoring-application-/main/ai-insights/service.py\"
urllib.request.urlretrieve(url, \"/service.py\")
' &&
               uvicorn service:app --host 0.0.0.0 --port 8080"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 20s
      timeout: 5s
      retries: 5
      start_period: 60s

volumes:
  prometheus_data:
  grafana_data:
EOF

# ── Puppet module files (for masterless puppet apply) ─────────────────────────
PUPPET_BASE=/etc/puppet
mkdir -p ${PUPPET_BASE}/manifests
mkdir -p ${PUPPET_BASE}/modules/monitoring_stack/{manifests,files/{prometheus,grafana/provisioning/{datasources,dashboards},grafana/dashboards}}

cat > ${PUPPET_BASE}/manifests/site.pp << 'PUPPET_SITE'
node default {
  include monitoring_stack
}
PUPPET_SITE

cat > ${PUPPET_BASE}/modules/monitoring_stack/manifests/init.pp << 'PUPPET_PP'
class monitoring_stack {
  package { ['docker.io', 'docker-compose']: ensure => installed }
  service { 'docker': ensure => running, enable => true, require => Package['docker.io'] }

  service { 'monitoring-stack':
    ensure  => running,
    enable  => true,
    require => [Package['docker-compose'], Service['docker']],
  }

  exec { 'ufw-allow-ssh':
    command => '/usr/sbin/ufw allow 22/tcp',
    unless  => '/usr/sbin/ufw status | grep -qw "22/tcp"',
  }
  exec { 'ufw-allow-grafana':
    command => '/usr/sbin/ufw allow 3000/tcp',
    unless  => '/usr/sbin/ufw status | grep -qw "3000/tcp"',
  }
  exec { 'ufw-allow-prometheus':
    command => '/usr/sbin/ufw allow 9090/tcp',
    unless  => '/usr/sbin/ufw status | grep -qw "9090/tcp"',
  }
  exec { 'ufw-allow-ai-insights':
    command => '/usr/sbin/ufw allow 8080/tcp',
    unless  => '/usr/sbin/ufw status | grep -qw "8080/tcp"',
  }
}
PUPPET_PP

# Copy runtime configs into puppet file server paths (for idempotent re-apply)
cp /opt/monitoring/prometheus/prometheus.yml     ${PUPPET_BASE}/modules/monitoring_stack/files/prometheus/
cp /opt/monitoring/prometheus/alerts.yml          ${PUPPET_BASE}/modules/monitoring_stack/files/prometheus/
cp /opt/monitoring/grafana/provisioning/datasources/prometheus.yml \
   ${PUPPET_BASE}/modules/monitoring_stack/files/grafana/provisioning/datasources/
cp /opt/monitoring/grafana/provisioning/dashboards/dashboards.yml \
   ${PUPPET_BASE}/modules/monitoring_stack/files/grafana/provisioning/dashboards/
cp /opt/monitoring/grafana/dashboards/hardware-monitor.json \
   ${PUPPET_BASE}/modules/monitoring_stack/files/grafana/dashboards/

# ── Apply Puppet (idempotent — safe to re-run) ────────────────────────────────
echo "[$(date)] Running puppet apply..."
puppet apply \
  --modulepath="${PUPPET_BASE}/modules" \
  "${PUPPET_BASE}/manifests/site.pp" \
  --detailed-exitcodes || [ $? -eq 2 ]  # exit 2 = changes made (not an error)
echo "[$(date)] Puppet apply complete"

# ── systemd service for compose ───────────────────────────────────────────────
cat > /etc/systemd/system/monitoring-stack.service << 'SYSTEMD'
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
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable --now monitoring-stack

# ── UFW firewall ──────────────────────────────────────────────────────────────
ufw --force enable
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 9090/tcp
ufw allow 8080/tcp

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "[$(date)] Bootstrap complete."
echo "  Grafana     : http://${PUBLIC_IP}:3000"
echo "  Prometheus  : http://${PUBLIC_IP}:9090"
echo "  AI Insights : http://${PUBLIC_IP}:8080/health"
