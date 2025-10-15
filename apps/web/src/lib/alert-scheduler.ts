import cron from 'node-cron';

/**
 * Alert Scheduler Worker
 * 
 * This worker runs inside the Next.js application and schedules alert processing
 * using node-cron. No external cron daemon needed!
 * 
 * Schedules:
 * - Alert Processing: Every hour at :00 minutes
 * - Email Queue Processing: Every 5 minutes
 */

const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key-change-this';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Flag to ensure we only start once
let isStarted = false;

async function callEndpoint(path: string, name: string) {
  try {
    const url = `${APP_URL}${path}`;
    const now = new Date();
    const dubaiTime = now.toLocaleString('en-US', { timeZone: 'Asia/Dubai', hour12: false });
    console.log(`[UTC: ${now.toISOString()} | Dubai: ${dubaiTime}] Triggering ${name}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    const endTime = new Date();
    const endDubaiTime = endTime.toLocaleString('en-US', { timeZone: 'Asia/Dubai', hour12: false });
    
    if (response.ok) {
      console.log(`[UTC: ${endTime.toISOString()} | Dubai: ${endDubaiTime}] ✅ ${name} completed:`, data);
    } else {
      console.error(`[UTC: ${endTime.toISOString()} | Dubai: ${endDubaiTime}] ❌ ${name} failed:`, data);
    }
  } catch (error) {
    const errorTime = new Date();
    const errorDubaiTime = errorTime.toLocaleString('en-US', { timeZone: 'Asia/Dubai', hour12: false });
    console.error(`[UTC: ${errorTime.toISOString()} | Dubai: ${errorDubaiTime}] ❌ ${name} error:`, error);
  }
}

export function startAlertScheduler() {
  // Prevent multiple starts
  if (isStarted) {
    console.log('⚠️  Alert scheduler already started, skipping...');
    return;
  }

  console.log('🚀 Starting Alert Scheduler...');
  
  // Alert Processing - Every 5 minutes
  // Cron: "*/5 * * * *" = Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await callEndpoint('/api/cron/process-alerts', 'Alert Processing');
  }, {
    timezone: "Asia/Dubai" // Adjust to your timezone
  });
  
  console.log('✅ Alert Processing scheduled: Every 5 minutes');

  // Email Queue Processing - Every 5 minutes
  // Cron: "*/5 * * * *" = Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await callEndpoint('/api/cron/process-queue', 'Email Queue Processing');
  }, {
    timezone: "Asia/Dubai" // Adjust to your timezone
  });
  
  console.log('✅ Email Queue Processing scheduled: Every 5 minutes');

  isStarted = true;
  console.log('🎉 Alert Scheduler started successfully!');
  console.log(`📍 Timezone: Asia/Dubai`);
  console.log(`🔒 Using CRON_SECRET: ${CRON_SECRET.substring(0, 10)}...`);
}

export function stopAlertScheduler() {
  if (isStarted) {
    // node-cron doesn't provide a direct way to stop all tasks
    // but we can set the flag to prevent restart
    isStarted = false;
    console.log('🛑 Alert Scheduler stopped');
  }
}

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  startAlertScheduler();
}
