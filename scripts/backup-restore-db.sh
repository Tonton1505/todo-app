#!/bin/bash
# ==============================================================================
# Script: backup-restore-db.sh
# Mục đích: Tự động sao lưu và khôi phục cơ sở dữ liệu Todo App (K8s & Docker)
# ==============================================================================

set -e

NAMESPACE="cloud-web-app"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

usage() {
    echo "Cách sử dụng: $0 {backup|restore <file_tar_gz>|simulate-disaster}"
    echo ""
    echo "  backup              : Sao lưu database Todo App từ Pod K8s hoặc Docker Container"
    echo "  restore <file>      : Khôi phục database Todo App từ file sao lưu"
    echo "  simulate-disaster   : Giả lập thảm họa xóa nhầm dữ liệu để kiểm chứng restore"
    exit 1
}

detect_environment() {
    if which kubectl &>/dev/null && kubectl get namespace "$NAMESPACE" &>/dev/null; then
        K8S_POD=$(kubectl get pods -n "$NAMESPACE" -l app=backend --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
        if [ -n "$K8S_POD" ]; then
            ENV_TYPE="k8s"
            TARGET_ID="$K8S_POD"
            return
        fi
    fi

    if docker ps --filter "name=todo-backend" --filter "status=running" -q | grep -q .; then
        ENV_TYPE="docker"
        TARGET_ID="todo-backend-v1.0"
        return
    fi

    echo "❌ Không tìm thấy Backend Pod trên Kubernetes hoặc Docker container 'todo-backend-v1.0' đang chạy!"
    exit 1
}

ACTION="$1"
detect_environment

case "$ACTION" in
    backup)
        BACKUP_FILE="$BACKUP_DIR/todo_db_backup_${TIMESTAMP}.tar.gz"
        echo "=========================================================="
        echo "📦 BẮT ĐẦU SAO LƯU DATABASE TODO APP TỪ: [$ENV_TYPE] ($TARGET_ID)"
        echo "=========================================================="

        if [ "$ENV_TYPE" = "k8s" ]; then
            kubectl exec -n "$NAMESPACE" "$TARGET_ID" -- tar -czf /tmp/db_dump.tar.gz -C /app/data .
            kubectl cp "$NAMESPACE/$TARGET_ID:/tmp/db_dump.tar.gz" "$BACKUP_FILE"
            kubectl exec -n "$NAMESPACE" "$TARGET_ID" -- rm -f /tmp/db_dump.tar.gz
        else
            docker exec "$TARGET_ID" tar -czf /tmp/db_dump.tar.gz -C /app/data .
            docker cp "$TARGET_ID:/tmp/db_dump.tar.gz" "$BACKUP_FILE"
            docker exec "$TARGET_ID" rm -f /tmp/db_dump.tar.gz
        fi

        echo "✅ Sao lưu thành công! File lưu tại: $BACKUP_FILE"
        ls -lh "$BACKUP_FILE"
        ;;

    restore)
        RESTORE_FILE="$2"
        if [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
            echo "❌ Lỗi: Vui lòng chỉ định đường dẫn file backup hợp lệ (.tar.gz)!"
            exit 1
        fi

        echo "=========================================================="
        echo "🔄 BẮT ĐẦU KHÔI PHỤC DATABASE TODO APP LÊN [$ENV_TYPE]: $TARGET_ID"
        echo "=========================================================="

        if [ "$ENV_TYPE" = "k8s" ]; then
            kubectl cp "$RESTORE_FILE" "$NAMESPACE/$TARGET_ID:/tmp/restore.tar.gz"
            kubectl exec -n "$NAMESPACE" "$TARGET_ID" -- sh -c "tar -xzf /tmp/restore.tar.gz -C /app/data/ && rm -f /tmp/restore.tar.gz"
            kubectl rollout restart deployment/backend-deployment -n "$NAMESPACE"
        else
            docker cp "$RESTORE_FILE" "$TARGET_ID:/tmp/restore.tar.gz"
            docker exec "$TARGET_ID" sh -c "tar -xzf /tmp/restore.tar.gz -C /app/data/ && rm -f /tmp/restore.tar.gz"
            docker restart "$TARGET_ID"
        fi

        echo "🎉 Khôi phục database Todo App thành công!"
        ;;

    simulate-disaster)
        echo "⚠️  Giả lập xóa dữ liệu Todo App trên $TARGET_ID..."
        if [ "$ENV_TYPE" = "k8s" ]; then
            kubectl exec -n "$NAMESPACE" "$TARGET_ID" -- sh -c "rm -f /app/data/*.json"
            kubectl rollout restart deployment/backend-deployment -n "$NAMESPACE"
        else
            docker exec "$TARGET_ID" sh -c "rm -f /app/data/*.json"
            docker restart "$TARGET_ID"
        fi
        echo "👉 Để khôi phục lại dữ liệu, chạy lệnh: $0 restore <file_backup_vua_tao>"
        ;;

    *)
        usage
        ;;
esac
