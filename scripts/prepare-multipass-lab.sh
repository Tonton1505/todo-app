#!/usr/bin/env bash
# ==============================================================================
# Script: prepare-multipass-lab.sh (Thành viên 2 phụ trách)
# Tự động tạo 3 máy ảo: 1 Control Plane (cp) và 2 Worker Node (worker1, worker2)
# và cài đặt containerd, kubeadm, kubelet, kubectl
# ==============================================================================

set -Eeuo pipefail

echo "=================================================================="
echo "☸️  [THÀNH VIÊN 2] KHỞI TẠO 3 MÁY ẢO (cp, worker1, worker2)"
echo "=================================================================="

# 1. Khởi tạo 3 máy ảo Ubuntu (cp, worker1, worker2)
echo ">>> [1/3] Đang khởi tạo 3 máy ảo: cp, worker1, worker2..."

if ! multipass info cp &>/dev/null; then
    multipass launch 24.04 --name cp --cpus 2 --memory 4G --disk 16G
fi

if ! multipass info worker1 &>/dev/null; then
    multipass launch 24.04 --name worker1 --cpus 2 --memory 2G --disk 12G
fi

if ! multipass info worker2 &>/dev/null; then
    multipass launch 24.04 --name worker2 --cpus 2 --memory 2G --disk 12G
fi

multipass list

# 2. Cấu hình containerd và kernel parameters trên cả 3 node
NODES=("cp" "worker1" "worker2")

for NODE in "${NODES[@]}"; do
    echo "----------------------------------------"
    echo "Cấu hình hệ thống & containerd trên: ${NODE}"
    echo "----------------------------------------"
    multipass exec "${NODE}" -- sudo bash -s <<'NODE_SCRIPT'
set -Eeuo pipefail

# Tắt swap
swapoff -a
sed -ri '/\sswap\s/s/^#?/#/' /etc/fstab

# Cấu hình kernel modules
cat > /etc/modules-load.d/k8s.conf <<'EOF'
overlay
br_netfilter
EOF
modprobe overlay
modprobe br_netfilter

# Cấu hình sysctl
cat > /etc/sysctl.d/k8s.conf <<'EOF'
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF
sysctl --system

# Cài đặt và cấu hình containerd với SystemdCgroup = true
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y containerd
mkdir -p /etc/containerd
containerd config default > /etc/containerd/config.toml
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
systemctl enable --now containerd
systemctl restart containerd

NODE_SCRIPT
done

# 3. Cài đặt Kubernetes Tools (v1.30)
K8S_MINOR="v1.30"

for NODE in "${NODES[@]}"; do
    echo "----------------------------------------"
    echo "Cài đặt kubeadm, kubelet, kubectl (${K8S_MINOR}) trên: ${NODE}"
    echo "----------------------------------------"
    multipass exec "${NODE}" -- sudo bash -s -- "${K8S_MINOR}" <<'NODE_SCRIPT'
set -Eeuo pipefail
K8S_MINOR="$1"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y apt-transport-https ca-certificates curl gpg
mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL "https://pkgs.k8s.io/core:/stable:/${K8S_MINOR}/deb/Release.key" | gpg --dearmor --yes -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
chmod 644 /etc/apt/keyrings/kubernetes-apt-keyring.gpg

cat > /etc/apt/sources.list.d/kubernetes.list <<EOF
deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/${K8S_MINOR}/deb/ /
EOF

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y kubelet kubeadm kubectl
apt-mark hold kubelet kubeadm kubectl
systemctl enable kubelet
NODE_SCRIPT
done

echo "=================================================================="
echo "🎉 HOÀN THÀNH KHỞI TẠO & CÀI ĐẶT 3 NODE (cp, worker1, worker2)!"
for node in cp worker1 worker2; do
    echo "Node: $node"
    multipass exec "$node" -- kubeadm version -o short
done
echo "=================================================================="
