const { test, expect } = require("@playwright/test");
const { createEvent, waitForApp, waitForPersist } = require("./helpers.cjs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
});

test("read-only mode hides edit-heavy sections across browsers", async ({ page }) => {
  await page.click("#readonly-btn");
  await expect(page.locator("#readonly-btn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#add-event")).toBeHidden();
  await expect(page.locator("#share-export-section")).toBeHidden();
  await expect(page.locator("#danger-zone-section")).toBeHidden();
});

test("json modal opens with persisted hash after creating an event", async ({ page }) => {
  const title = `CrossJson-${Date.now()}`;
  await createEvent(page, { title, allDay: true });
  await waitForPersist(page);

  await page.click("#view-json");
  await expect(page.locator("#json-modal")).toBeVisible();
  await expect(page.locator("#json-output")).toHaveValue(new RegExp(title));
  await expect(page.locator("#json-hash")).toHaveValue(/#/);
  await page.click("#json-close");
  await expect(page.locator("#json-modal")).toBeHidden();
});

test("hash-path all-day import rewrites hash and persists once across browsers", async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
  });
  const title = `CrossPath${Date.now()}`;

  await page.goto(`/#/${today.y}/${today.m}/${today.day}/${title}`);
  await waitForApp(page);

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("#/");

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#event-list .event-title", { hasText: title })).toHaveCount(1);
});
