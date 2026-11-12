#!/bin/bash
# ==============================================================================
# Script 03: Triển khai Todo App (Database + Backend + Frontend) lên Cụm K8s
# ==============================================================================

set -e

DOCKER_USER="${1:-tonton15}"

echo "=================================================================="
echo "🚀 BẮT ĐẦU TRIỂN KHAI TODO APP (v1.0) LÊN CỤM KUBERNETES 3 NODE"
echo "Sử dụng Docker Hub Username: $DOCKER_USER"
echo "=================================================================="

echo ">>> [0/4] Kiểm tra trạng thái 3 Node trong cụm K8s (cp, worker1, worker2):"
kubectl get nodes -o wide

TEMP_DIR=$(mktemp -d)
cp -r k8s/* "$TEMP_DIR/"

sed -i.bak "s|tonton15|$DOCKER_USER|g; s|yourdockerhubusername|$DOCKER_USER|g; s|<user>|$DOCKER_USER|g" "$TEMP_DIR"/*.yaml
rm -f "$TEMP_DIR"/*.bak

echo ">>> Áp dụng toàn bộ hệ thống Manifests K8s (Declarative):"
kubectl apply -f "$TEMP_DIR/"

rm -rf "$TEMP_DIR"

echo ">>> Đang chờ các Pod khởi động hoàn tất..."
kubectl rollout status deployment/backend-deployment -n cloud-web-app --timeout=120s
kubectl rollout status deployment/frontend-deployment -n cloud-web-app --timeout=120s

echo "=================================================================="
echo "✅ Triển khai thành công! Kiểm tra phân bổ Pod trên worker1 & worker2:"
kubectl get pods -n cloud-web-app -o wide
echo "------------------------------------------------------------------"
echo "Kiểm tra Services:"
kubectl get svc -n cloud-web-app
echo "=================================================================="
