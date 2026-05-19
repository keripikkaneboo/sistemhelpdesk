#!/bin/bash
# =============================================================================
# setup-vps.sh — Script setup awal Hostinger VPS untuk backend_chatbot
# Jalankan sebagai root di VPS Ubuntu 22.04:
#   bash setup-vps.sh
# =============================================================================
set -e

DOMAIN="api.DOMAIN-ANDA.com"   # <-- GANTI dengan domain Anda
DEPLOY_DIR="/opt/helpdesk-backend"

echo "=== [1/7] Update sistem ==="
apt update && apt upgrade -y
apt install -y git curl wget nginx certbot python3-certbot-nginx \
  python3.11 python3.11-venv python3-pip build-essential \
  postgresql-client

echo "=== [2/7] Buat user chatbot ==="
if ! id "chatbot" &>/dev/null; then
  adduser --disabled-password --gecos "" chatbot
fi
mkdir -p "$DEPLOY_DIR"
chown chatbot:chatbot "$DEPLOY_DIR"

echo "=== [3/7] Upload file backend ==="
echo ""
echo ">>> Jalankan perintah ini dari MESIN LOKAL Anda (bukan dari sini):"
echo "    scp -r sistemhelpdesk/backend_chatbot/* root@\$(hostname -I | awk '{print \$1}'):$DEPLOY_DIR/"
echo ""
read -p "Tekan Enter setelah upload selesai..."

echo "=== [4/7] Setup Python virtualenv ==="
cd "$DEPLOY_DIR"
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn python-dotenv psycopg2-binary ollama \
  pydantic slowapi torch transformers PySastrawi

echo "=== [5/7] Install Ollama ==="
if ! command -v ollama &>/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

echo ""
echo ">>> Pull model Ollama (proses ini bisa 5-15 menit)..."
ollama pull nomic-embed-text
ollama pull gemma3:27b-cloud

echo "=== [6/7] Setup systemd services ==="
cp "$DEPLOY_DIR/deployment/helpdesk-api.service" /etc/systemd/system/ 2>/dev/null || \
  echo "Salin helpdesk-api.service manual ke /etc/systemd/system/"

systemctl daemon-reload
systemctl enable helpdesk-api
systemctl start helpdesk-api

# Pastikan Ollama service ada
if ! systemctl is-enabled ollama &>/dev/null; then
  cat > /etc/systemd/system/ollama.service << 'EOF'
[Unit]
Description=Ollama Service
After=network.target

[Service]
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=127.0.0.1:11434"

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable ollama
  systemctl start ollama
fi

echo "=== [7/7] Konfigurasi Nginx & SSL ==="
cp nginx-helpdesk-api.conf /etc/nginx/sites-available/helpdesk-api 2>/dev/null || \
  echo "Salin nginx-helpdesk-api.conf ke /etc/nginx/sites-available/helpdesk-api lalu edit DOMAIN"

# Ganti placeholder domain di nginx config
sed -i "s/api.DOMAIN-ANDA.com/$DOMAIN/g" /etc/nginx/sites-available/helpdesk-api

ln -sf /etc/nginx/sites-available/helpdesk-api /etc/nginx/sites-enabled/helpdesk-api
nginx -t && systemctl reload nginx

# Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# SSL via Let's Encrypt
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@DOMAIN-ANDA.com
systemctl reload nginx

echo ""
echo "=== SETUP SELESAI ==="
echo "Cek status:"
echo "  systemctl status helpdesk-api"
echo "  systemctl status ollama"
echo "  curl https://$DOMAIN/docs"
