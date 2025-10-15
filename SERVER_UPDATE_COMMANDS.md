# Server Update Commands for PDF Translator Fix
# Date: October 15, 2025
# Target: portal-v1.0.3
# Current Running: portal-v1.0.3 (will rollback to v1.0.2 during update)

## Phase 1: Connect and Check Current Status

### 1. Connect to EC2 Server
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

### 2. Check Current Running Version
```bash
pm2 status
```
**Expected Output:** Should show `portal-v1.0.3` running

### 3. Check if OCR Dependencies are Installed
```bash
# Check for ocrmypdf
which ocrmypdf
ocrmypdf --version

# Check for tesseract (required by ocrmypdf)
which tesseract
tesseract --version

# Check for qpdf (optional but recommended)
which qpdf
qpdf --version
```

**If any are missing, we'll install them in Phase 2.**

---

## Phase 2: Install OCR Dependencies (If Missing)

### 4. Install OCR Tools
```bash
# Update package list
sudo apt update

# Install Tesseract OCR with language packs
sudo apt install -y tesseract-ocr tesseract-ocr-eng

# Install ocrmypdf
sudo apt install -y ocrmypdf

# Install qpdf (for faster page extraction)
sudo apt install -y qpdf

# Install additional dependencies
sudo apt install -y ghostscript
```

### 5. Verify Installation
```bash
# Check ocrmypdf
ocrmypdf --version
# Should show: ocrmypdf 14.x.x or higher

# Check tesseract
tesseract --version
# Should show: tesseract 4.x or 5.x

# List available languages
tesseract --list-langs
# Should include: eng, osd
```

### 6. Install Comprehensive Language Packs (All Major Languages)
```bash
# Install ALL major language packs for OCR support
# This enables text extraction from documents in any major language
sudo apt install -y \
  tesseract-ocr-ara \
  tesseract-ocr-chi-sim \
  tesseract-ocr-chi-tra \
  tesseract-ocr-rus \
  tesseract-ocr-spa \
  tesseract-ocr-fra \
  tesseract-ocr-deu \
  tesseract-ocr-jpn \
  tesseract-ocr-kor \
  tesseract-ocr-ita \
  tesseract-ocr-por \
  tesseract-ocr-tur \
  tesseract-ocr-vie \
  tesseract-ocr-hin \
  tesseract-ocr-uzb \
  tesseract-ocr-uzb-cyrl

# Verify installed languages
tesseract --list-langs

# You should see:
# ara (Arabic)
# chi_sim (Chinese - Simplified)
# chi_tra (Chinese - Traditional)
# deu (German)
# eng (English)
# fra (French)
# hin (Hindi)
# ita (Italian)
# jpn (Japanese)
# kor (Korean)
# por (Portuguese)
# rus (Russian)
# spa (Spanish)
# tur (Turkish)
# uzb (Uzbek Latin)
# uzb_cyrl (Uzbek Cyrillic)
# vie (Vietnamese)
# ... and others
```

**Note:** This installation may take 2-5 minutes and requires ~500MB disk space.

---

## Phase 3: Prepare Rollback Version (v1.0.2)

### 7. Check if v1.0.2 Exists
```bash
ls -la /var/www/ | grep portal
```

**If portal-v1.0.2 does NOT exist:**
```bash
# Clone v1.0.2 (rollback version)
cd /var/www
sudo git clone https://github.com/bullhunter6/Unified-portal.git portal-v1.0.2
sudo chown -R ubuntu:ubuntu portal-v1.0.2
cd portal-v1.0.2

# Checkout v1.0.2 tag or commit (adjust as needed)
# git checkout v1.0.2  # If you have tags
# OR
# git checkout <commit-hash-of-v1.0.2>  # If you know the commit

# Copy environment file
cp /var/www/portal-v1.0.3/.env .env
cp .env apps/web/.env

# Install dependencies
pnpm install

# Generate Prisma clients
pnpm db:generate

# Build
cd apps/web
pnpm build
cd ../..

# Create logs directory
mkdir -p logs

# Create ecosystem config for v1.0.2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'portal-v1.0.2',
    cwd: '/var/www/current/apps/web',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/www/current/logs/error.log',
    out_file: '/var/www/current/logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
}
EOF
```

### 8. Switch to v1.0.2 (Rollback for safety during update)
```bash
# Stop current version
pm2 delete all

# Update symlink to v1.0.2
cd /var/www
sudo ln -sfn /var/www/portal-v1.0.2 /var/www/current

# Start v1.0.2
cd /var/www/current
pm2 start ecosystem.config.js
pm2 save

# Verify v1.0.2 is running
pm2 status
curl -I http://localhost:3000
```

**Users can now continue using the site on v1.0.2 while we update v1.0.3**

---

## Phase 4: Push Local Changes to Git

### 9. On Your Local Windows Machine (Run in PowerShell)
```powershell
# Navigate to project directory
cd C:\Users\saikr\OneDrive\Documents\projects\esg\Portal_v3

# Check what files changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Fix: Add comprehensive logging to PDF translator pipeline

- Add detailed console.log statements in pipeline.ts for job tracking
- Add extraction logging in extract.ts for debugging
- Fix OCR workflow visibility
- Improve error handling and stack trace logging"

# Push to main branch
git push origin main
```

**Wait for confirmation that push succeeded before proceeding.**

---

## Phase 5: Update v1.0.3 on Server

### 10. Back on EC2 Server - Navigate to v1.0.3
```bash
cd /var/www/portal-v1.0.3
```

### 11. Pull Latest Changes
```bash
# Fetch latest from Git
git pull origin main
```

