# HƯỚNG DẪN TRIỂN KHAI VÀ QUY TRÌNH KIỂM TRA HẠ TẦNG KUBERNETES
## BỘ PHẬN: HẠ TẦNG CỤM & TÍNH SẴN SÀNG CAO (MEMBER 2 - INFRASTRUCTURE ENGINEER)
**Dự án**: Hệ thống Quản lý Công việc (Todo App `v1.0` & `v2.0`) trên Kubernetes Cluster  
**Phạm vi trách nhiệm**:
- Khởi tạo 3 máy ảo trên nền tảng Cloud (1 Control Plane + 2 Workers).
- Cài đặt Container Runtime (`containerd`), bộ công cụ `kubeadm`, `kubelet`, `kubectl` và CNI Plugin (`Flannel`/`Calico`).
- Đảm bảo trạng thái toàn bộ các Node đạt `Ready`.
- Thực thi kịch bản kiểm thử khả năng chịu lỗi (Fault Tolerance): Tắt nguồn (`Stop`/`Terminate`) một Worker Node và thu thập telemetry/logs tự phục hồi của Pod.

---

## 1. QUY TRÌNH KIỂM TRA HẠ TẦNG KUBERNETES (AUTOMATED & MANUAL)

### 1.1. Kiểm tra tự động bằng Script xác thực
Dự án cung cấp công cụ tự động hóa kiểm tra toàn diện trạng thái của Cụm:
```bash
chmod +x ./scripts/check-tv2-cluster.sh
./scripts/check-tv2-cluster.sh
```

**Các tiêu chí được script kiểm tra tự động**:
1. **API Server Connectivity**: Kiểm tra kết nối từ `kubectl` tới Control Plane.
2. **Node Topology**: Xác minh sự hiện diện của 3 máy ảo (`cp`, `worker1`, `worker2`).
3. **Node Readiness**: Toàn bộ các Node phải có `STATUS = Ready`.
4. **Container Runtime**: Xác nhận `containerd` đang vận hành với `SystemdCgroup = true`.
5. **CNI Network**: Kiểm tra các Pod của CNI Plugin (`flannel` hoặc `calico`) trong namespace `kube-system`.
6. **Workload Scheduling (Anti-Affinity)**: Kiểm tra các bản sao Pod Backend/Frontend được phân bổ đối xứng trên cả `worker1` và `worker2`.
7. **Service Endpoints**: Kiểm tra danh sách địa chỉ IP đăng ký dưới `backend-service`.

---

### 1.2. Quy trình kiểm tra thủ công bằng câu lệnh (Command-by-Command)

#### Bước 1: Kiểm tra trạng thái và thông số 3 Node
Chạy trên máy `cp`:
```bash
kubectl get nodes -o wide
```
**Yêu cầu đầu ra chuẩn**:
```text
NAME      STATUS   ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP     OS-IMAGE             KERNEL-VERSION       CONTAINER-RUNTIME
cp        Ready    control-plane   25m   v1.30.2   10.0.1.10     54.169.112.10   Ubuntu 22.04.4 LTS   5.15.0-105-generic   containerd://1.7.12
worker1   Ready    <none>          21m   v1.30.2   10.0.1.11     54.169.112.11   Ubuntu 22.04.4 LTS   5.15.0-105-generic   containerd://1.7.12
worker2   Ready    <none>          20m   v1.30.2   10.0.1.12     54.169.112.12   Ubuntu 22.04.4 LTS   5.15.0-105-generic   containerd://1.7.12
```

#### Bước 2: Kiểm tra các thành phần cốt lõi của hệ thống (System Pods)
```bash
kubectl get pods -n kube-system -o wide
```
**Xác nhận các tiến trình sau ở trạng thái `Running`**:
- `etcd-cp`
- `kube-apiserver-cp`
- `kube-controller-manager-cp`
- `kube-scheduler-cp`
- `kube-flannel-ds-*` (hoặc `calico-node-*`)
- `kube-proxy-*`
- `coredns-*`

