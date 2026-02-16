#!/bin/bash
# ═══════════════════════════════════════════════════════
# SSL Certificate Setup for pms.agrovilla.in and pms.nraco.in
# Run AFTER DNS is pointed to VPS IP and Nginx is configured
# ═══════════════════════════════════════════════════════

set -e

echo "→ Setting up SSL certificates..."

# Copy Nginx config
cp /var/www/pams/deploy/nginx-pams.conf /etc/nginx/sites-available/pams
ln -sf /etc/nginx/sites-available/pams /etc/nginx/sites-enabled/pams

# Remove default Nginx site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config (before SSL, use HTTP-only temporarily)
# First, create a temporary HTTP-only config for certbot
cat > /etc/nginx/sites-available/pams-temp << 'TEMPEOF'
server {
    listen 80;
    server_name pms.agrovilla.in pms.nraco.in;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
TEMPEOF

ln -sf /etc/nginx/sites-available/pams-temp /etc/nginx/sites-enabled/pams
nginx -t
systemctl reload nginx

echo "→ Getting SSL certificate for pms.agrovilla.in..."
certbot --nginx -d pms.agrovilla.in --non-interactive --agree-tos --email admin@agrovilla.in || echo "⚠ Failed for agrovilla - check DNS"

echo "→ Getting SSL certificate for pms.nraco.in..."
certbot --nginx -d pms.nraco.in --non-interactive --agree-tos --email admin@nraco.in || echo "⚠ Failed for nraco - check DNS"

# Now put the full config with SSL
cp /var/www/pams/deploy/nginx-pams.conf /etc/nginx/sites-available/pams
ln -sf /etc/nginx/sites-available/pams /etc/nginx/sites-enabled/pams
rm -f /etc/nginx/sites-available/pams-temp

nginx -t && systemctl reload nginx

echo ""
echo "SSL setup complete!"
echo "→ https://pms.agrovilla.in"
echo "→ https://pms.nraco.in"
echo ""
echo "Auto-renewal is configured. Certificates renew automatically."
