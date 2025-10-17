#!/bin/bash

# ============================================
# EC2 Setup Script for Unified Portal
# ============================================
# This script automates the initial setup on a fresh Ubuntu 22.04 EC2 instance
# Run with: bash ec2-setup.sh YOUR_EC2_PUBLIC_IP

set -e  # Exit on any error

echo "🚀 Starting EC2 Setup for Unified Portal..."

# Check if IP provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your EC2 public IP as argument"
    echo "Usage: bash ec2-setup.sh YOUR_EC2_PUBLIC_IP"
    exit 1
fi

EC2_IP=$1
echo "📍 EC2 IP: $EC2_IP"

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
echo "📦 Installing pnpm..."
curl -fsSL https://get.pnpm.io/install.sh | sh -
export PNPM_HOME="/home/ubuntu/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Git and PostgreSQL client
echo "📦 Installing Git and PostgreSQL client..."
sudo apt install -y git postgresql-client

# Create directory structure
echo "📁 Creating directory structure..."
sudo mkdir -p /var/www
cd /var/www

# Clone repository
echo "📥 Cloning repository..."
sudo git clone https://github.com/bullhunter6/Unified-portal.git portal-v1.0.0
sudo chown -R ubuntu:ubuntu portal-v1.0.0
cd portal-v1.0.0

# Create .env file
echo "📝 Creating .env file..."
cat > .env << EOL
# ============================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ============================================

# ============================================
# DATABASE CONFIGURATION
# ============================================

DATABASE_URL="postgresql://postgres:finvizier2023@esgarticles.cf4iaa2amdt3.me-central-1.rds.amazonaws.com:5432/postgres?sslmode=require"
ESG_DATABASE_URL="postgresql://postgres:finvizier2023@esgarticles.cf4iaa2amdt3.me-central-1.rds.amazonaws.com:5432/postgres?sslmode=require"
CREDIT_DATABASE_URL="postgresql://postgres:finvizier2023@creditarticles.cf4iaa2amdt3.me-central-1.rds.amazonaws.com:5432/postgres?sslmode=require"

# ============================================
# NEXTAUTH CONFIGURATION
# ============================================

NEXTAUTH_URL=http://${EC2_IP}:3000
NEXTAUTH_SECRET=edce3d00265b2f00ea4326e13bc44ddeeaa18bf9ee0c812e7f084833f3194c15

# ============================================
# EMAIL CONFIGURATION
# ============================================

MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=news.ai.finviz@gmail.com
MAIL_PASSWORD=ndxu rpsr rcza opna
MAIL_FROM=news.ai.finviz@gmail.com

# ============================================
# CRON JOB SECURITY
# ============================================

CRON_SECRET=955b2042731cf483a27254922ff1449c7da6abcc6b49a648dfa927a6358ad267

# ============================================
# APPLICATION CONFIGURATION
# ============================================

NODE_ENV=production
PORT=3000
APP_URL=http://${EC2_IP}:3000
NEXT_PUBLIC_BASE_URL=http://${EC2_IP}:3000

# ============================================
# PDFX CONFIGURATION
# ============================================

PDFX_STORAGE_DIR=/var/data/pdfx_store
EOL

# Secure .env file
chmod 600 .env

# Create log directory
echo "📁 Creating log directory..."
mkdir -p logs

# Install dependencies
echo "📦 Installing project dependencies..."
pnpm install

# Generate Prisma clients
echo "⚙️ Generating Prisma clients..."
pnpm db:generate

# Build application
echo "🔨 Building application..."
cd apps/web
pnpm build

# Go back to root
cd /var/www/portal-v1.0.0

# Create PM2 ecosystem file
echo "📝 Creating PM2 ecosystem file..."
cat > ecosystem.config.js << 'EOL'
module.exports = {
  apps: [{
    name: 'portal-v1.0.0',
    cwd: '/var/www/current/apps/web',
    script: 'node_modules/.bin/next',
    args: 'start',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/current/logs/error.log',
    out_file: '/var/www/current/logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
EOL

# Create symlink
echo "🔗 Creating symlink..."
cd /var/www
sudo ln -sf /var/www/portal-v1.0.0 /var/www/current

# Start with PM2
echo "🚀 Starting application with PM2..."
cd /var/www/current
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
echo "⚙️ Setting up PM2 startup..."
pm2 startup

echo ""
echo "✅ ============================================"
echo "✅ Setup Complete!"
echo "✅ ============================================"
echo ""
echo "📋 Next Steps:"
echo "1. Run the PM2 startup command shown above (if any)"
echo "2. Open your browser to: http://${EC2_IP}:3000"
echo "3. Test the application"
echo ""
echo "🔍 Useful Commands:"
echo "  pm2 list                    - View all apps"
echo "  pm2 logs portal-v1.0.0      - View logs"
echo "  pm2 monit                   - Monitor resources"
echo ""
echo "📍 Your application is now running at:"
echo "   http://${EC2_IP}:3000"
echo ""
