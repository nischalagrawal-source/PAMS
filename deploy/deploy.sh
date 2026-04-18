#!/bin/bash
# ======================================================
# P&AMS Deploy Script - Run this to deploy/update
# Usage:
#   cd /var/www/pams && bash deploy/deploy.sh [branch] [healthcheck_url]
# Examples:
#   bash deploy/deploy.sh master "https://app.example.com/api/health"
#   bash deploy/deploy.sh staging "https://staging.example.com/api/health"
# ======================================================

set -Eeuo pipefail

APP_DIR="/var/www/pams"
TARGET_BRANCH="${1:-master}"
HEALTHCHECK_URL="${2:-http://127.0.0.1:3000/api/health?scope=app}"
PREVIOUS_COMMIT=""

# ---- Ensure swap exists (prevents OOM on low-memory VPS) ----
ensure_swap() {
  if [ "$(swapon --noheadings | wc -l)" -eq 0 ]; then
    echo "-> No swap detected. Creating 2 GB swap file..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo "-> Swap enabled"
  else
    echo "-> Swap already active"
  fi
}

# ---- Log a timestamped step header ----
step() {
  echo ""
  echo "=== [$(date '+%H:%M:%S')] $1 ==="
}

run_schema_sync() {
  npx prisma db push 2>&1
  echo "-> Schema synced"
}

health_check() {
  if [ -z "$HEALTHCHECK_URL" ]; then
    echo "-> No healthcheck URL provided, skipping health check"
    return 0
  fi

  echo "-> Running health check: $HEALTHCHECK_URL"

  for attempt in 1 2 3 4 5 6; do
    local http_code
    http_code="$(curl --silent --show-error --location --max-time 15 --output /dev/null --write-out "%{http_code}" "$HEALTHCHECK_URL" || echo 000)"

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
      echo "-> Health check passed with HTTP $http_code on attempt $attempt"
      return 0
    fi

    echo "-> Health check attempt $attempt failed with HTTP $http_code"
  done

  echo "-> Health check failed after multiple attempts"
  return 1
}

rollback() {
  set +e
  trap - ERR

  echo ""
  echo "[ROLLBACK] Deployment failed. Reverting to commit: $PREVIOUS_COMMIT"

  if [ -z "$PREVIOUS_COMMIT" ]; then
    echo "[ROLLBACK] Previous commit unknown. Cannot auto-rollback safely."
    exit 1
  fi

  cd "$APP_DIR" || exit 1
  git reset --hard "$PREVIOUS_COMMIT" || exit 1

  echo "[ROLLBACK] Reinstalling dependencies..."
  npm ci --production=false || exit 1

  echo "[ROLLBACK] Syncing schema..."
  run_schema_sync || exit 1

  echo "[ROLLBACK] Regenerating Prisma client..."
  npx prisma generate || exit 1

  echo "[ROLLBACK] Rebuilding app..."
  rm -rf .next
  npm run build || exit 1

  echo "[ROLLBACK] Restarting app..."
  pm2 restart pams || pm2 start ecosystem.config.js || exit 1
  pm2 save || true

  if ! health_check; then
    echo "[ROLLBACK] Health check failed even after rollback"
    exit 1
  fi

  echo "[ROLLBACK] Rollback succeeded"
  exit 1
}

trap rollback ERR

echo "======================================================"
echo " P&AMS Deploy"
echo " Branch: $TARGET_BRANCH"
echo " Node:   $(node -v)"
echo " npm:    $(npm -v)"
echo " Free memory: $(free -m | awk '/Mem:/{print $4}') MB"
echo "======================================================"

ensure_swap

cd "$APP_DIR"
PREVIOUS_COMMIT="$(git rev-parse HEAD)"

step "Fetching latest code"
git fetch origin "$TARGET_BRANCH"
git checkout "$TARGET_BRANCH"
git reset --hard "origin/$TARGET_BRANCH"

step "Installing dependencies"
npm ci --production=false 2>&1

step "Syncing database schema"
run_schema_sync

step "Generating Prisma client"
npx prisma generate 2>&1

step "Cleaning .next cache"
rm -rf .next

step "Building for production"
export NODE_OPTIONS="--max-old-space-size=1536"
npm run build 2>&1

step "Restarting app"
pm2 restart pams || pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

step "Waiting for app to start"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  sleep 5
  echo "-> Attempt $i: checking if app is ready..."
  if curl --silent --max-time 5 --output /dev/null --write-out "%{http_code}" "$HEALTHCHECK_URL" 2>/dev/null | grep -q '^[23]'; then
    echo "-> App is ready!"
    break
  fi
done

health_check

trap - ERR

echo ""
echo "======================================================"
echo " Deploy Complete"
echo "======================================================"
echo "App running at: http://localhost:3000"
echo "Check status: pm2 status"
echo "View logs: pm2 logs pams"
