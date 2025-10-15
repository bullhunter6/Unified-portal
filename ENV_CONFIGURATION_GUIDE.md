# Environment Configuration Guide

## 📁 Environment Files Structure

Your project now has a consolidated environment configuration:

### **Root Level** (`Portal_v3/`)
- **`.env`** - Main development environment file
- **`.env.production`** - Production-ready configuration (for AWS EC2)
- **`.env.example`** - Template with placeholders (for reference)

### **Web App** (`apps/web/`)
- **`.env.local`** - Next.js specific environment variables

### **Database Packages**
- **`packages/db-esg/.env`** - ESG database URL (Prisma)
- **`packages/db-credit/.env`** - Credit database URL (Prisma)

---

## ✅ Current Configuration (Your Actual Keys)

### **Database Configuration**
- **ESG Database**: `esgarticles.cf4iaa2amdt3.me-central-1.rds.amazonaws.com`
- **Credit Database**: `creditarticles.cf4iaa2amdt3.me-central-1.rds.amazonaws.com`
- **User**: `postgres`
- **Password**: `finvizier2023`
- **Port**: `5432`
- **SSL Mode**: Required (AWS RDS)

### **Email Configuration (Gmail SMTP)**
- **Server**: `smtp.gmail.com:587`
- **Username**: `news.ai.finviz@gmail.com`
- **Password**: `ndxu rpsr rcza opna` (Gmail App Password)
- **Daily Limit**: 500 emails (sufficient for alerts)

### **Authentication**
- **NextAuth Secret**: `edce3d00265b2f00ea4326e13bc44ddeeaa18bf9ee0c812e7f084833f3194c15`
- **URL**: `http://localhost:3000` (change for production)

### **Cron Security**
- **Cron Secret**: `955b2042731cf483a27254922ff1449c7da6abcc6b49a648dfa927a6358ad267`

---

## 🚀 For Local Development

Use the current configuration:
```bash
# Location: Portal_v3/.env or apps/web/.env.local
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Start development server:**
```powershell
cd apps/web
pnpm dev
```

---

## 🌐 For Production Deployment (AWS EC2)

### **1. Copy `.env.production` to your EC2 instance**
```bash
scp .env.production ubuntu@your-ec2-ip:/var/www/portal-v1.0.0/.env
```

### **2. Update Production-Specific Values**

Edit the file on your EC2 instance:
```bash
sudo nano /var/www/portal-v1.0.0/.env
```

**Critical changes needed:**
```bash
# Change these from localhost to your production domain
NEXTAUTH_URL=https://your-domain.com
APP_URL=https://your-domain.com
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# Change environment
NODE_ENV=production

# Add OpenAI API key if using PDFX features
OPENAI_API_KEY=sk-your-actual-openai-key

# Optional: Update storage directory
PDFX_STORAGE_DIR=/var/data/pdfx_store
```

### **3. Secure the file**
```bash
chmod 600 /var/www/portal-v1.0.0/.env
```

---

## ⚙️ Environment Variables Reference

### **Required for Basic Operation**
| Variable | Current Value | Description |
|----------|---------------|-------------|
| `DATABASE_URL` | AWS RDS ESG | Primary database connection |
| `ESG_DATABASE_URL` | AWS RDS ESG | ESG database |
| `CREDIT_DATABASE_URL` | AWS RDS Credit | Credit database |
| `NEXTAUTH_SECRET` | (set) | Authentication secret |
| `NEXTAUTH_URL` | localhost | App URL |
| `MAIL_SERVER` | smtp.gmail.com | Email server |
| `MAIL_USERNAME` | news.ai.finviz@gmail.com | Email account |
| `MAIL_PASSWORD` | (set) | Gmail app password |
| `CRON_SECRET` | (set) | Cron job authentication |

### **Required for PDFX Features**
| Variable | Status | Description |
|----------|--------|-------------|
| `OPENAI_API_KEY` | ⚠️ **MISSING** | OpenAI API key for PDF features |
| `PDFX_STORAGE_DIR` | .pdfx_store | PDF storage location |

### **Optional (Not Required)**
| Variable | Description |
|----------|-------------|
| `CUSTOM_AI_URL` | Custom AI service endpoint |
| `CUSTOM_AI_KEY` | Custom AI service key |
| `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring |
| `NEXT_PUBLIC_GA_ID` | Google Analytics |
| `AWS_ACCESS_KEY_ID` | AWS S3 storage |
| `REDIS_URL` | Redis caching |

