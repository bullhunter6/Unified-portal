/**
 * Next.js Instrumentation
 * 
 * This file runs once when the server starts, perfect for initializing
 * background workers like our alert scheduler.
 * 
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAlertScheduler } = await import('./lib/alert-scheduler');
    
    // Start the alert scheduler
    startAlertScheduler();
  }
}