**You should see output showing the files that changed:**
- `apps/web/src/lib/pdfx/pipeline.ts`
- `apps/web/src/lib/pdfx/extract.ts`

### 12. Reinstall Dependencies (in case anything changed)
```bash
pnpm install
```

### 13. Regenerate Prisma Clients
```bash
pnpm db:generate
```

### 14. Rebuild Application
```bash
cd apps/web
pnpm build
```

**Wait for successful build completion.**

### 15. Return to Root and Update Ecosystem Config
```bash
cd /var/www/portal-v1.0.3

# Verify ecosystem config has correct name
cat ecosystem.config.js | grep name
# Should show: name: 'portal-v1.0.3'
```

---

## Phase 6: Deploy Updated v1.0.3

### 16. Stop v1.0.2
```bash
pm2 delete all
```

### 17. Switch Symlink to v1.0.3
```bash
cd /var/www
sudo ln -sfn /var/www/portal-v1.0.3 /var/www/current
```

### 18. Start Updated v1.0.3
```bash
cd /var/www/current
pm2 start ecosystem.config.js
pm2 save
```

### 19. Verify v1.0.3 is Running
```bash
pm2 status
# Should show: portal-v1.0.3 | online

pm2 logs portal-v1.0.3 --lines 20
```

### 20. Test Application
```bash
# Test local connection
curl -I http://localhost:3000

# Check logs for any errors
pm2 logs portal-v1.0.3 --lines 50 --nostream
```

---

## Phase 7: Test PDF Translator

### 21. Monitor Logs in Real-Time
```bash
# Open log monitoring in one terminal
pm2 logs portal-v1.0.3
```

### 22. Test PDF Upload from Browser
Open in browser: `http://YOUR_EC2_IP:3000/path-to-pdf-translator`

Upload a test PDF and watch the logs for:
```
[PDF Job <jobId>] Starting job for file: <filename>
[PDF Job <jobId>] Extracting pages from: <path>
[extractAllPages] Reading file: <path>
[extractPdfTextBuffer] Starting extraction, buffer size: <size>
[extractPdfTextBuffer] PDF loaded, total pages: <count>
[PDF Job <jobId>] Extracted <count> pages
```

### 23. Check Job Progress
Monitor the console output. You should now see detailed logs showing:
- File extraction progress
- OCR detection and processing
- Translation requests
- PDF generation

### 24. If You See Errors
```bash
# View full error logs
pm2 logs portal-v1.0.3 --err --lines 100

# Check error log file
cat /var/www/current/logs/error.log | tail -100
```

---

## Phase 8: Verification Checklist

### 25. Complete System Check
```bash
# Check PM2 status
pm2 status

# Check memory usage
pm2 monit
# Press Ctrl+C to exit

# Check disk space
df -h

# Check PDF store directory
ls -la /var/www/current/apps/web/.pdfx_store/
ls -la /var/www/current/apps/web/.pdfx_store/uploads/
ls -la /var/www/current/apps/web/.pdfx_store/outputs/
```

### 26. Test All Key Features
1. Homepage: `http://YOUR_EC2_IP:3000`
2. ESG Articles: `http://YOUR_EC2_IP:3000/esg/articles`
3. Credit Articles: `http://YOUR_EC2_IP:3000/credit/articles`
4. PDF Translator: Upload and translate a test PDF
5. Check job history and download translated PDF

---

## Troubleshooting Commands

### If PDF Jobs Stay "Queued"
```bash
# Check if background process is running
pm2 logs portal-v1.0.3 | grep "PDF Job"

# Check OpenAI API key
cd /var/www/current
cat .env | grep OPENAI_API_KEY

# Test OpenAI connectivity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"
```

### If OCR Fails
```bash
# Test ocrmypdf manually
cd /tmp
wget https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
ocrmypdf dummy.pdf output.pdf --sidecar output.txt
cat output.txt
```

### If Memory Issues
```bash
# Check memory
free -h

# If needed, increase PM2 memory limit
cd /var/www/current
nano ecosystem.config.js
# Change: max_memory_restart: '2G'

pm2 reload ecosystem.config.js
```

### Rollback to v1.0.2 (If Critical Issues)
```bash
pm2 delete all
cd /var/www
sudo ln -sfn /var/www/portal-v1.0.2 /var/www/current
cd /var/www/current
pm2 start ecosystem.config.js
pm2 save
```

---

## Success Criteria

✅ **Deployment Successful If:**
1. `pm2 status` shows `portal-v1.0.3 | online`
2. Website loads at `http://YOUR_EC2_IP:3000`
3. PDF upload creates job with proper logging
4. Job progresses through stages (visible in logs)
5. Translated PDF can be downloaded
6. No memory leaks (memory stays stable)

---

## Post-Deployment

### 27. Monitor for 30 Minutes
```bash
# Watch logs continuously
pm2 logs portal-v1.0.3
```

### 28. Clean Up (Optional - After 24h of stable operation)
```bash
# If v1.0.2 is no longer needed
# sudo rm -rf /var/www/portal-v1.0.2
```

---

## Quick Reference

```bash
# Current status
pm2 status

# View logs
pm2 logs portal-v1.0.3

# Restart if needed
pm2 restart portal-v1.0.3

# Check which version is active
ls -la /var/www/current

# Get public IP
curl -s http://169.254.169.254/latest/meta-data/public-ipv4
```

---

**Update Date:** October 15, 2025  
**Version:** v1.0.3 (with PDF translator logging fixes)  
**Status:** Ready for deployment
