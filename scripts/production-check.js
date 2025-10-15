#!/usr/bin/env node
/**
 * Production Readiness Check Script
 * Validates critical configuration before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Running Production Readiness Check...\n');

let errors = [];
let warnings = [];
let passed = [];

// ============================================
// Check 1: Environment Variables
// ============================================
console.log('📋 Checking Environment Variables...');

const requiredEnvVars = [
  'DATABASE_URL_ESG',
  'DATABASE_URL_CREDIT',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'CRON_SECRET',
];

const recommendedEnvVars = [
  'MAIL_USERNAME',
  'MAIL_PASSWORD',
  'MAIL_SERVER',
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_BASE_URL',
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    errors.push(`Missing required environment variable: ${varName}`);
  } else if (process.env[varName].includes('change-this')) {
    errors.push(`${varName} contains placeholder value - please generate a real secret`);
  } else {
    passed.push(`✓ ${varName} is set`);
  }
});

recommendedEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    warnings.push(`Missing recommended environment variable: ${varName}`);
  } else {
    passed.push(`✓ ${varName} is set`);
  }
});

// Check NEXTAUTH_SECRET strength
if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
  errors.push('NEXTAUTH_SECRET is too short (minimum 32 characters)');
}

// ============================================
// Check 2: Database Connection Strings
// ============================================
console.log('\n🗄️  Checking Database Configuration...');

const checkDbUrl = (url, name) => {
  if (!url) return;
  
  if (process.env.NODE_ENV === 'production' && !url.includes('sslmode=require')) {
    warnings.push(`${name} should use SSL in production (add ?sslmode=require)`);
  }
  
  if (url.includes('localhost') && process.env.NODE_ENV === 'production') {
    warnings.push(`${name} points to localhost in production`);
  }
  
  if (url.includes('postgres:postgres@')) {
    warnings.push(`${name} uses default postgres credentials - use dedicated user`);
  }
};

checkDbUrl(process.env.DATABASE_URL_ESG, 'DATABASE_URL_ESG');
checkDbUrl(process.env.DATABASE_URL_CREDIT, 'DATABASE_URL_CREDIT');

// ============================================
// Check 3: Files and Directories
// ============================================
console.log('\n📁 Checking Project Structure...');

const requiredFiles = [
  '.env.example',
  '.gitignore',
  'package.json',
  'pnpm-lock.yaml',
  'apps/web/package.json',
  'packages/db-esg/prisma/schema.prisma',
  'packages/db-credit/prisma/schema.prisma',
];

requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing required file: ${file}`);
  } else {
    passed.push(`✓ ${file} exists`);
  }
});

// Check if .env is in .gitignore
const gitignorePath = path.join(process.cwd(), '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  if (!gitignore.includes('.env')) {
    errors.push('.env files are not in .gitignore - SECURITY RISK');
  } else {
    passed.push('✓ .env files are properly ignored');
  }
}

// ============================================
// Check 4: Prisma Clients
// ============================================
console.log('\n🔧 Checking Prisma Configuration...');

const prismaClients = [
  'packages/db-esg/generated/client',
  'packages/db-credit/generated/client',
];

prismaClients.forEach(client => {
  const clientPath = path.join(process.cwd(), client);
  if (!fs.existsSync(clientPath)) {
    warnings.push(`Prisma client not generated: ${client} - run 'pnpm db:generate'`);
  } else {
    passed.push(`✓ ${client} is generated`);
  }
});

// ============================================
// Check 5: Node Environment
// ============================================
console.log('\n⚙️  Checking Node Environment...');

const nodeVersion = process.version;
const major = parseInt(nodeVersion.split('.')[0].slice(1));

if (major < 18) {
  errors.push(`Node.js version ${nodeVersion} is too old. Use Node 18+ (20+ recommended)`);
} else {
  passed.push(`✓ Node.js ${nodeVersion} is compatible`);
}

// ============================================
// Check 6: Security
// ============================================
console.log('\n🔐 Checking Security Configuration...');

if (process.env.NODE_ENV === 'production') {
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith('http://')) {
    errors.push('NEXTAUTH_URL uses HTTP in production - MUST use HTTPS');
  }
  
  if (process.env.NEXTAUTH_SECRET === 'your-secret-key-change-this-in-production') {
    errors.push('NEXTAUTH_SECRET uses default value - SECURITY RISK');
  }
} else {
  passed.push('✓ Running in development mode - production checks skipped');
}

// ============================================
// Check 7: Build Output
// ============================================
console.log('\n🏗️  Checking Build Configuration...');

const nextConfigPath = path.join(process.cwd(), 'apps/web/next.config.js');
if (fs.existsSync(nextConfigPath)) {
  const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
  if (nextConfig.includes("output: 'standalone'")) {
    passed.push('✓ Next.js configured for Docker deployment');
  } else {
    warnings.push('Next.js not configured for standalone output (needed for Docker)');
  }
}

// ============================================
// Results Summary
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 RESULTS SUMMARY');
console.log('='.repeat(60) + '\n');

console.log(`✅ Passed Checks: ${passed.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);
console.log(`❌ Errors: ${errors.length}\n`);

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  warnings.forEach(warning => console.log(`   - ${warning}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ ERRORS (Must fix before production):');
  errors.forEach(error => console.log(`   - ${error}`));
  console.log('');
  console.log('💡 See PRODUCTION_READINESS_CHECKLIST.md for guidance\n');
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('⚠️  Some warnings found. Review them before deployment.\n');
  process.exit(0);
}

console.log('✅ All checks passed! Ready for production.\n');
console.log('Next steps:');
console.log('  1. Review PRODUCTION_READINESS_CHECKLIST.md');
console.log('  2. Run "pnpm build" to create production build');
console.log('  3. Test with "pnpm start"');
console.log('  4. Deploy using DEPLOYMENT_GUIDE.md\n');

process.exit(0);
