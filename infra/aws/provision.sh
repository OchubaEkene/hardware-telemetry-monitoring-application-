#!/bin/bash
# provision.sh — Provision EC2 t3.micro + Security Group for the monitoring stack.
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Environment variables exported (see below)
#
# Usage:
#   export ADMIN_CIDR=1.2.3.4/32          # your public IP/32
#   export AGENT_HOST=192.168.x.x          # LAN IP of the PC running agent.py
#   export KEY_NAME=my-ec2-keypair         # existing EC2 key pair name
#   export GRAFANA_PASSWORD=supersecret    # Grafana admin password
#   export ANTHROPIC_API_KEY=sk-ant-...    # Claude API key for ai-insights
#   bash infra/aws/provision.sh

set -euo pipefail

# ── Required variables ────────────────────────────────────────────────────────
: "${ADMIN_CIDR:?Set ADMIN_CIDR to your IP range, e.g. 1.2.3.4/32}"
: "${AGENT_HOST:?Set AGENT_HOST to the LAN IP of your hardware agent, e.g. 192.168.1.100}"
: "${KEY_NAME:?Set KEY_NAME to your EC2 key pair name}"
: "${GRAFANA_PASSWORD:?Set GRAFANA_PASSWORD for the Grafana admin account}"
: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY for the Claude AI insights service}"
: "${AWS_DEFAULT_REGION:=us-east-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Resolve latest Ubuntu 22.04 AMI for the current region ────────────────────
echo "[*] Resolving latest Ubuntu 22.04 AMI in $AWS_DEFAULT_REGION..."
AMI_ID=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters \
    "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
    "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)
echo "[*] Using AMI: $AMI_ID"

# ── Security Group ─────────────────────────────────────────────────────────────
echo "[*] Creating Security Group..."
SG_ID=$(aws ec2 create-security-group \
  --group-name hardware-monitor-sg \
  --description "Hardware Monitor SRE Stack" \
  --query 'GroupId' --output text)
echo "[*] Security Group ID: $SG_ID"

echo "[*] Adding ingress rules for $ADMIN_CIDR..."
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --ip-permissions \
  "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=${ADMIN_CIDR},Description=SSH}]" \
  "IpProtocol=tcp,FromPort=3000,ToPort=3000,IpRanges=[{CidrIp=${ADMIN_CIDR},Description=Grafana}]" \
  "IpProtocol=tcp,FromPort=9090,ToPort=9090,IpRanges=[{CidrIp=${ADMIN_CIDR},Description=Prometheus}]" \
  "IpProtocol=tcp,FromPort=8080,ToPort=8080,IpRanges=[{CidrIp=${ADMIN_CIDR},Description=AI-Insights}]"

# ── Substitute runtime values into user-data ──────────────────────────────────
echo "[*] Preparing user-data script..."
TMPFILE=$(mktemp /tmp/user-data-XXXXXX.sh)
trap "rm -f $TMPFILE" EXIT

sed \
  -e "s|AGENT_HOST_PLACEHOLDER|${AGENT_HOST}|g" \
  -e "s|GRAFANA_PASSWORD_PLACEHOLDER|${GRAFANA_PASSWORD}|g" \
  -e "s|ANTHROPIC_KEY_PLACEHOLDER|${ANTHROPIC_API_KEY}|g" \
  "${SCRIPT_DIR}/user-data.sh" > "$TMPFILE"

# ── Launch EC2 ────────────────────────────────────────────────────────────────
echo "[*] Launching EC2 t3.micro..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type t3.micro \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --block-device-mappings "DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3}" \
  --user-data "file://${TMPFILE}" \
  --tag-specifications \
    "ResourceType=instance,Tags=[{Key=Name,Value=hardware-monitor},{Key=Project,Value=hardware-monitor-sre},{Key=ManagedBy,Value=provision-sh}]" \
  --query 'Instances[0].InstanceId' --output text)

echo "[*] Instance ID: $INSTANCE_ID"
echo "[*] Waiting for instance to reach running state..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo ""
echo "=== Provisioning complete ==="
echo "  Instance ID  : $INSTANCE_ID"
echo "  Public IP    : $PUBLIC_IP"
echo "  Region       : $AWS_DEFAULT_REGION"
echo "  AMI          : $AMI_ID"
echo ""
echo "  Services (ready in ~3 min after bootstrap):"
echo "    Grafana     : http://$PUBLIC_IP:3000  (admin / <GRAFANA_PASSWORD>)"
echo "    Prometheus  : http://$PUBLIC_IP:9090"
echo "    AI Insights : http://$PUBLIC_IP:8080/health"
echo ""
echo "  SSH access:"
echo "    ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$PUBLIC_IP"
echo ""
echo "  Bootstrap log (on EC2):"
echo "    tail -f /var/log/user-data.log"