---

## 🔐 Security Best Practices

### **Development**
- ✅ `.env` files are in `.gitignore`
- ✅ Using Gmail app password (not actual password)
- ✅ All secrets are unique and secure

### **Production Deployment**
Before deploying to AWS EC2:

1. **Generate New Secrets** (recommended but optional)
   ```bash
   # Generate new NEXTAUTH_SECRET
   openssl rand -base64 32
   
   # Generate new CRON_SECRET
   openssl rand -base64 32
   ```

2. **Update URLs**
   - Change `localhost` to your production domain
   - Ensure HTTPS is used (not HTTP)

3. **File Permissions**
   ```bash
   chmod 600 .env
   ```

4. **Environment Isolation**
   - Never use development `.env` in production
   - Keep production secrets separate

---

## 🧪 Testing Environment Configuration

### **Verify Local Setup**
```powershell
cd apps/web
pnpm dev
```

Open browser: `http://localhost:3000`

### **Test Database Connections**
```powershell
# Test ESG database
pnpm --filter db-esg db:generate

# Test Credit database  
pnpm --filter db-credit db:generate
```

### **Test Email Configuration**
Navigate to: `http://localhost:3000/admin/alerts`
- Create a test alert
- Check if email sends successfully

---

## 📝 Quick Checklist

### **For Local Development** ✅
- [x] `.env` configured with your actual keys
- [x] `apps/web/.env.local` configured
- [x] Database packages have `.env` files
- [x] All secrets are set
- [ ] Add `OPENAI_API_KEY` if using PDFX features

### **For Production Deployment**
- [x] `.env.production` file created with all keys
- [ ] Copy `.env.production` to EC2 as `.env`
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Update `APP_URL` to production domain
- [ ] Update `NEXT_PUBLIC_BASE_URL` to production domain
- [ ] Set `NODE_ENV=production`
- [ ] Add `OPENAI_API_KEY` if using PDFX
- [ ] Update `PDFX_STORAGE_DIR` for production storage
- [ ] Set file permissions to 600
- [ ] Test application startup
- [ ] Verify database connections
- [ ] Test email sending

---

## 🆘 Troubleshooting

### **"Database connection failed"**
- Verify AWS RDS security groups allow your IP
- Check database URLs have `?sslmode=require`
- Test connection: `psql -h esgarticles.cf4iaa2amdt3.me-central-1.rds.amazonaws.com -U postgres -d postgres`

### **"Email not sending"**
- Verify Gmail app password is correct (spaces included)
- Check Gmail account has 2FA enabled
- Verify SMTP settings: port 587, TLS enabled
- Check daily limit (500 emails/day for free Gmail)

### **"NextAuth error"**
- Ensure `NEXTAUTH_URL` matches your actual domain
- Verify `NEXTAUTH_SECRET` is set and not empty
- Check callback URLs in production

### **"PDFX features not working"**
- Add your OpenAI API key to `OPENAI_API_KEY`
- Verify storage directory exists and is writable
- Check OpenAI account has credits

---

## 📞 Next Steps

1. **Add OpenAI API Key** (if using PDFX features)
   - Get key from: https://platform.openai.com/api-keys
   - Add to all environment files

2. **Test Local Setup**
   ```powershell
   cd apps/web
   pnpm dev
   ```

3. **Ready for Production?**
   - Use `.env.production` as your template
   - Follow the "For Production Deployment" section above

---

**All your actual credentials are now consolidated and ready for deployment!** 🎉
