import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { esgPrisma } from "@esgcredit/db-esg";

import { authenticateE2eUser } from "./auth";

const marker = "PW_ESG_LEDGER_20260804";
const crossMonthTitle = `${marker} Climate transition forum`;
const dubaiTitle = `${marker} Sustainable finance summit`;
const onlineTitle = `${marker} Disclosure webinar`;
let crossMonthId = 0;

test.beforeAll(async () => {
  await esgPrisma.$executeRaw`DELETE FROM events WHERE event_id LIKE ${`${marker}%`}`;
  await esgPrisma.$executeRaw`
    INSERT INTO events (
      event_id, event_name, event_url, tickets_url, start_date, end_date,
      start_time, end_time, timezone, timezone_iana, venue_name,
      venue_address, country_code, city, attendance_mode, organizer_name,
      summary, source
    ) VALUES
      (
        ${`${marker}-cross-month`}, ${crossMonthTitle},
        'https://events.example.test/climate-transition',
        'https://events.example.test/climate-transition/register',
        '2099-08-30'::date, '2099-09-02'::date, '09:00'::time,
        '17:00'::time, 'BST', 'Europe/London', 'Ledger Hall',
        '10 Ledger Street, London', 'GB', 'London', 'hybrid',
        'Ledger Institute', 'A verified cross-month Playwright event.',
        'Playwright Ledger Source'
      ),
      (
        ${`${marker}-dubai`}, ${dubaiTitle},
        'https://events.example.test/sustainable-finance', NULL,
        '2099-09-15'::date, NULL, NULL, NULL, 'GST', 'Asia/Dubai',
        'Dubai Forum', 'Dubai, UAE', 'AE', 'Dubai', 'in_person',
        'Ledger Institute', 'A verified Dubai Playwright event.',
        'Playwright Ledger Source'
      ),
      (
        ${`${marker}-online`}, ${onlineTitle},
        'https://events.example.test/disclosure-webinar', NULL,
        NULL, NULL, NULL, NULL, NULL, NULL, 'Zoom', NULL, NULL, NULL,
        'online', 'Ledger Institute', 'An undated online Playwright event.',
        'Playwright Ledger Source'
      )
  `;
  const rows = await esgPrisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM events WHERE event_id = ${`${marker}-cross-month`}
  `;
  crossMonthId = rows[0]?.id ?? 0;
  if (!crossMonthId) throw new Error("ESG Event Ledger Playwright fixture was not created.");
});

test.afterAll(async () => {
  await esgPrisma.$executeRaw`DELETE FROM events WHERE event_id LIKE ${`${marker}%`}`;
});

test("defaults to Upcoming and exposes every canonical time view", async ({ page }) => {
  test.setTimeout(90_000);
  await authenticateE2eUser(page);
  await page.goto(`/esg/events?q=${marker}`);

  await expect(page.getByRole("heading", { level: 1, name: "The ESG Event Ledger" })).toBeVisible();
  await expect(page.getByRole("heading", { name: crossMonthTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: dubaiTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: onlineTitle })).toHaveCount(0);

  const timeNavigation = page.getByRole("navigation", { name: "Event time period" });
  for (const label of ["Upcoming", "This week", "Past", "Date TBC", "All"]) {
    await expect(timeNavigation.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(timeNavigation.getByRole("link", { name: "Upcoming" })).toHaveAttribute("aria-current", "page");

  const monthSelector = page.locator("#esg-ledger-month");
  await monthSelector.selectOption("2099-08");
  await expect(page).toHaveURL(new RegExp(`when=2099-08.*q=${marker}`));
  await expect(page.getByRole("heading", { name: crossMonthTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: dubaiTitle })).toHaveCount(0);

  await monthSelector.selectOption("2099-09");
  await expect(page).toHaveURL(new RegExp(`when=2099-09.*q=${marker}`));
  await expect(page.getByRole("heading", { name: crossMonthTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: dubaiTitle })).toBeVisible();

  await monthSelector.selectOption("");
  await expect(page).toHaveURL(new RegExp(`when=all.*q=${marker}`));
  await expect(page.getByRole("heading", { name: onlineTitle })).toBeVisible();

  await page.goto(`/esg/events?when=tbc&q=${marker}`);
  await expect(page.getByRole("heading", { name: onlineTitle })).toBeVisible();
});

test("applies dependent location filters and synchronizes browser history", async ({ page }) => {
  await authenticateE2eUser(page);
  await page.goto(`/esg/events?q=${marker}`);

  const desktopFilters = page.getByRole("complementary", { name: "Event filters" });
  const country = desktopFilters.getByLabel("Country");
  const city = desktopFilters.getByLabel("City");
  await expect(city).toBeDisabled();
  await country.selectOption("GB");
  await expect(city).toBeEnabled();
  await city.selectOption("London");
  await country.selectOption("AE");
  await expect(city).toHaveValue("");
  await country.selectOption("GB");
  await city.selectOption("London");
  await desktopFilters.getByLabel("Attendance").selectOption("hybrid");
  await desktopFilters.getByRole("button", { name: "Apply filters" }).click();

  await expect(page).toHaveURL(/country=GB/);
  await expect(page).toHaveURL(/city=London/);
  await expect(page).toHaveURL(/format=hybrid/);
  await expect(page.getByRole("heading", { name: crossMonthTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: dubaiTitle })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Remove City filter: London/ })).toBeVisible();

  await page.getByRole("link", { name: /Remove City filter: London/ }).click();
  await expect(page).not.toHaveURL(/city=/);
  await page.goBack();
  await expect(page).toHaveURL(/city=London/);
  await expect(desktopFilters.getByLabel("City")).toHaveValue("London");

});

test("canonicalizes malformed state and renders a filtered-empty result", async ({ page }) => {
  await authenticateE2eUser(page);
  await page.goto("/esg/events?page=1e2&country=ZZ&city=Zzyzx&view=grid&pageSize=99");
  await expect(page).toHaveURL(/\/esg\/events$/);

  await page.goto(`/esg/events?q=${marker}-does-not-exist`);
  await expect(page.getByRole("heading", { name: "The ledger has no entry for that combination." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear filters" }).last()).toBeVisible();
});

test("keeps detail and official links separate and preserves the ledger return URL", async ({
  context,
  page,
}) => {
  await authenticateE2eUser(page);
  const listUrl = `/esg/events?q=${marker}&country=GB&city=London&format=hybrid`;
  await page.goto(listUrl);
  const eventRow = page.getByRole("article").filter({ hasText: crossMonthTitle });
  const official = eventRow.getByRole("link", { name: "Official website" });
  const details = eventRow.getByRole("link", { name: "View details" });
  await expect(official).toHaveAttribute("href", "https://events.example.test/climate-transition");
  await expect(details).toHaveAttribute("href", new RegExp(`^/esg/events/${crossMonthId}\\?back=`));
  await expect(official.locator(details)).toHaveCount(0);

  await details.click();
  await expect(page).toHaveURL(new RegExp(`/esg/events/${crossMonthId}\\?back=`));
  await expect(page.getByRole("heading", { level: 1, name: crossMonthTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: "Official website" })).toHaveAttribute(
    "href",
    "https://events.example.test/climate-transition",
  );

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toContainText("Link copied to clipboard.");

  await page.getByRole("link", { name: "Back to the event ledger" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${marker}.*country=GB.*city=London.*format=hybrid`));
});

