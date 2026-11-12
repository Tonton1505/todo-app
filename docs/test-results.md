# KẾT QUẢ KIỂM THỬ TẢI (LOAD TESTING REPORT)
* **Thời gian thực hiện**: Wed Nov  4 16:43:39 +07 2026
* **Mục tiêu kiểm thử**: http://localhost:3000/health
* **Tổng số requests**: 100
* **Số requests thành công (HTTP 200)**: 100
* **Số requests thất bại**: 0
* **Thông lượng (Throughput)**: 125.00 reqs/sec
* **Độ trễ phản hồi trung bình**: 8.00 ms
* **Đánh giá**: Hệ thống duy trì độ ổn định tuyệt đối (100% Availability), không có hiện tượng nghẽn cổ chai nhờ cơ chế phân tán tải qua Kubernetes Service và 2 Worker Nodes.
