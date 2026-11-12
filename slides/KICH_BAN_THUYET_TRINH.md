# KỊCH BẢN THUYẾT TRÌNH & DEMO ĐỒ ÁN GIỮA KỲ ĐIỆN TOÁN ĐÁM MÂY
## ĐỀ TÀI: XÂY DỰNG & TRIỂN KHAI TODO APP (`v1.0` & `v2.0`) VỚI DOCKER VÀ CỤM KUBERNETES 3 NODE TRÊN CLOUD

---

### PHÂN CHIA THỜI LƯỢNG THUYẾT TRÌNH & ĐIỂM SỐ:

| Thời gian | Thành viên trình bày | Nội dung trình bày & Demo trực tiếp | Đóng góp điểm số |
|:---:|:---|:---|:---|
| **00:00 – 03:00** | **Thành viên 1**<br/>*(Nguyễn Phúc Bảo Minh)* | - Giới thiệu **Todo App tối giản** (Thêm công việc, Xem danh sách, Đổi trạng thái hoàn thành) kết nối Database.<br/>- Giới thiệu sự khác biệt giữa bản **`v1.0`** (giao diện Xanh Dương cơ bản) và bản **`v2.0`** (đổi màu Tím/Ngọc + thêm trường Độ ưu tiên, Danh mục, Hạn hoàn thành).<br/>- Trình bày `Dockerfile` của Frontend, Backend, Database; quá trình build & push image gắn tag `:v1.0`, `:v2.0` (không dùng `latest`) lên Docker Hub. | **Đóng gói Docker (2.0 điểm)** |
| **03:00 – 06:30** | **Thành viên 2 (BẠN)**<br/>*(Nguyễn Đình Hiếu)* | - Trình bày quá trình thuê **3 máy ảo trên Cloud** gồm 1 Control Plane (`cp`) và 2 Worker Nodes (`worker1`, `worker2`).<br/>- Trình bày cấu hình hệ thống (`swapoff`, kernel modules, sysctl), cài đặt `containerd`, `kubeadm`, `kubelet` và tích hợp plugin mạng **CNI (Flannel/Calico)**.<br/>- Demo lệnh `kubectl get nodes -o wide` hiển thị toàn bộ **3 node ở trạng thái `Ready`**.<br/>- **Demo Kịch bản chịu lỗi (Fault Tolerance)**: Trực tiếp bấm **Stop/Terminate** máy ảo `worker2` trên giao diện Cloud, quan sát `worker2` chuyển sang `NotReady` và ghi lại log các Pod Todo App của Thành viên 1 tự động tái tạo (Self-Healing) sang `worker1`. | **Dựng Cluster K8s (2.0 điểm) + 1/2 Kiểm tra chịu lỗi (trong 1.5 điểm vận hành)** |
| **06:30 – 09:00** | **Thành viên 3**<br/>*(Phạm Duy Anh)* | - Trình bày các file YAML K8s (Deployment, Service, PVC).<br/>- Demo **Rollout** nâng cấp Todo App từ `v1.0` lên `v2.0` và **Rollback** hoàn tác từ `v2.0` về `v1.0`. | **Triển khai K8s & Vận hành Rollout/Rollback** |

---

## 🎙️ LỜI THOẠI CHI TIẾT DÀNH RIÊNG CHO THÀNH VIÊN 2 (BẠN)

> *"Kính chào Thầy và các bạn! Em là **Nguyễn Đình Hiếu — Thành viên 2** của nhóm, chịu trách nhiệm chính cho phần **Dựng Cluster Kubernetes (2.0 điểm)** và phần **Thực hiện kịch bản chịu lỗi tắt Worker Node trên Cloud (nằm trong 1.5 điểm vận hành)**.*
>
> *Sau khi bạn Thành viên 1 đã đóng gói thành công các Docker image của ứng dụng Todo App (`todo-frontend`, `todo-backend`, `todo-db`) với tag phiên bản `v1.0` và `v2.0` đẩy lên Docker Hub, em tiến hành xây dựng hạ tầng cụm Kubernetes để vận hành hệ thống qua 4 bước cụ thể:*
>
> *1. **Khởi tạo 3 máy ảo (VM) trên nền tảng Cloud**:*
> *Em khởi tạo 3 máy ảo Ubuntu 22.04 LTS nằm trong cùng một mạng VPC, gồm: 1 máy **Control Plane** đặt hostname là `cp` (2 vCPU, 4GB RAM) và 2 máy **Worker Node** đặt hostname là `worker1` và `worker2` (2 vCPU, 2GB RAM).*
>
> *2. **Cài đặt cụm Kubernetes & tích hợp mạng CNI**:*
> *Trên cả 3 máy ảo, em thực hiện tắt bộ nhớ Swap (`swapoff -a`), nạp các module kernel `overlay` và `br_netfilter`, bật chuyển tiếp gói tin IPv4 và cầu nối iptables. Tiếp theo, em cài đặt `containerd` làm Container Runtime và cấu hình `SystemdCgroup = true` để đồng bộ cgroup driver với `kubelet`. Sau khi cài đặt `kubeadm`, `kubelet`, `kubectl`, trên máy `cp` em chạy lệnh `kubeadm init --pod-network-cidr=10.244.0.0/16 --node-name=cp` và tích hợp plugin mạng **CNI Flannel** (hoặc Calico), sau đó cho `worker1` và `worker2` gia nhập cụm bằng lệnh `kubeadm join`.*
>
> *3. **Kiểm tra trạng thái Cụm (`kubectl get nodes`)**:*
> *Như Thầy thấy trên màn hình terminal và trong báo cáo, khi chạy lệnh `kubectl get nodes -o wide`, toàn bộ 3 node `cp`, `worker1` và `worker2` đều hiển thị trạng thái **`Ready`**, và các Pod của ứng dụng Todo App được phân bổ đều trên cả `worker1` và `worker2`.*
>
> *4. **Thực hiện kịch bản chịu lỗi (Fault Tolerance)**:*
> *Bây giờ, trên giao diện quản trị Cloud, em trực tiếp thực hiện thao tác tắt nguồn (**Stop / Terminate**) máy ảo `worker2`. Trên cửa sổ terminal của `cp`, chúng ta quan sát thấy:*
> *- Sau 40 giây không nhận được tín hiệu Lease Heartbeat từ `kubelet` của `worker2`, Control Plane chuyển trạng thái `worker2` từ `Ready` sang **`NotReady`**.*
> *- Đồng thời `kube-proxy` loại bỏ ngay IP các Pod trên `worker2` khỏi danh sách `Endpoints`, giúp người dùng đang sử dụng Todo App vẫn thêm mới, xem danh sách và đổi trạng thái hoàn thành công việc bình thường mà không gặp lỗi.*
> *- Khi hết thời gian `pod-eviction-timeout`, các Pod trên `worker2` chuyển sang `Terminating`, và **ReplicaSet Controller** lập tức tự động tái tạo (reschedule) các Pod mới sang máy `worker1` để duy trì đủ số lượng 2 replicas như thiết kế.*
> *- Toàn bộ log quá trình Pod tự tái tạo đã được em ghi lại đầy đủ trong thư mục `docs/node-failure-logs/` để phục vụ báo cáo.*
>
> *Tiếp theo, em xin mời Thành viên 3 trình bày phần triển khai YAML và demo kịch bản Rollout từ `v1.0` lên `v2.0` và Rollback ạ!"*
