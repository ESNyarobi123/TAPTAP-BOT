#!/usr/bin/env bash
# Bootstrap tiptopbot on TAPTAP SOUTH BOT VPS (wbot.tiptapafrica.co.za)
# Run as root on 167.71.44.10 after DNS A record points here.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/tiptap-sauth-bot/tiptopbot}"
REPO_URL="${REPO_URL:-https://github.com/ESNyarobi123/TAPTAP-BOT.git}"

echo "==> Installing Docker (if missing)..."
if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

echo "==> Installing nginx + certbot (if missing)..."
if ! command -v nginx >/dev/null 2>&1; then
    apt-get update
    apt-get install -y nginx certbot python3-certbot-nginx git
fi

mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
    echo "==> Cloning TAPTAP-BOT to $APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "==> Pulling latest in $APP_DIR"
    git -C "$APP_DIR" fetch origin main
    git -C "$APP_DIR" reset --hard origin/main
fi

if [[ ! -f "$APP_DIR/.env" ]]; then
    echo "==> Create $APP_DIR/.env from .env.example and fill Meta + Laravel values"
    cp "$APP_DIR/.env.example" "$APP_DIR/.env.sauth.example"
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo "Edit .env then re-run: docker compose up -d --build bot"
    exit 1
fi

echo "==> Building and starting bot container..."
cd "$APP_DIR"
docker compose down || true
docker compose build --no-cache bot
docker compose up -d bot
sleep 3
curl -sS http://127.0.0.1:3000/health || true

echo "==> Installing nginx site for wbot.tiptapafrica.co.za"
cp "$APP_DIR/deploy/nginx-wbot-tiptapafrica-co-za.example.conf" \
    /etc/nginx/sites-available/wbot.tiptapafrica.co.za
ln -sf /etc/nginx/sites-available/wbot.tiptapafrica.co.za /etc/nginx/sites-enabled/wbot.tiptapafrica.co.za
nginx -t
systemctl reload nginx

echo "==> Request TLS certificate (interactive)"
echo "Run: certbot --nginx -d wbot.tiptapafrica.co.za"
echo "Done. Verify: curl -sS https://wbot.tiptapafrica.co.za/health"
