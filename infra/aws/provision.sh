#!/bin/bash
# provision.sh — Provision EC2 t3.micro + Security Group for the monitoring stack.
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - ADMIN_CIDR exported: export ADMIN_CIDR=1.2.3.4/32
#
# Usage:
#   export ADMIN_CIDR=<your-ip>/32
#   bash infra/aws/provision.sh

set -euo pipefail

: "${ADMIN_CIDR:?Set ADMIN_CIDR to your IP range, e.g. 1.2.3.4/32}"
: "${AWS_DEFAULT_REGION:=us-east-1}"

echo "[*] Creating Security Group..."
SG_ID=$(aws ec2 create-security-group \
  --group-name hardware-monitor-sg \
  --description "Hardware Monitor SRE Stack" \
  --query 'GroupId' --output text)

echo "[*] Security Group ID: $SG_ID"

echo "[*] Adding ingress rules (SSH, Grafana, Prometheus) for $ADMIN_CIDR..."
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --ip-permissions \
  "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=${ADMIN_CIDR},Description=SSH}]" \
  "IpProtocol=tcp,FromPort=3000,ToPort=3000,IpRanges=[{CidrIp=${ADMIN_CIDR},Description=Grafana}]" \
  "IpProtocol=tcp,FromPort=9090,ToPort=9090,IpRanges=[{CidrIp=${ADMIN_CIDR},Description=Prometheus}]"

echo "[*] Launching EC2 t3.micro (Ubuntu 22.04)..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.micro \
  --security-group-ids "$SG_ID" \
  --user-data file://infra/aws/user-data.sh \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=hardware-monitor},{Key=Project,Value=hardware-monitor-sre}]" \
  --query 'Instances[0].InstanceId' --output text)

echo "[*] Instance ID: $INSTANCE_ID"
echo "[*] Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo ""
echo "=== Provisioning complete ==="
echo "  Instance ID : $INSTANCE_ID"
echo "  Public IP   : $PUBLIC_IP"
echo "  Grafana     : http://$PUBLIC_IP:3000  (admin / \$GRAFANA_PASSWORD)"
echo "  Prometheus  : http://$PUBLIC_IP:9090"
echo ""
echo "Bootstrap runs in background via user-data (~3 min). SSH with:"
echo "  ssh ubuntu@$PUBLIC_IP"