#### Bước 3: Kiểm tra phân bổ Pod ứng dụng trên 2 Worker Node
Triển khai ứng dụng (nếu chưa deploy):
```bash
./scripts/03-deploy-app.sh <DOCKERHUB_USERNAME>
```
Kiểm tra vị trí đặt Pod:
```bash
kubectl get pods -n cloud-web-app -o wide
```
**Xác nhận**: Mỗi Deployment (`backend-deployment` và `frontend-deployment`) phải có đúng 1 Pod trên `worker1` và 1 Pod trên `worker2` theo cấu hình `podAntiAffinity`.

---

## 2. QUY TRÌNH THỰC HIỆN VÀ KIỂM TRA KỊCH BẢN CHỊU LỖI (FAULT TOLERANCE)

### 2.1. Thiết lập giám sát thời gian thực
Mở 2 phiên Terminal trên máy Control Plane (`cp`):
- **Terminal 1 (Giám sát trạng thái Node)**:
  ```bash
  kubectl get nodes -w
  ```
- **Terminal 2 (Giám sát trạng thái và vị trí Pod)**:
  ```bash
  kubectl get pods -n cloud-web-app -o wide -w
  ```

### 2.2. Thao tác tắt nguồn Worker Node trên giao diện Cloud
1. Truy cập Web Console của nền tảng Cloud (AWS Management Console, Google Cloud Console, Azure Portal hoặc DigitalOcean Dashboard).
2. Tìm máy ảo `worker2`.
3. Thực hiện thao tác: **Instance State &rarr; Stop instance** (hoặc **Power Off** / **Terminate**).

### 2.3. Các mốc thời gian ghi nhận (Timeline Checklist)
| Thời điểm | Hiện tượng quan sát | Hành vi của Kubernetes Controller |
|:---|:---|:---|
| **T = 0s** | Máy ảo `worker2` chuyển trạng thái `Stopping` / `Stopped` trên Cloud. | Kubelet trên `worker2` ngừng gửi bản tin Lease Heartbeat về API Server. |
| **T = 40s** | Terminal 1 hiển thị `worker2` chuyển sang `NotReady`. | `node-lifecycle-controller` gắn taint `node.kubernetes.io/unreachable:NoExecute`. `kube-proxy` rút các IP của Pod trên `worker2` khỏi Service Endpoints. Lưu lượng chuyển toàn bộ sang `worker1`. |
| **T = 5m** *(hoặc khi drain/evict)* | Terminal 2 ghi nhận các Pod trên `worker2` chuyển sang `Terminating`. | `ReplicaSet Controller` phát hiện thiếu hụt bản sao (`spec.replicas: 2`). `kube-scheduler` lập tức tạo và gán Pod thay thế sang node sống duy nhất là `worker1`. |
| **T = 5m08s** | Pod mới chuyển sang trạng thái `Running` trên `worker1`. | Service Endpoints được cập nhật. Hệ thống duy trì 100% tính sẵn sàng. |

### 2.4. Trích xuất bản ghi chứng minh (Log Evidences)
1. Xuất danh sách sự kiện hệ thống ghi nhận quá trình tái lập lịch Pod:
   ```bash
   kubectl get events -n cloud-web-app --sort-by='.metadata.creationTimestamp'
   ```
2. Xuất trạng thái Endpoint cuối cùng:
   ```bash
   kubectl get endpoints -n cloud-web-app
   ```
3. Lưu báo cáo tự động bằng script:
   ```bash
   ./scripts/tv2-simulate-node-failover.sh
   ```
   Tệp nhật ký được tạo tại thư mục: `docs/node-failure-logs/`.

---

## 3. THIẾT LẬP BAN ĐẦU HẠ TẦNG (REFERENCE SETUP)

### 3.1. Thông số máy ảo
- **Node `cp`**: 2 vCPU, 4GB RAM, 20GB SSD, Ubuntu 22.04 LTS.
- **Node `worker1`**: 2 vCPU, 2GB RAM, 15GB SSD, Ubuntu 22.04 LTS.
- **Node `worker2`**: 2 vCPU, 2GB RAM, 15GB SSD, Ubuntu 22.04 LTS.

### 3.2. Cấu hình hệ thống (Cả 3 Node)
Chạy script tự động:
```bash
./scripts/01-setup-prerequisites.sh
```

### 3.3. Khởi tạo Control Plane & CNI
Chạy trên máy `cp`:
```bash
./scripts/02-init-control-plane.sh flannel
```
Chạy lệnh `kubeadm join` in ra từ Control Plane trên `worker1` và `worker2`.
