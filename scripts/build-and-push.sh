#!/bin/bash
set -e

# ==============================================================================
# Script: build-and-push.sh (Thành viên 1 phụ trách — 2.0 điểm Đóng gói Docker)
# Mục đích:
#   - Build Docker images cho Database, Backend & Frontend của Todo App
#   - Gắn tag phiên bản cụ thể: v1.0 và v2.0 (TUYỆT ĐỐI KHÔNG DÙNG TAG latest)
#   - Đẩy (push) toàn bộ image lên Docker Hub để cụm K8s của Thành viên 2 kéo về
# ==============================================================================

DOCKER_USER="${1:-yourdockerhubusername}"

echo "=================================================================="
echo "🐳 BẮT ĐẦU ĐÓNG GÓI DOCKER CHO TODO APP (v1.0 & v2.0)"
echo "Docker Hub Username: $DOCKER_USER"
echo "Quy tắc: Gắn tag cụ thể v1.0, v2.0 — Tuyệt đối không dùng latest"
echo "=================================================================="

# 1. BUILD DATABASE IMAGE (v1.0)
echo "➡️  [1/5] Đang build Database Image (todo-db:v1.0)..."
docker build \
  -t "$DOCKER_USER/todo-db:v1.0" ./database

# 2. BUILD BACKEND v1.0 (Giao diện & API cơ bản)
echo "➡️  [2/5] Đang build Backend Image bản cơ bản (todo-backend:v1.0)..."
docker build --build-arg APP_VERSION=v1.0 \
  -t "$DOCKER_USER/todo-backend:v1.0" ./backend

# 3. BUILD BACKEND v2.0 (Thêm trường độ ưu tiên, danh mục, hạn hoàn thành)
echo "➡️  [3/5] Đang build Backend Image bản cập nhật (todo-backend:v2.0)..."
docker build --build-arg APP_VERSION=v2.0 \
  -t "$DOCKER_USER/todo-backend:v2.0" ./backend

# 4. BUILD FRONTEND v1.0 (Giao diện Xanh Dương chuẩn)
echo "➡️  [4/5] Đang build Frontend Image bản cơ bản (todo-frontend:v1.0)..."
docker build --build-arg APP_VERSION=v1.0 \
  -t "$DOCKER_USER/todo-frontend:v1.0" ./frontend

# 5. BUILD FRONTEND v2.0 (Đổi màu giao diện Tím/Ngọc + Form trường mới phục vụ Rollout/Rollback)
echo "➡️  [5/5] Đang build Frontend Image bản cập nhật (todo-frontend:v2.0)..."
docker build --build-arg APP_VERSION=v2.0 \
  -t "$DOCKER_USER/todo-frontend:v2.0" ./frontend

echo "=================================================================="
echo "✅ Hoàn tất Build danh sách Docker Images (Không có tag latest):"
docker images | grep "$DOCKER_USER/todo-" || true
echo "=================================================================="

read -p "Bạn có muốn đẩy (push) các image v1.0 & v2.0 lên Docker Hub ngay không? (y/N): " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "🔑 Kiểm tra đăng nhập Docker Hub..."
    docker login

    echo "🚀 Đang push Database image..."
    docker push "$DOCKER_USER/todo-db:v1.0"

    echo "🚀 Đang push Backend images (v1.0 & v2.0)..."
    docker push "$DOCKER_USER/todo-backend:v1.0"
    docker push "$DOCKER_USER/todo-backend:v2.0"

    echo "🚀 Đang push Frontend images (v1.0 & v2.0)..."
    docker push "$DOCKER_USER/todo-frontend:v1.0"
    docker push "$DOCKER_USER/todo-frontend:v2.0"

    echo "🎉 Tất cả Docker images (v1.0 & v2.0) đã được đẩy lên Docker Hub thành công!"
else
    echo "💡 Bạn có thể đẩy thủ công lên Docker Hub bằng các lệnh:"
    echo "   docker push $DOCKER_USER/todo-db:v1.0"
    echo "   docker push $DOCKER_USER/todo-backend:v1.0"
    echo "   docker push $DOCKER_USER/todo-backend:v2.0"
    echo "   docker push $DOCKER_USER/todo-frontend:v1.0"
    echo "   docker push $DOCKER_USER/todo-frontend:v2.0"
fi
