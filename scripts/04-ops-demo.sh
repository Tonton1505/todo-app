#!/bin/bash
# ==============================================================================
# Script 04: Thao tác Vận hành trên Kubernetes (Ops Demo)
# Bao gồm:
#   - Scale Deployment
#   - Rollout cập nhật Todo App từ v1.0 lên v2.0
#   - Rollback hoàn tác từ v2.0 về lại v1.0
#   - Kiểm tra trạng thái Cluster & Pods
# ==============================================================================

set -e

NAMESPACE="cloud-web-app"
ACTION="$1"
DOCKER_USER="${2:-tonton15}"

usage() {
    echo "Sử dụng: $0 {scale|scale-down|update|rollback|status} [docker_username]"
    echo ""
    echo "  scale               : Scale Frontend & Backend Todo App lên 4 replicas"
    echo "  scale-down          : Scale lại về 2 replicas"
    echo "  update <user>       : Rollout cập nhật Todo App từ bản v1.0 sang v2.0"
    echo "  rollback            : Rollback hoàn tác Todo App từ v2.0 về lại v1.0"
    echo "  status              : Kiểm tra trạng thái 3 Nodes, Pods và Lịch sử Rollout"
    exit 1
}

case "$ACTION" in
    scale)
        echo "📈 Đang scale Todo App Deployment lên 4 replicas..."
        kubectl scale deployment/frontend-deployment --replicas=4 -n "$NAMESPACE"
        kubectl scale deployment/backend-deployment --replicas=4 -n "$NAMESPACE"
        kubectl rollout status deployment/frontend-deployment -n "$NAMESPACE"
        echo "📊 Danh sách Pod sau khi Scale (Phân bổ đều trên worker1 và worker2):"
        kubectl get pods -n "$NAMESPACE" -o wide
        ;;

    scale-down)
        echo "📉 Đang scale về lại 2 replicas..."
        kubectl scale deployment/frontend-deployment --replicas=2 -n "$NAMESPACE"
        kubectl scale deployment/backend-deployment --replicas=2 -n "$NAMESPACE"
        kubectl get pods -n "$NAMESPACE" -o wide
        ;;

    update)
        echo "🚀 Đang thực hiện Rollout cập nhật Todo App từ v1.0 lên v2.0..."
        kubectl set image deployment/backend-deployment backend="$DOCKER_USER/todo-backend:v2.0" -n "$NAMESPACE"
        kubectl set env deployment/backend-deployment APP_VERSION=v2.0 -n "$NAMESPACE"
        kubectl set image deployment/frontend-deployment frontend="$DOCKER_USER/todo-frontend:v2.0" -n "$NAMESPACE"

        echo "⏳ Quan sát tiến trình Rolling Update (Zero Downtime)..."
        kubectl rollout status deployment/backend-deployment -n "$NAMESPACE"
        kubectl rollout status deployment/frontend-deployment -n "$NAMESPACE"

        echo "✅ Đã Rollout thành công lên phiên bản v2.0!"
        kubectl get pods -n "$NAMESPACE" -o wide
        ;;

    rollback)
        echo "⏪ Đang thực hiện Rollback hoàn tác Todo App từ v2.0 về lại v1.0..."
        kubectl rollout undo deployment/backend-deployment -n "$NAMESPACE"
        kubectl rollout undo deployment/frontend-deployment -n "$NAMESPACE"

        echo "⏳ Đang theo dõi tiến trình Rollback..."
        kubectl rollout status deployment/backend-deployment -n "$NAMESPACE"
        kubectl rollout status deployment/frontend-deployment -n "$NAMESPACE"

        echo "✅ Rollback về v1.0 thành công!"
        kubectl rollout history deployment/backend-deployment -n "$NAMESPACE"
        kubectl get pods -n "$NAMESPACE" -o wide
        ;;

    status)
        echo "=== [TRẠNG THÁI CỤM K8S 3 NODE & TODO APP] ==="
        echo "1. Danh sách 3 Nodes (cp, worker1, worker2):"
        kubectl get nodes -o wide
        echo ""
        echo "2. Danh sách Pods trong namespace $NAMESPACE:"
        kubectl get pods -n "$NAMESPACE" -o wide
        echo ""
        echo "3. Lịch sử Rollout Backend:"
        kubectl rollout history deployment/backend-deployment -n "$NAMESPACE"
        ;;

    *)
        usage
        ;;
esac
