# BÁO CÁO CHI TIẾT DỰ ÁN ĐIỆN TOÁN ĐÁM MÂY (CLOUD COMPUTING)
## ĐỀ TÀI: HỆ THỐNG TODO APP (`v1.0` & `v2.0`) TRÊN DOCKER & CỤM KUBERNETES 3 NODE (`cp`, `worker1`, `worker2`)

---

## 1. TỔNG QUAN ĐỀ TÀI & PHÂN CÔNG NHIỆM VỤ

Dự án xây dựng, đóng gói và triển khai hệ thống **Todo App tối giản** kết nối Cơ sở dữ liệu (Database) lên cụm **Kubernetes 3 máy ảo Cloud (`cp`, `worker1`, `worker2`)**, đáp ứng đầy đủ các tiêu chí chấm điểm:
- **Thành viên 1 (2.0 điểm — Đóng gói Docker)**:
  - Xây dựng Backend & Frontend **Todo App tối giản** (gồm 3 chức năng cốt lõi: **Thêm công việc**, **Xem danh sách**, **Đổi trạng thái hoàn thành**) và kết nối với **Database (PostgreSQL / Persistent Volume)**.
  - Phiên bản hóa rõ ràng:
    - **Bản `v1.0`**: Giao diện Xanh Dương cơ bản và RESTful API chuẩn.
    - **Bản `v2.0`**: Đổi màu giao diện sang Tím/Ngọc lục bảo + Bổ sung thêm các trường dữ liệu (`priority`, `category`, `dueDate`) phục vụ kịch bản demo **Rollout / Rollback**.
  - Viết `Dockerfile` cho Frontend, Backend và Database; build image gắn tag `:v1.0` và `:v2.0` (tuyệt đối không dùng `latest`) và đẩy lên Docker Hub.
- **Thành viên 2 (2.0 điểm Dựng Cluster K8s + 1/2 của 1.5 điểm Kiểm tra chịu lỗi)**:
  - **Khởi tạo VM**: Thuê 3 máy ảo trên nền tảng Cloud (AWS, GCP, Azure hoặc DigitalOcean) gồm 1 Control Plane (`cp`) và 2 Worker Node (`worker1`, `worker2`).
  - **Cài đặt cụm K8s**: Cấu hình hệ thống, cài đặt `containerd`, `kubeadm`, `kubelet` và tích hợp plugin mạng (CNI Flannel hoặc Calico).
  - **Kiểm tra trạng thái**: Đảm bảo lệnh `kubectl get nodes` hiển thị toàn bộ 3 node ở trạng thái `Ready`.
  - **Thực hiện kịch bản chịu lỗi (Fault Tolerance)**: Trực tiếp tắt nguồn (**Stop/Terminate**) một worker node (`worker2`) trên giao diện Cloud để quan sát và ghi lại log Pod tự tái tạo sang `worker1` phục vụ báo cáo.

---

## 2. KIẾN TRÚC ỨNG DỤNG & CƠ SỞ DỮ LIỆU (THÀNH VIÊN 1)

### 2.1. Thiết kế Cơ sở dữ liệu (`database/init.sql` & `database/Dockerfile`)
Bảng `todos` lưu trữ thông tin công việc cho cả 2 phiên bản `v1.0` và `v2.0`:
- `id` (`VARCHAR(64) PRIMARY KEY`): Định danh công việc.
- `title` (`VARCHAR(255) NOT NULL`): Nội dung công việc.
- `completed` (`BOOLEAN DEFAULT FALSE`): Trạng thái hoàn thành (`true` / `false`).
- `priority` (`VARCHAR(20) DEFAULT 'medium'`): Mức độ ưu tiên (`high`, `medium`, `low` — hiển thị trên giao diện `v2.0`).
- `category` (`VARCHAR(50) DEFAULT 'General'`): Phân loại công việc (hiển thị trên giao diện `v2.0`).
- `due_date` (`VARCHAR(30)`): Hạn hoàn thành (hiển thị trên giao diện `v2.0`).
- `created_on_node` (`VARCHAR(100)`): Ghi nhận Worker Node đã xử lý request tạo công việc (`worker1` hoặc `worker2`).

### 2.2. Danh sách API Backend (`backend/server.js`)
| Phương thức | Endpoint | Chức năng | Phiên bản áp dụng |
|:---:|:---|:---|:---:|
| `GET` | `/api/todos` | Xem danh sách công việc từ Database (hỗ trợ lọc trạng thái) | `v1.0` & `v2.0` |
| `POST` | `/api/todos` | Thêm công việc mới (`v1.0`: `title`; `v2.0`: thêm `priority`, `category`, `dueDate`) | `v1.0` & `v2.0` |
| `PATCH` | `/api/todos/:id/toggle` | Đổi trạng thái hoàn thành (`completed: true/false`) | `v1.0` & `v2.0` |
| `DELETE` | `/api/todos/:id` | Xóa công việc khỏi Database | `v1.0` & `v2.0` |
| `GET` | `/api/info` | Trả về `POD_NAME`, `POD_IP`, `NODE_NAME`, `APP_VERSION`, `dbStatus` | `v1.0` & `v2.0` |
| `GET` | `/health` | Healthcheck cho Kubernetes `livenessProbe` & `readinessProbe` | `v1.0` & `v2.0` |

---

## 3. HẠ TẦNG KUBERNETES 3 NODE & KỊCH BẢN CHỊU LỖI (THÀNH VIÊN 2)

Chi tiết toàn bộ các lệnh cài đặt cụm K8s (`containerd`, `kubeadm`, `kubelet`, CNI Flannel/Calico) và nhật ký thực nghiệm tắt nguồn máy ảo `worker2` trên Cloud được trình bày đầy đủ tại:
- 📘 Hướng dẫn thực hành của Thành viên 2: [`docs/HUONG_DAN_THANH_VIEN_2_HA_TANG_K8S.md`](file:///Users/nguyendinhhieu/Downloads/gk%20%C4%91ie%CC%A3%CC%82n%20toa%CC%81n%20%C4%91a%CC%81m%20ma%CC%82y/docs/HUONG_DAN_THANH_VIEN_2_HA_TANG_K8S.md)
- 📋 Bản ghi Log Pod tự tái tạo khi Stop/Terminate `worker2`: [`docs/node-failure-logs/`](file:///Users/nguyendinhhieu/Downloads/gk%20%C4%91ie%CC%A3%CC%82n%20toa%CC%81n%20%C4%91a%CC%81m%20ma%CC%82y/docs/node-failure-logs/)
