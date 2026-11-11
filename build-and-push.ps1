# Automated Docker Build & Push Script for Windows PowerShell
$ErrorActionPreference = "Stop"

$DOCKER_USER = "tonton15"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host " AUTOMATED DOCKER BUILD & PUSH SCRIPT (V1.0 & V2.0)" -ForegroundColor Green
Write-Host " Username: $DOCKER_USER" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan

# ----------------------------------------------------
# 1. BUILD & PUSH V1.0 (Theme Xanh dương)
# ----------------------------------------------------
Write-Host "`n[1/4] Chuẩn bị mã nguồn Frontend V1.0 (Xanh dương)..." -ForegroundColor Cyan
Copy-Item "frontend/src/App.v1.jsx" -Destination "frontend/src/App.jsx" -Force

Write-Host "[2/4] Đang Build và Push V1.0..." -ForegroundColor Cyan
Write-Host "- Đang build todo-backend:v1.0..." -ForegroundColor Gray
docker build -t "$DOCKER_USER/todo-backend:v1.0" ./backend
Write-Host "- Đang push todo-backend:v1.0..." -ForegroundColor Gray
docker push "$DOCKER_USER/todo-backend:v1.0"

Write-Host "- Đang build todo-frontend:v1.0..." -ForegroundColor Gray
docker build -t "$DOCKER_USER/todo-frontend:v1.0" ./frontend
Write-Host "- Đang push todo-frontend:v1.0..." -ForegroundColor Gray
docker push "$DOCKER_USER/todo-frontend:v1.0"

Write-Host "`n✔ Hoàn tất V1.0 trên Docker Hub!" -ForegroundColor Green

# ----------------------------------------------------
# 2. BUILD & PUSH V2.0 (Theme Cam/Đỏ Hot Update)
# ----------------------------------------------------
Write-Host "`n[3/4] Chuẩn bị mã nguồn Frontend V2.0 (Cam/Đỏ Hot Update)..." -ForegroundColor Cyan
Copy-Item "frontend/src/App.v2.jsx" -Destination "frontend/src/App.jsx" -Force

Write-Host "[4/4] Đang Build và Push V2.0..." -ForegroundColor Cyan
Write-Host "- Đang build todo-backend:v2.0..." -ForegroundColor Gray
docker build -t "$DOCKER_USER/todo-backend:v2.0" ./backend
Write-Host "- Đang push todo-backend:v2.0..." -ForegroundColor Gray
docker push "$DOCKER_USER/todo-backend:v2.0"

Write-Host "- Đang build todo-frontend:v2.0..." -ForegroundColor Gray
docker build -t "$DOCKER_USER/todo-frontend:v2.0" ./frontend
Write-Host "- Đang push todo-frontend:v2.0..." -ForegroundColor Gray
docker push "$DOCKER_USER/todo-frontend:v2.0"

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "✔ THÀNH CÔNG RỰC RỠ! Tất cả 4 image đã lên Docker Hub:" -ForegroundColor Green
Write-Host "  - $DOCKER_USER/todo-backend:v1.0" -ForegroundColor White
Write-Host "  - $DOCKER_USER/todo-frontend:v1.0" -ForegroundColor White
Write-Host "  - $DOCKER_USER/todo-backend:v2.0" -ForegroundColor White
Write-Host "  - $DOCKER_USER/todo-frontend:v2.0" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green
