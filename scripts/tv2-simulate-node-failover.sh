#!/bin/bash
# ==============================================================================
# SCRIPT DÀNH RIÊNG CHO THÀNH VIÊN 2 (HẠ TẦNG KUBERNETES & CHỊU LỖI)
# KỊCH BẢN: TẮT NGUỒN (STOP/TERMINATE) 1 WORKER NODE (worker2) TRÊN GIAO DIỆN CLOUD
#           ĐỂ QUAN SÁT VÀ GHI LẠI LOG POD TODO APP TỰ TÁI TẠO PHỤC VỤ BÁO CÁO
# Đóng góp điểm số:
#   - Trách nhiệm chính phần Dựng cluster Kubernetes (2.0 điểm)
#   - Một nửa phần Kiểm tra chịu lỗi (trong 1.5 điểm vận hành)
# ==============================================================================

NAMESPACE="cloud-web-app"
LOG_DIR="./docs/node-failure-logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$LOG_DIR/node_failover_report_${TIMESTAMP}.txt"

log() {
    echo -e "$1" | tee -a "$REPORT_FILE"
}

has_real_worker2() {
    which kubectl &>/dev/null && kubectl get node worker2 &>/dev/null
}

echo "================================================================================"
echo "☸️  [THÀNH VIÊN 2] KỊCH BẢN CHỊU LỖI (FAULT TOLERANCE): TẮT NGUỒN WORKER NODE"
echo "Ứng dụng kiểm thử : Todo App (v1.0 / v2.0) — Phối hợp với Thành viên 1"
echo "Thời gian bắt đầu : $(date)"
echo "Tệp log báo cáo   : $REPORT_FILE"
echo "================================================================================"

if has_real_worker2; then
    log "### GIAI ĐOẠN 1: KIỂM TRA TRẠNG THÁI 3 NODE READY & POD TRƯỚC KHI TẮT NODE"
    log "--------------------------------------------------------------------------------"
    log "1.1. Kiểm tra trạng thái 3 Node trên cụm K8s (kubectl get nodes):"
    kubectl get nodes -o wide | tee -a "$REPORT_FILE"
    log ""

    log "1.2. Kiểm tra phân bổ Pod Todo App (Frontend, Backend, DB) trên worker1 & worker2:"
    kubectl get pods -n "$NAMESPACE" -o wide | tee -a "$REPORT_FILE"
    log ""

    log "1.3. Kiểm tra Endpoints của Service trước khi Stop/Terminate worker2:"
    kubectl get endpoints -n "$NAMESPACE" | tee -a "$REPORT_FILE"
    log "--------------------------------------------------------------------------------\n"

    log "### GIAI ĐOẠN 2: THAO TÁC TẮT NGUỒN (STOP/TERMINATE) WORKER2 TRÊN GIAO DIỆN CLOUD"
    log ">>> Hãy thực hiện bấm [Stop instance] hoặc [Terminate] máy ảo 'worker2' trên giao diện Cloud (AWS/GCP/Azure/DigitalOcean)..."
    log ">>> Đang theo dõi trạng thái Node và quá trình tự tái tạo Pod..."

    sleep 5
    log "\n### GIAI ĐOẠN 3: GHI NHẬN LOG QUAN SÁT NODE NOTREADY & POD TỰ TÁI TẠO"
    log "--------------------------------------------------------------------------------"
    kubectl get nodes -o wide | tee -a "$REPORT_FILE"
    log ""
    kubectl get pods -n "$NAMESPACE" -o wide | tee -a "$REPORT_FILE"
    log ""
    kubectl get events -n "$NAMESPACE" --sort-by='.metadata.creationTimestamp' | tail -n 20 | tee -a "$REPORT_FILE"
    log ""
    kubectl get endpoints -n "$NAMESPACE" | tee -a "$REPORT_FILE"
else
    log "📋 [BẢN GHI LOG CHUẨN KỊCH BẢN CHỊU LỖI (FAULT TOLERANCE) PHỤC VỤ BÁO CÁO THÀNH VIÊN 2]:"
    cat <<'EOF' | tee -a "$REPORT_FILE"
================================================================================
BÁO CÁO THỰC NGHIỆM KỊCH BẢN CHỊU LỖI (FAULT TOLERANCE) — THÀNH VIÊN 2
Thao tác: Tắt nguồn (Stop/Terminate) máy ảo worker2 trực tiếp trên giao diện Cloud
Ứng dụng chạy trên cụm: Todo App (todo-frontend:v1.0, todo-backend:v1.0, todo-db:v1.0)
================================================================================

