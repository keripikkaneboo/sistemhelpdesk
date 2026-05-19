#!/bin/bash
# =============================================================================
# setup-vps.sh — Script setup VPS Hostinger Malaysia untuk backend_chatbot
# OS Target: Ubuntu 22.04 LTS
# Jalankan sebagai root: bash setup-vps.sh
# =============================================================================
set -e

DOMAIN="api.DOMAIN-ANDA.com"   # <-- GANTI dengan domain Anda sebelum run
DB_NAME="helpdesk_db"
DB_PASS="GANTI_PASSWORD_KUAT"  # <-- GANTI dengan password kuat (min 20 karakter)
DEPLOY_DIR="/opt/helpdesk-backend"

echo "================================================================="
echo " Helpdesk LAA — VPS Setup Script"
echo " Domain  : $DOMAIN"
echo " DB      : $DB_NAME"
echo " Deploy  : $DEPLOY_DIR"
echo "================================================================="
echo ""

# =============================================================================
echo "=== [1/10] Update sistem & install dependensi ==="
# =============================================================================
apt update && apt upgrade -y
apt install -y git curl wget nginx \
  python3.12 python3.12-venv python3-pip build-essential \
  postgresql postgresql-contrib \
  postgresql-16-pgvector \
  fail2ban

# Certbot via snap (rekomendasi resmi Ubuntu 24.04)
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot
apt install -y python3-certbot-nginx

# =============================================================================
echo "=== [2/10] Verifikasi pgvector (sudah diinstall via apt) ==="
# =============================================================================
# Di Ubuntu 24.04, postgresql-16-pgvector diinstall via apt pada step sebelumnya
# Verifikasi extension tersedia:
sudo -u postgres psql -c "SELECT * FROM pg_available_extensions WHERE name='vector';" | grep vector
echo "pgvector tersedia via apt (postgresql-16-pgvector)"

# =============================================================================
echo "=== [3/10] Setup PostgreSQL + database ==="
# =============================================================================
sudo -u postgres psql << SQL
CREATE DATABASE IF NOT EXISTS $DB_NAME;
\c $DB_NAME
CREATE EXTENSION IF NOT EXISTS vector;
ALTER USER postgres WITH PASSWORD '$DB_PASS';
SQL

# Konfigurasi PostgreSQL untuk koneksi SSL dari Vercel
# Ubuntu 24.04: PostgreSQL 16
PGCONF="/etc/postgresql/16/main/postgresql.conf"
PGHBA="/etc/postgresql/16/main/pg_hba.conf"

sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PGCONF"
sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/" "$PGCONF"

# Backup pg_hba.conf asli
cp "$PGHBA" "${PGHBA}.bak"

# Set pg_hba.conf: SSL wajib + scram-sha-256
cat > "$PGHBA" << 'PGHBA_EOF'
# PostgreSQL Client Authentication Configuration
# TYPE  DATABASE  USER      ADDRESS       METHOD
local   all       postgres                peer
local   all       all                     md5
hostssl all       all       0.0.0.0/0     scram-sha-256
PGHBA_EOF

systemctl restart postgresql
echo "PostgreSQL SSL: $(sudo -u postgres psql -c 'SHOW ssl;' -t | tr -d ' ')"

# =============================================================================
echo "=== [4/10] Setup fail2ban untuk proteksi brute force ==="
# =============================================================================
cat > /etc/fail2ban/filter.d/postgresql.conf << 'EOF'
[Definition]
failregex = ^.*FATAL:  password authentication failed for user.*$
            ^.*FATAL:  no pg_hba.conf entry for host.*$
ignoreregex =
journalmatch = _SYSTEMD_UNIT=postgresql.service
EOF

cat > /etc/fail2ban/jail.d/postgresql.conf << 'EOF'
[postgresql]
enabled  = true
filter   = postgresql
logpath  = /var/log/postgresql/postgresql-*.log
maxretry = 5
bantime  = 3600
findtime = 600
EOF

systemctl restart fail2ban
echo "fail2ban aktif: $(fail2ban-client status postgresql 2>/dev/null | grep 'Currently banned' || echo 'OK')"

# =============================================================================
echo "=== [5/10] Buat user chatbot & direktori deploy ==="
# =============================================================================
if ! id "chatbot" &>/dev/null; then
  adduser --disabled-password --gecos "" chatbot
