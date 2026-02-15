const { test, expect } = require("@playwright/test");
const { waitForApp, createEvent } = require("./helpers.cjs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page, { requireEventList: false });
});

test("core app shell renders and navigation works", async ({ page }) => {
  await expect(page.locator("#month-label")).toBeVisible();
  const before = (await page.locator("#month-label").innerText()).trim();

  await page.click("#next-month");
  const after = (await page.locator("#month-label").innerText()).trim();
  expect(after).not.toBe(before);

  await page.click("#today-btn");
  await expect(page.locator("#calendar-grid")).toHaveClass(/month-view/);
});

test("can create a basic all-day event", async ({ page }) => {
  const title = `Smoke-${Date.now()}`;
  await createEvent(page, { title, allDay: true });
  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
});