test("has no serious accessibility violations or horizontal overflow across themes and widths", async ({ page }) => {
  test.setTimeout(180_000);
  await authenticateE2eUser(page);
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    for (const dark of [false, true]) {
      await page.goto(`/esg/events?q=${marker}`);
      await page.evaluate((enabled) => {
        document.documentElement.classList.toggle("dark", enabled);
      }, dark);
      const listing = await new AxeBuilder({ page }).include("main").analyze();
      expect(listing.violations, `${viewport.width}px ${dark ? "dark" : "light"} listing`).toEqual([]);
      const listingOverflow = await page.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= window.innerWidth + 1,
        rootWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .map((element) => ({
            element: element.tagName.toLowerCase(),
            className: element.className.toString().slice(0, 180),
            bounds: element.getBoundingClientRect().toJSON(),
          }))
          .filter((entry) => entry.bounds.right > window.innerWidth + 1 || entry.bounds.left < -1)
          .slice(0, 8),
      }));
      expect(listingOverflow.fits, JSON.stringify(listingOverflow, null, 2)).toBe(true);

      await page.goto(`/esg/events/${crossMonthId}`);
      await page.evaluate((enabled) => {
        document.documentElement.classList.toggle("dark", enabled);
      }, dark);
      const detail = await new AxeBuilder({ page }).include("main").analyze();
      expect(detail.violations, `${viewport.width}px ${dark ? "dark" : "light"} detail`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
  }
});

test("keeps the Credit Events page on its existing experience", async ({ page }) => {
  await authenticateE2eUser(page);
  await page.goto("/credit/events");
  await expect(page.getByRole("heading", { level: 1, name: "Credit Events" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The ESG Event Ledger" })).toHaveCount(0);
});
