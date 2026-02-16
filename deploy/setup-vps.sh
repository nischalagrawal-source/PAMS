#!/bin/bash
# ═══════════════════════════════════════════════════════
# P&AMS VPS Setup Script — Run this ONCE on your VPS
# Usage: ssh root@YOUR_VPS_IP 'bash -s' < deploy/setup-vps.sh
# ═══════════════════════════════════════════════════════

set -e

echo "╔══════════════════════════════════════════╗"
echo "║  P&AMS VPS Setup                          ║"
echo "╚══════════════════════════════════════════╝"

# 1. Update system
echo "→ Updating system..."
apt update && apt upgrade -y

# 2. Install Node.js 20 LTS
echo "→ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install PM2
echo "→ Installing PM2..."
npm install -g pm2

# 4. Install Nginx
echo "→ Installing Nginx..."
apt install -y nginx

# 5. Install Certbot for SSL
echo "→ Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# 6. Install Git
echo "→ Installing Git..."
apt install -y git

# 7. Create app directory
echo "→ Creating app directory..."
mkdir -p /var/www/pams
mkdir -p /var/log/pams

# 8. Create deploy user (optional, for security)
# useradd -m -s /bin/bash deploy
# chown -R deploy:deploy /var/www/pams

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  VPS Setup Complete!                      ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "PM2: $(pm2 --version)"
echo "Nginx: $(nginx -v 2>&1)"
echo ""
echo "NEXT: Run the deploy script to push your app."