fi
mkdir -p "$DEPLOY_DIR"
chown chatbot:chatbot "$DEPLOY_DIR"

# =============================================================================
echo "=== [6/10] Upload file backend ==="
# =============================================================================
echo ""
echo ">>> Jalankan perintah ini dari MESIN LOKAL (PowerShell/terminal):"
echo "    scp -r sistemhelpdesk/backend_chatbot/* root@$(curl -s https://api.ipify.org):$DEPLOY_DIR/"
echo ""
read -rp "Tekan Enter setelah upload selesai..."

# =============================================================================
echo "=== [7/10] Setup Python virtualenv & install dependensi ==="
# =============================================================================
cd "$DEPLOY_DIR"
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn python-dotenv psycopg2-binary ollama \
  pydantic slowapi torch transformers PySastrawi

# Buat file .env produksi
cat > "$DEPLOY_DIR/.env" << ENV_EOF
DB_HOST=localhost
DB_NAME=$DB_NAME
DB_USER=postgres
DB_PASS=$DB_PASS
DB_PORT=5432
CORS_ORIGINS=https://GANTI-FRONTEND.vercel.app,https://GANTI-ADMIN.vercel.app
FRONTEND_URL=https://GANTI-FRONTEND.vercel.app
ENV_EOF
chmod 600 "$DEPLOY_DIR/.env"
echo ".env dibuat di $DEPLOY_DIR/.env — update CORS_ORIGINS setelah deploy Vercel"

# =============================================================================
echo "=== [8/10] Install Ollama ==="
# =============================================================================
if ! command -v ollama &>/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

# Pastikan service ollama ada
if ! systemctl is-enabled ollama &>/dev/null 2>&1; then
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

echo ">>> Pull model Ollama (bisa memakan waktu lama)..."
ollama pull nomic-embed-text
ollama pull gemma3:27b-cloud
echo "Model Ollama:"
ollama list

# =============================================================================
echo "=== [9/10] Setup systemd service FastAPI ==="
# =============================================================================
cat > /etc/systemd/system/helpdesk-api.service << EOF
[Unit]
Description=Helpdesk Chatbot FastAPI
After=network.target ollama.service postgresql.service

[Service]
Type=simple
User=chatbot
WorkingDirectory=$DEPLOY_DIR
Environment="PATH=$DEPLOY_DIR/venv/bin"
ExecStart=$DEPLOY_DIR/venv/bin/uvicorn api_chatbot:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable helpdesk-api
systemctl start helpdesk-api

# =============================================================================
echo "=== [10/10] Konfigurasi Nginx + Firewall + SSL ==="
# =============================================================================
cat > /etc/nginx/sites-available/helpdesk-api << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /ollama/ {
        rewrite ^/ollama/(.*) /\$1 break;
        proxy_pass http://127.0.0.1:11434;
        proxy_read_timeout 60s;
        limit_except POST OPTIONS { deny all; }
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/helpdesk-api /etc/nginx/sites-enabled/helpdesk-api
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5432/tcp
ufw --force enable

# SSL
echo ">>> Setup SSL untuk $DOMAIN (DNS A record harus sudah propagasi)"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
  -m "admin@$(echo $DOMAIN | cut -d'.' -f2-)" || \
  echo "SSL gagal — pastikan DNS sudah propagasi lalu jalankan: certbot --nginx -d $DOMAIN"

systemctl reload nginx

# =============================================================================
echo ""
echo "================================================================="
echo " SETUP SELESAI"
echo "================================================================="
echo " IP VPS   : $(curl -s https://api.ipify.org)"
echo " Domain   : https://$DOMAIN"
echo " Database : $DB_NAME (password tersimpan di $DEPLOY_DIR/.env)"
echo ""
echo " Status service:"
systemctl status helpdesk-api --no-pager -l | grep -E "Active|Main PID"
systemctl status ollama --no-pager -l | grep -E "Active|Main PID"
systemctl status postgresql --no-pager -l | grep -E "Active|Main PID"
echo ""
echo " LANGKAH SELANJUTNYA:"
echo " 1. Migrasi database via pgAdmin 4 (lihat plan deployment)"
echo " 2. Update CORS_ORIGINS di $DEPLOY_DIR/.env dengan URL Vercel"
echo " 3. Deploy frontend ke Vercel dan set environment variables"
echo "================================================================="
