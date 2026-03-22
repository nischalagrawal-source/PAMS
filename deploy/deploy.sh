#!/bin/bash
# ═══════════════════════════════════════════════════════
# P&AMS Deploy Script — Run this to deploy/update
# Usage: ssh root@YOUR_VPS_IP 'bash -s' < deploy/deploy.sh
# Or from the VPS: cd /var/www/pams && bash deploy/deploy.sh
# ═══════════════════════════════════════════════════════

set -e

APP_DIR="/var/www/pams"

echo "╔══════════════════════════════════════════╗"
echo "║  P&AMS Deploy                              ║"
echo "╚══════════════════════════════════════════╝"

cd $APP_DIR

# 1. Pull latest code
echo "→ Pulling latest code..."
git pull origin master

# 2. Install dependencies
echo "→ Installing dependencies..."
npm ci --production=false

# 3. Sync database schema (required when models change)
echo "→ Syncing database schema..."
npx prisma db push --skip-generate

# 4. Generate Prisma client (must be after db push for fresh types)
echo "→ Generating Prisma client..."
npx prisma generate

# 5. Clean .next cache for fresh build
echo "→ Cleaning .next cache..."
rm -rf .next

# 6. Build Next.js for production
echo "→ Building for production..."
npm run build

# 7. Restart PM2
echo "→ Restarting app..."
pm2 restart pams || pm2 start ecosystem.config.js

# 8. Save PM2 config (survives reboot)
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Deploy Complete!                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "App running at: http://localhost:3000"
echo "Check status: pm2 status"
echo "View logs: pm2 logs pams"
