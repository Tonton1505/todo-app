#!/bin/bash
# ==============================================================================
# Script 02: Khởi tạo Kubernetes Control Plane & CNI (Thành viên 2 phụ trách)
# Chạy trên máy ảo Control Plane: 'cp'
# Hỗ trợ tùy chọn CNI: Flannel (mặc định) hoặc Calico
# Cách chạy:
#   ./scripts/02-init-control-plane.sh flannel
#   hoặc
#   ./scripts/02-init-control-plane.sh calico
# ==============================================================================

set -e

CNI_PLUGIN="${1:-flannel}"
CP_IP=$(hostname -I | awk '{print $1}')

if [[ "$CNI_PLUGIN" == "calico" ]]; then
    POD_CIDR="192.168.0.0/16"
else
    POD_CIDR="10.244.0.0/16"
fi

echo "=================================================================="
echo "☸️  [THÀNH VIÊN 2] KHỞI TẠO KUBERNETES CONTROL PLANE (Node: cp)"
echo "IP Control Plane : $CP_IP"
echo "CNI Plugin chọn  : $CNI_PLUGIN"
echo "Pod Network CIDR : $POD_CIDR"
echo "=================================================================="

# 1. Khởi tạo Control Plane bằng kubeadm
sudo kubeadm init \
  --apiserver-advertise-address="$CP_IP" \
  --pod-network-cidr="$POD_CIDR" \
  --node-name=cp

# 2. Cấu hình kubeconfig cho user hiện tại
echo ">>> Thiết lập kubeconfig tại $HOME/.kube/config..."
mkdir -p "$HOME/.kube"
sudo cp -i /etc/kubernetes/admin.conf "$HOME/.kube/config"
sudo chown $(id -u):$(id -g) "$HOME/.kube/config"

# 3. Tích hợp Plugin mạng (CNI: Flannel hoặc Calico)
if [[ "$CNI_PLUGIN" == "calico" ]]; then
    echo ">>> Đang tích hợp CNI Plugin: Calico..."
    kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.28.0/manifests/calico.yaml
else
    echo ">>> Đang tích hợp CNI Plugin: Flannel..."
    kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
fi

echo "=================================================================="
echo "🎉 Control Plane (cp) đã khởi tạo thành công!"
echo "👉 Bước tiếp theo: Copy lệnh 'kubeadm join' dưới đây và chạy với quyền"
echo "   sudo trên 2 máy ảo Worker Node (worker1 và worker2):"
echo "------------------------------------------------------------------"
kubeadm token create --print-join-command
echo "------------------------------------------------------------------"
echo "✅ Sau khi join xong cả 2 worker, chạy lệnh kiểm tra trạng thái:"
echo "   kubectl get nodes -o wide"
echo "   (Đảm bảo cả 3 node: cp, worker1, worker2 đều ở trạng thái Ready)"
echo "=================================================================="
