#!/bin/bash
# deploy.sh — Deploy the hardware monitor stack to Kubernetes.
#
# Prerequisites:
#   - kubectl configured and pointing at your cluster
#   - Environment variables exported (see below)
#
# Usage:
#   export AGENT_HOST=192.168.x.x        # LAN IP of the PC running agent.py
#   export GRAFANA_PASSWORD=supersecret  # Grafana admin password
#   bash infra/k8s/deploy.sh

set -euo pipefail

: "${AGENT_HOST:?Set AGENT_HOST to your hardware agent IP}"
: "${GRAFANA_PASSWORD:?Set GRAFANA_PASSWORD for the Grafana admin account}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[*] Creating namespace..."
kubectl apply -f "${SCRIPT_DIR}/namespace.yml"

echo "[*] Creating Grafana secret..."
kubectl create secret generic grafana-secret \
  --from-literal=admin-password="${GRAFANA_PASSWORD}" \
  --namespace=hardware-monitor \
  --dry-run=client -o yaml | kubectl apply -f -

echo "[*] Applying Prometheus ConfigMap (agent host: ${AGENT_HOST})..."
AGENT_HOST="${AGENT_HOST}" envsubst < "${SCRIPT_DIR}/configmap-prometheus.yml" | kubectl apply -f -

echo "[*] Applying remaining manifests..."
kubectl apply -f "${SCRIPT_DIR}/configmap-grafana.yml"
kubectl apply -f "${SCRIPT_DIR}/deployment-prometheus.yml"
kubectl apply -f "${SCRIPT_DIR}/deployment-grafana.yml"
kubectl apply -f "${SCRIPT_DIR}/service-prometheus.yml"
kubectl apply -f "${SCRIPT_DIR}/service-grafana.yml"
kubectl apply -f "${SCRIPT_DIR}/hpa-grafana.yml"

echo ""
echo "[*] Waiting for pods to be ready..."
kubectl rollout status deployment/prometheus -n hardware-monitor --timeout=120s
kubectl rollout status deployment/grafana    -n hardware-monitor --timeout=120s

echo ""
echo "=== Kubernetes deployment complete ==="
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || echo "<node-ip>")
echo "  Grafana    : http://${NODE_IP}:30030  (admin / <GRAFANA_PASSWORD>)"
echo "  Prometheus : http://${NODE_IP}:30090"
echo ""
echo "  Pod status :"
kubectl get pods -n hardware-monitor
echo ""
echo "  HPA status :"
kubectl get hpa  -n hardware-monitor
