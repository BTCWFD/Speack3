#!/usr/bin/env bash
# One-shot deploy of Speack3 on a fresh Ubuntu VM (Oracle Cloud Always Free, or
# any cheap VPS). Installs Docker, opens the firewall, generates secrets, obtains
# a Let's Encrypt certificate and starts the HTTPS/WSS stack.
#
# Usage (run as a sudo-capable user, from the repo's deploy/ directory):
#   chmod +x setup-oracle.sh
#   ./setup-oracle.sh your.domain.com you@email.com
#
# Prerequisites you do in the Oracle console FIRST (see DEPLOY_ORACLE.md):
#   - An Always Free VM (Ubuntu 22.04), with ports 80 and 443 OPEN in the
#     instance's Security List / NSG.
#   - A domain (or free DuckDNS subdomain) whose A record points to the VM's
#     public IP.
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: ./setup-oracle.sh <domain> <email>"
  exit 1
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

echo "==> 1/7 Installing Docker + compose plugin (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi
# docker compose v2 plugin
if ! docker compose version >/dev/null 2>&1; then
  sudo apt-get update -y && sudo apt-get install -y docker-compose-plugin
fi

echo "==> 2/7 Opening the host firewall (80/443)"
# Oracle Ubuntu images keep restrictive iptables by default. Open the ports.
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
# Persist iptables rules across reboots if netfilter-persistent is available.
sudo apt-get install -y netfilter-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || true
# If ufw is in use instead, also allow there.
command -v ufw >/dev/null 2>&1 && { sudo ufw allow 80/tcp || true; sudo ufw allow 443/tcp || true; }

echo "==> 3/7 Writing .env with generated JWT secrets"
if [ ! -f .env ]; then
  JWT=$(openssl rand -hex 48)
  JWTR=$(openssl rand -hex 48)
  cat > .env <<EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=${JWT}
JWT_REFRESH_SECRET=${JWTR}
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
# Mobile clients are not browser-CORS restricted, but we set the domain anyway.
ALLOWED_ORIGINS=https://${DOMAIN}
EOF
  echo "    .env created (secrets generated)."
else
  echo "    .env already exists, leaving it untouched."
fi

echo "==> 4/7 Rendering nginx config for ${DOMAIN}"
sed "s/__DOMAIN__/${DOMAIN}/g" nginx/speack3.conf > nginx/active.conf
# Point compose at the rendered file.
mkdir -p nginx

echo "==> 5/7 Bootstrapping a temporary self-signed cert so nginx can start"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
# Build the server image and create a short-lived self-signed cert in the
# certbot_conf volume so nginx's TLS server block can load on first boot.
docker compose -f docker-compose.prod.yml build server
docker compose -f docker-compose.prod.yml run --rm --entrypoint \
  "sh -c \"mkdir -p ${CERT_DIR} && openssl req -x509 -nodes -newkey rsa:2048 -days 1 -keyout ${CERT_DIR}/privkey.pem -out ${CERT_DIR}/fullchain.pem -subj '/CN=${DOMAIN}'\"" \
  certbot

echo "==> 6/7 Starting nginx and requesting the real Let's Encrypt cert"
docker compose -f docker-compose.prod.yml up -d nginx
sleep 3
docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
  -d ${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email \
  --force-renewal" certbot
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "==> 7/7 Starting full stack + nightly backup cron"
docker compose -f docker-compose.prod.yml up -d
# Backup at 03:30 daily.
CRON="30 3 * * * cd ${HERE} && ./backup.sh >> ${HERE}/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'speack3.*backup.sh' ; echo "$CRON" ) | crontab - || true

echo ""
echo "✅ Done. Speack3 is live at: https://${DOMAIN}"
echo "   Health check: https://${DOMAIN}/health"
echo "   WebSocket:    wss://${DOMAIN}"
echo ""
echo "Next: in the mobile app set PROD_HOST = '${DOMAIN}' in mobile/src/config/api.js,"
echo "build a release APK, and you're online."
