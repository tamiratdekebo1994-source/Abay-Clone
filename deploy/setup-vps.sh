#!/usr/bin/env bash
# ─── Abay Driver — Ubuntu 22.04 VPS Setup Script ────────────────────────────
# Run as root on a fresh Ubuntu 22.04 server:
#   wget -O setup-vps.sh https://raw.githubusercontent.com/.../setup-vps.sh
#   bash setup-vps.sh
#
# What this script does:
#   1. Updates the system and installs Docker, Docker Compose, nginx, certbot
#   2. Creates a deploy user with Docker access
#   3. Configures UFW firewall (22, 80, 443 open)
#   4. Sets up the nginx site (replace DOMAIN placeholder)
#   5. Clones the repo and walks you through the .env setup
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-abaydriver.et}"
DEPLOY_USER="${DEPLOY_USER:-abay}"
REPO_URL="${REPO_URL:-https://github.com/your-org/Abay-Clone.git}"
APP_DIR="/opt/abay-driver"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "Run this script as root (sudo bash setup-vps.sh)"

# ── 1. System update ─────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw nginx certbot python3-certbot-nginx \
  apt-transport-https ca-certificates gnupg lsb-release

# ── 2. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
else
  info "Docker already installed — skipping"
fi

# ── 3. Deploy user ───────────────────────────────────────────────────────────
if ! id "$DEPLOY_USER" &>/dev/null; then
  info "Creating deploy user '$DEPLOY_USER'..."
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  # Allow sudo without password for service management only
  echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /bin/systemctl, /usr/bin/docker" \
    > "/etc/sudoers.d/$DEPLOY_USER"
else
  info "User '$DEPLOY_USER' already exists — adding to docker group"
  usermod -aG docker "$DEPLOY_USER"
fi

# ── 4. Firewall ──────────────────────────────────────────────────────────────
info "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
ufw status

# ── 5. App directory ─────────────────────────────────────────────────────────
info "Creating app directory at $APP_DIR..."
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  info "Repository already cloned — pulling latest..."
  sudo -u "$DEPLOY_USER" git -C "$APP_DIR" pull
else
  info "Cloning repository..."
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
fi

# ── 6. Environment file ──────────────────────────────────────────────────────
if [[ ! -f "$APP_DIR/.env" ]]; then
  info "Creating .env from template..."
  cp "$APP_DIR/backend/.env.example" "$APP_DIR/.env"
  warn "⚠️  You MUST edit $APP_DIR/.env before starting the app:"
  warn "   - Set POSTGRES_PASSWORD, REDIS_PASSWORD"
  warn "   - Set JWT_SECRET, JWT_REFRESH_SECRET (use: openssl rand -hex 64)"
  warn "   - Set BACKEND_URL=https://$DOMAIN"
  warn "   - Set FRONTEND_URL=https://$DOMAIN"
  warn "   - Set GOOGLE_MAPS_API_KEY"
  warn "   - Set AT_API_KEY, AT_USERNAME for SMS"
fi

# ── 7. Nginx site ────────────────────────────────────────────────────────────
info "Installing nginx site config..."
sed "s/abaydriver.et/$DOMAIN/g" "$APP_DIR/deploy/nginx-vps.conf" \
  > "/etc/nginx/sites-available/abaydriver"
ln -sf /etc/nginx/sites-available/abaydriver /etc/nginx/sites-enabled/abaydriver
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 8. SSL certificate ───────────────────────────────────────────────────────
info "Requesting Let's Encrypt certificate for $DOMAIN..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
  --email "admin@$DOMAIN" --redirect || \
  warn "Certbot failed — ensure DNS A records for $DOMAIN point to this server's IP before re-running"

# ── 9. Systemd service for auto-start ────────────────────────────────────────
info "Installing systemd service..."
cat > /etc/systemd/system/abay-driver.service <<EOF
[Unit]
Description=Abay Driver App
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
User=$DEPLOY_USER
ExecStart=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable abay-driver.service

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Abay Driver VPS setup complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit the environment file:"
echo "       nano $APP_DIR/.env"
echo ""
echo "  2. Start the app:"
echo "       cd $APP_DIR"
echo "       sudo -u $DEPLOY_USER docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
echo ""
echo "  3. Check logs:"
echo "       docker compose logs -f backend"
echo ""
echo "  4. Enable auto-start on reboot:"
echo "       systemctl start abay-driver"
echo ""