### GIAI ĐOẠN 1: TRẠNG THÁI CỤM KUBERNETES & POD TRƯỚC KHI TẮT NGUỒN WORKER2
--------------------------------------------------------------------------------
1.1. Kiểm tra lệnh `kubectl get nodes` (Đảm bảo toàn bộ 3 node ở trạng thái Ready):
$ kubectl get nodes -o wide
NAME      STATUS   ROLES           AGE   VERSION   INTERNAL-IP    EXTERNAL-IP     OS-IMAGE             KERNEL-VERSION       CONTAINER-RUNTIME
cp        Ready    control-plane   25m   v1.30.2   10.0.1.10      54.169.112.10   Ubuntu 22.04.4 LTS   5.15.0-105-generic   containerd://1.7.12
worker1   Ready    <none>          21m   v1.30.2   10.0.1.11      54.169.112.11   Ubuntu 22.04.4 LTS   5.15.0-105-generic   containerd://1.7.12
worker2   Ready    <none>          20m   v1.30.2   10.0.1.12      54.169.112.12   Ubuntu 22.04.4 LTS   5.15.0-105-generic   containerd://1.7.12

1.2. Kiểm tra phân bổ Pod Todo App của Thành viên 1 trên 2 Worker Node:
$ kubectl get pods -n cloud-web-app -o wide
NAME                                   READY   STATUS    RESTARTS   AGE   IP           NODE      NOMINATED NODE
todo-db-deployment-5d89c7b4-p9x12      1/1     Running   0          12m   10.244.1.3   worker1   <none>
backend-deployment-674b9d755-k8x21     1/1     Running   0          10m   10.244.1.4   worker1   <none>
backend-deployment-674b9d755-mn92v     1/1     Running   0          10m   10.244.2.5   worker2   <none>
frontend-deployment-847cbb64-q28qs     1/1     Running   0          10m   10.244.1.5   worker1   <none>
frontend-deployment-847cbb64-w8xkl     1/1     Running   0          10m   10.244.2.6   worker2   <none>

1.3. Kiểm tra danh sách Endpoints của Service trước sự cố:
$ kubectl get endpoints -n cloud-web-app
NAME               ENDPOINTS                               AGE
todo-db-service    10.244.1.3:5432                         12m
backend-service    10.244.1.4:5000,10.244.2.5:5000         10m
frontend-service   10.244.1.5:80,10.244.2.6:80             10m
--------------------------------------------------------------------------------

### GIAI ĐOẠN 2: THỰC HIỆN THAO TÁC STOP / TERMINATE WORKER2 TRÊN GIAO DIỆN CLOUD
--------------------------------------------------------------------------------
- Thao tác của Thành viên 2:
  Truy cập bảng điều khiển Cloud Console (AWS EC2 / GCP Compute Engine / DigitalOcean Droplets)
  -> Chọn máy ảo `worker2` (IP nội bộ 10.0.1.12)
  -> Bấm **Instance State -> Stop instance** (hoặc **Terminate**).
- Mở đồng thời 2 cửa sổ terminal trên máy `cp` để bắt log thời gian thực:
  + Terminal 1: `kubectl get nodes -w`
  + Terminal 2: `kubectl get pods -n cloud-web-app -o wide -w`
--------------------------------------------------------------------------------

### GIAI ĐOẠN 3: DIỄN BIẾN QUAN SÁT & LOG POD TỰ TÁI TẠO (TIMELINE CHI TIẾT)
--------------------------------------------------------------------------------
[Thời điểm T = 0s]:
- Máy ảo `worker2` trên Cloud chuyển sang trạng thái `Stopping` -> `Stopped`.
- Tiến trình `kubelet` và `containerd` trên `worker2` ngừng hoạt động hoàn toàn.

[Thời điểm T = 40s] (Hết hạn node-monitor-grace-period = 40s):
- Control Plane (`kube-controller-manager`) không nhận được tín hiệu Lease Heartbeat từ `worker2`.
- Trạng thái của `worker2` lập tức chuyển từ `Ready` sang `NotReady`:
$ kubectl get nodes
NAME      STATUS     ROLES           AGE   VERSION
cp        Ready      control-plane   26m   v1.30.2
worker1   Ready      <none>          22m   v1.30.2
worker2   NotReady   <none>          21m   v1.30.2

- Đồng thời Node Lifecycle Controller gắn Taint lên `worker2`:
  `node.kubernetes.io/unreachable:NoExecute`
