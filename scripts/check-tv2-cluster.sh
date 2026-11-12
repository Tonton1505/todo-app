#!/usr/bin/env bash
# ==============================================================================
# CLUSTER & FAULT TOLERANCE VERIFICATION SUITE
# Target: Member 2 Responsibilities (Kubernetes Infrastructure & High Availability)
# ==============================================================================

set -Eeuo pipefail

NAMESPACE="cloud-web-app"
LOG_DIR="./docs/node-failure-logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="${LOG_DIR}/verification_report_${TIMESTAMP}.log"
mkdir -p "${LOG_DIR}"

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${REPORT_FILE}"
}

fail() {
    log "❌ FAIL: $1"
    exit 1
}

pass() {
    log "✅ PASS: $1"
}

command_exists() {
    command -v "$1" &>/dev/null
}

echo "=================================================================="
echo "☸️  KUBERNETES INFRASTRUCTURE VERIFICATION (MEMBER 2)"
echo "Log: ${REPORT_FILE}"
echo "=================================================================="

# ------------------------------------------------------------------------------
# STEP 1: CLI TOOLING & KUBECONFIG CHECK
# ------------------------------------------------------------------------------
log ">>> STEP 1: Checking Client CLI & Cluster Connectivity..."

if ! command_exists kubectl; then
    fail "kubectl binary not found in PATH."
fi

if ! kubectl cluster-info &>/dev/null; then
    fail "Unable to connect to Kubernetes API Server. Verify kubeconfig (~/.kube/config)."
fi
pass "Kubernetes API Server is reachable."

# ------------------------------------------------------------------------------
# STEP 2: NODE TOPOLOGY & READINESS VERIFICATION
# ------------------------------------------------------------------------------
log ">>> STEP 2: Verifying Node Topology (1 Control Plane + 2 Workers)..."

REQUIRED_NODES=("cp" "worker1" "worker2")
ALL_NODES=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}')

for NODE in "${REQUIRED_NODES[@]}"; do
    if echo "${ALL_NODES}" | grep -qw "${NODE}"; then
        pass "Node '${NODE}' exists in cluster."
    else
        log "⚠️  Node '${NODE}' not found. Current nodes: ${ALL_NODES}"
    fi
done

NOT_READY_NODES=$(kubectl get nodes --no-headers | awk '$2 != "Ready" {print $1}')
if [ -n "${NOT_READY_NODES}" ]; then
    fail "The following nodes are not in Ready state:\n${NOT_READY_NODES}"
fi
pass "All nodes are in Ready state."

echo "" | tee -a "${REPORT_FILE}"
kubectl get nodes -o wide | tee -a "${REPORT_FILE}"
echo "" | tee -a "${REPORT_FILE}"

# ------------------------------------------------------------------------------
# STEP 3: CONTAINER RUNTIME & CNI VERIFICATION
# ------------------------------------------------------------------------------
log ">>> STEP 3: Checking Container Runtime & CNI Pods..."

CONTAINER_RUNTIMES=$(kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.containerRuntimeVersion}')
log "Container Runtime versions detected: ${CONTAINER_RUNTIMES}"

if ! echo "${CONTAINER_RUNTIMES}" | grep -q "containerd"; then
    log "⚠️  Warning: Expected containerd runtime."
else
    pass "containerd runtime verified across nodes."
fi

CNI_PODS=$(kubectl get pods -n kube-system -l 'k8s-app in (flannel,calico-node)' --no-headers 2>/dev/null || true)
if [ -z "${CNI_PODS}" ]; then
    # Fallback search for any CNI pod in kube-system
    CNI_PODS=$(kubectl get pods -n kube-system --no-headers | grep -E "flannel|calico|weave|cilium" || true)
fi

if [ -n "${CNI_PODS}" ]; then
    pass "CNI network daemonset pods detected."
    echo "${CNI_PODS}" | tee -a "${REPORT_FILE}"
else
    fail "No CNI network plugin pods detected in kube-system."
fi

# ------------------------------------------------------------------------------
# STEP 4: APPLICATION POD DISTRIBUTION (ANTI-AFFINITY)
# ------------------------------------------------------------------------------
log ">>> STEP 4: Verifying Application Pod Scheduling across Worker Nodes..."

if ! kubectl get ns "${NAMESPACE}" &>/dev/null; then
    fail "Namespace '${NAMESPACE}' does not exist. Run './scripts/03-deploy-app.sh' first."
fi

RUNNING_BACKEND=$(kubectl get pods -n "${NAMESPACE}" -l app=backend --field-selector=status.phase=Running --no-headers | wc -l | tr -d ' ')
if [ "${RUNNING_BACKEND}" -lt 2 ]; then
    fail "Expected at least 2 running backend replicas, found: ${RUNNING_BACKEND}"
fi
pass "Backend replicas running: ${RUNNING_BACKEND}"

BACKEND_NODES=$(kubectl get pods -n "${NAMESPACE}" -l app=backend -o jsonpath='{.items[*].spec.nodeName}' | tr ' ' '\n' | sort -u)
log "Backend pods scheduled on nodes:\n${BACKEND_NODES}"

if echo "${BACKEND_NODES}" | grep -qw "worker1" && echo "${BACKEND_NODES}" | grep -qw "worker2"; then
    pass "podAntiAffinity verified: Backend pods distributed across both worker1 and worker2."
else
    log "⚠️  Warning: Pods are not distributed across both worker nodes. Current allocation: ${BACKEND_NODES}"
fi

# ------------------------------------------------------------------------------
# STEP 5: SERVICE ENDPOINT & HEALTH PROBE
# ------------------------------------------------------------------------------
log ">>> STEP 5: Verifying Service Endpoints & Core Connectivity..."

ENDPOINTS=$(kubectl get endpoints -n "${NAMESPACE}" backend-service -o jsonpath='{.subsets[*].addresses[*].ip}')
if [ -z "${ENDPOINTS}" ]; then
    fail "No endpoints registered under backend-service."
fi
pass "backend-service endpoints registered: ${ENDPOINTS}"

# ------------------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------------------
echo "=================================================================="
log "CLUSTER VERIFICATION COMPLETE: ALL CHECKS PASSED."
echo "Log file: ${REPORT_FILE}"
echo "=================================================================="
