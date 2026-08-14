import type { Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL ?? "e2e-user@example.test";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "E2e-Smoke-Password!42";

export async function authenticateE2eUser(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email Address").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/esg$/),
    page.getByRole("button", { name: "Sign In" }).click(),
  ]);
}
