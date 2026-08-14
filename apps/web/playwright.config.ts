import { defineConfig, devices } from "@playwright/test";

const e2eAuthSecret =
  process.env.NEXTAUTH_SECRET ?? "portal-v3-playwright-session-secret";
process.env.NEXTAUTH_SECRET = e2eAuthSecret;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: "http://127.0.0.1:3000/signin",
    env: { NEXTAUTH_SECRET: e2eAuthSecret },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