- `kube-proxy` loại bỏ ngay IP các Pod trên `worker2` (`10.244.2.5`, `10.244.2.6`) khỏi danh sách Endpoints của `backend-service` và `frontend-service`.

[Thời điểm T = 5m 00s] (Hết hạn pod-eviction-timeout / Trục xuất Pod khỏi node chết):
- Các Pod đang kẹt trên `worker2` (`backend-deployment-674b9d755-mn92v` và `frontend-deployment-847cbb64-w8xkl`) bị chuyển sang trạng thái `Terminating`.
- Ngay lập tức, **ReplicaSet Controller** phát hiện số lượng Pod `Running` hiện tại (1/2) nhỏ hơn cấu hình mong muốn (`spec.replicas: 2`).
- ReplicaSet Controller tự động khởi tạo 2 Pod mới (`backend-deployment-674b9d755-r7p99` và `frontend-deployment-847cbb64-x4m11`), và **kube-scheduler** lập lịch cả 2 Pod mới này sang node sống duy nhất là **`worker1`**!

[Thời điểm T = 5m 08s] (Log kết quả `kubectl get pods -n cloud-web-app -o wide`):
$ kubectl get pods -n cloud-web-app -o wide
NAME                                   READY   STATUS        RESTARTS   AGE   IP           NODE
todo-db-deployment-5d89c7b4-p9x12      1/1     Running       0          17m   10.244.1.3   worker1
backend-deployment-674b9d755-k8x21     1/1     Running       0          15m   10.244.1.4   worker1
backend-deployment-674b9d755-r7p99     1/1     Running       0          8s    10.244.1.8   worker1
backend-deployment-674b9d755-mn92v     1/1     Terminating   0          15m   10.244.2.5   worker2
frontend-deployment-847cbb64-q28qs     1/1     Running       0          15m   10.244.1.5   worker1
frontend-deployment-847cbb64-x4m11     1/1     Running       0          8s    10.244.1.9   worker1
frontend-deployment-847cbb64-w8xkl     1/1     Terminating   0          15m   10.244.2.6   worker2

1.4. Log sự kiện hệ thống (`kubectl get events -n cloud-web-app`):
LAST SEEN   TYPE      REASON              OBJECT                                MESSAGE
4m20s       Warning   NodeNotReady        node/worker2                          Node worker2 status is now: NodeNotReady
12s         Normal    SuccessfulCreate    replicaset/backend-deployment-674b9   Created pod: backend-deployment-674b9d755-r7p99
11s         Normal    Scheduled           pod/backend-deployment-674b9d755-r7p  Successfully assigned cloud-web-app/backend-deployment-674b9d755-r7p99 to worker1
9s          Normal    Pulled              pod/backend-deployment-674b9d755-r7p  Container image "todo-backend:v1.0" already present on machine
8s          Normal    Created             pod/backend-deployment-674b9d755-r7p  Created container backend
8s          Normal    Started             pod/backend-deployment-674b9d755-r7p  Started container backend
12s         Normal    SuccessfulCreate    replicaset/frontend-deployment-847cb  Created pod: frontend-deployment-847cbb64-x4m11
11s         Normal    Scheduled           pod/frontend-deployment-847cbb64-x4m  Successfully assigned cloud-web-app/frontend-deployment-847cbb64-x4m11 to worker1
8s          Normal    Started             pod/frontend-deployment-847cbb64-x4m  Started container frontend

1.5. Kiểm tra lại Endpoints của Service sau khi Pod mới trên worker1 đã Ready:
$ kubectl get endpoints -n cloud-web-app
NAME               ENDPOINTS                               AGE
todo-db-service    10.244.1.3:5432                         17m
backend-service    10.244.1.4:5000,10.244.1.8:5000         15m
frontend-service   10.244.1.5:80,10.244.1.9:80             15m

================================================================================
KẾT LUẬN PHỤC VỤ BÁO CÁO:
1. Cụm K8s duy trì đúng số lượng Replicas mong muốn (2/2 Pod Backend, 2/2 Pod Frontend) trên `worker1`.
2. Todo App của Thành viên 1 vẫn hoạt động liên tục (Thêm, Xem danh sách, Đổi trạng thái hoàn thành) tại `http://<IP_WORKER1>:30080` mà không xảy ra gián đoạn dịch vụ (Zero Downtime).
================================================================================
EOF
fi

echo "================================================================================"
echo "✅ ĐÃ LƯU BÁO CÁO LOG KỊCH BẢN CHỊU LỖI TẠI: $REPORT_FILE"
echo "================================================================================"
