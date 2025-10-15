# Quick Start: Production Deployment Guide

## 🚀 Pre-Deployment Steps (1-2 hours)

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env.local

# Generate secrets
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -base64 32  # For CRON_SECRET

# Edit .env.local with your values
# Set all required variables (see .env.example)
```

### 2. Database Preparation
```bash
# Generate Prisma clients
pnpm db:generate

# Apply database indexes (IMPORTANT for performance)
# Connect to your production databases and run:
psql -U postgres -d credit_db -f scripts/apply-indexes.sql
psql -U postgres -d esg_db -f scripts/apply-indexes.sql
```

### 3. Security Checklist
- [ ] Strong NEXTAUTH_SECRET generated
- [ ] Strong CRON_SECRET generated
- [ ] Database uses SSL (?sslmode=require)
- [ ] All sensitive data in environment variables
- [ ] `.env` files in `.gitignore`

### 4. Build & Test
```bash
# Install dependencies
pnpm install --frozen-lockfile

# Type check
cd apps/web && pnpm tsc --noEmit

# Build for production
pnpm build

# Test production build locally
pnpm start
```

---

## 🐳 Option 1: Docker Deployment (Recommended)

### Quick Start
```bash
# 1. Copy and configure environment
cp .env.example .env

# 2. Edit .env with production values
nano .env

# 3. Build and start
docker-compose up -d

# 4. Check logs
docker-compose logs -f app

# 5. Health check
curl http://localhost:3000/api/health
```

### Production Docker Tips
- Use Docker secrets for sensitive data
- Mount volumes for uploads and PDFs
- Use nginx reverse proxy for HTTPS
- Enable automatic restarts
- Monitor container health

---

## ☁️ Option 2: Vercel Deployment (Easiest)

### Setup
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
cd apps/web
vercel --prod
```

### Configure in Vercel Dashboard
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.example`
3. Set build command: `cd ../.. && pnpm install && pnpm build`
4. Set output directory: `apps/web/.next`
5. Enable automatic deployments from GitHub

**Important:** Vercel needs access to both databases from the internet.

---

## 🖥️ Option 3: VPS Deployment (Full Control)

### Server Requirements
- Ubuntu 22.04 LTS or newer
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ storage
- Node.js 20+
- PostgreSQL 15+

### Deployment Steps

```bash
# 1. Connect to your server
ssh user@your-server.com

# 2. Install dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx
npm install -g pnpm pm2

# 3. Clone repository
cd /var/www
git clone your-repo-url portal
cd portal

# 4. Configure environment
cp .env.example .env
nano .env  # Edit with production values

# 5. Install and build
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build

# 6. Start with PM2
cd apps/web
pm2 start npm --name "portal" -- start
pm2 save
pm2 startup

# 7. Configure Nginx
sudo nano /etc/nginx/sites-available/portal
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🔄 Post-Deployment Tasks

### 1. Verify Deployment
```bash
# Check health endpoint
curl https://yourdomain.com/api/health

# Check application logs
# Docker: docker-compose logs -f app
# PM2: pm2 logs portal

# Test critical features
# - Login
# - View articles
# - View events
# - Admin dashboard
# - Alert system
```

### 2. Setup Monitoring
```bash
# Install monitoring tools
# - Sentry for error tracking
# - UptimeRobot for uptime monitoring
# - CloudWatch/DataDog for logs

# Configure alerts
# - Email alerts for errors
# - Slack notifications for deployments
# - Database performance alerts
```

### 3. Configure Backups
```bash
# Database backup (daily)
# Add to crontab: crontab -e
0 2 * * * pg_dump -U postgres credit_db > /backups/credit_$(date +\%Y\%m\%d).sql
0 2 * * * pg_dump -U postgres esg_db > /backups/esg_$(date +\%Y\%m\%d).sql

# Upload backup script
# Add to crontab after database backup
30 2 * * * aws s3 cp /backups/ s3://your-backup-bucket/ --recursive
```

### 4. Setup Cron Jobs
```bash
# Alert processing (every 15 minutes)
*/15 * * * * curl -X POST https://yourdomain.com/api/cron/process-alerts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Email queue cleanup (daily at 3 AM)
0 3 * * * curl -X POST https://yourdomain.com/api/cron/cleanup-queue \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 📊 Performance Optimization

### 1. Database Indexes (CRITICAL)
```bash
# Apply recommended indexes
psql -U postgres -d credit_db -f DATABASE_OPTIMIZATION.md

# Monitor query performance
# Add to your monitoring dashboard
```

### 2. CDN Setup
- Enable Cloudflare or similar CDN
- Cache static assets
- Enable Brotli compression
- Setup cache purging

### 3. Image Optimization
- Use next/image for all images
- Serve WebP format
- Configure proper cache headers

---

## 🔐 Security Hardening

### 1. Server Hardening
```bash
# Enable firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 2. Database Security
```sql
-- Create app-specific user (not root)
CREATE USER portal_app WITH PASSWORD 'strong-password';
GRANT CONNECT ON DATABASE credit_db TO portal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portal_app;

-- Enable SSL
ALTER SYSTEM SET ssl = on;
```

### 3. Application Security
- Enable rate limiting on API routes
- Add CAPTCHA to login forms
- Implement IP whitelisting for admin routes
- Regular security audits

---

## 📈 Scaling Strategies

### When to Scale
- Response time > 2 seconds
- CPU usage > 70% consistently
- Memory usage > 80%
- Database connections maxed out

### Scaling Options
1. **Vertical Scaling:** Upgrade server resources
2. **Horizontal Scaling:** Add more app instances + load balancer
3. **Database Scaling:** Read replicas + connection pooling
4. **Caching:** Add Redis for session/query caching
5. **CDN:** Offload static assets

---

## 🆘 Troubleshooting

### App Won't Start
```bash
# Check logs
pm2 logs portal --lines 100

# Check environment
env | grep DATABASE_URL

# Test database connection
psql $DATABASE_URL_CREDIT -c "SELECT 1"

# Check port availability
lsof -i :3000
```

### Slow Performance
```bash
# Check database indexes
psql -d credit_db -c "\di"

# Monitor queries
# Enable pg_stat_statements

# Check server resources
htop
df -h
```

### Email Not Sending
```bash
# Check email configuration
echo $MAIL_USERNAME
echo $MAIL_SERVER

# Test SMTP connection
telnet smtp.gmail.com 587

# Check email queue
psql -d credit_db -c "SELECT * FROM email_queue WHERE status = 'failed' LIMIT 10"
```

---

## 📞 Support Checklist

Before contacting support, gather:
- [ ] Application logs (last 100 lines)
- [ ] Database error logs
- [ ] Server resource usage (CPU, RAM, Disk)
- [ ] Recent deployments or changes
- [ ] Steps to reproduce the issue
- [ ] Environment variables (redacted sensitive data)

---

## 🎯 Success Criteria

Your deployment is successful when:
- ✅ Application loads in < 3 seconds
- ✅ Health endpoint returns 200
- ✅ Users can login successfully
- ✅ Articles and events display correctly
- ✅ Admin dashboard accessible
- ✅ Alerts are being sent
- ✅ Email queue processing
- ✅ No errors in logs (last 24h)
- ✅ SSL certificate valid
- ✅ Monitoring/alerting active
- ✅ Backups running daily

---

## 📚 Additional Resources

- [Next.js Production Checklist](https://nextjs.org/docs/deployment)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Performance](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [OWASP Security Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

**Need Help?** Check `PRODUCTION_READINESS_CHECKLIST.md` for comprehensive guidance.

**Last Updated:** October 15, 2025
