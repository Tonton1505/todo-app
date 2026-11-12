output "control_plane_public_ip" {
  description = "Địa chỉ IP công khai của Node Control Plane (cp)"
  value       = aws_instance.control_plane.public_ip
}

output "worker_1_public_ip" {
  description = "Địa chỉ IP công khai của Worker Node 1 (worker1)"
  value       = aws_instance.worker_1.public_ip
}

output "worker_2_public_ip" {
  description = "Địa chỉ IP công khai của Worker Node 2 (worker2)"
  value       = aws_instance.worker_2.public_ip
}

output "web_app_access_url" {
  description = "Đường dẫn truy cập Todo App qua NodePort 30080"
  value       = "http://${aws_instance.worker_1.public_ip}:30080"
}
