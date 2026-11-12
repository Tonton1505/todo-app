#!/bin/bash
# ==============================================================================
# Script 01: Thiết lập môi trường tiên quyết (Chạy trên CẢ 3 NODE: cp, worker1, worker2)
# Hỗ trợ hệ điều hành: Ubuntu 22.04 LTS / 24.04 LTS
# ==============================================================================

set -e

echo ">>> [1/5] Vô hiệu hóa Swap (Yêu cầu bắt buộc của Kubernetes)..."
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

echo ">>> [2/5] Nạp các Kernel Modules cần thiết cho Container Runtime..."
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

echo ">>> [3/5] Cấu hình các tham số mạng sysctl cho Kubernetes..."
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system

echo ">>> [4/5] Cài đặt containerd làm Container Runtime..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Cài đặt containerd
sudo apt-get install -y containerd

# Cấu hình containerd với SystemdCgroup = true
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml > /dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

sudo systemctl restart containerd
sudo systemctl enable containerd

echo ">>> [5/5] Cài đặt kubeadm, kubelet, kubectl (phiên bản v1.30)..."
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl

# Khóa GPG và repo Kubernetes chính thức
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg --yes

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

sudo systemctl enable --now kubelet

echo "=========================================================="
echo "✅ Hoàn tất cài đặt môi trường trên node!"
echo "Nếu đây là node Control Plane (cp), hãy chạy tiếp script: 02-init-control-plane.sh"
echo "Nếu đây là Worker Node, hãy chờ lấy lệnh 'kubeadm join' từ Control Plane để gia nhập."
echo "=========================================================="
