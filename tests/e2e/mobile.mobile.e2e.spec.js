const { test, expect } = require("@playwright/test");
const { waitForApp, createEvent, waitForPersist } = require("./helpers.cjs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page, { requireEventList: false });
});

test("mobile drawer opens and switches calendar view", async ({ page }) => {
  await page.click("#hamburger-btn");
  await expect(page.locator("#mobile-drawer")).toHaveClass(/is-active/);

  await page.click('#mobile-drawer [data-view="week"]');
  await expect(page.locator("#mobile-drawer")).not.toHaveClass(/is-active/);
  await expect(page.locator("#calendar-grid")).toHaveClass(/week-view/);
});

test("mobile quick add event flow works", async ({ page }) => {
  const title = `Mobile-${Date.now()}`;

  await page.click("#mobile-add-event");
  await expect(page.locator("#event-modal")).toBeVisible();
  await page.fill("#event-title", title);
  await page.check("#event-all-day");
  await page.click("#event-save");

  await page.click("#hamburger-btn");
  await expect(page.locator("#mobile-drawer")).toHaveClass(/is-active/);
  await expect(page.locator("#mobile-event-list .event-title", { hasText: title })).toBeVisible();
});

test("mobile drawer opens template and json modals", async ({ page }) => {
  await page.click("#hamburger-btn");
  await page.click("#mobile-open-template-gallery");
  await expect(page.locator("#template-modal")).toBeVisible();
  await page.click("#template-close");
  await expect(page.locator("#template-modal")).toBeHidden();

  await page.click("#hamburger-btn");
  await page.click("#mobile-view-json");
  await expect(page.locator("#json-modal")).toBeVisible();
  await page.click("#json-close");
  await expect(page.locator("#json-modal")).toBeHidden();
});

test("mobile read-only toggle hides quick add and persists", async ({ page }) => {
  await createEvent(page, { title: `MobileSeed-${Date.now()}`, allDay: true, triggerSelector: "#mobile-add-event" });

  await page.click("#hamburger-btn");
  await page.click("#mobile-readonly-btn");

  await expect(page.locator("#mobile-add-event")).toBeHidden();
  await waitForPersist(page);

  await page.reload();
  await waitForApp(page, { requireEventList: false });
  await expect(page.locator("#mobile-add-event")).toBeHidden();
});

test("mobile drawer opens world planner", async ({ page }) => {
  await page.click("#hamburger-btn");
  await page.click("#mobile-world-planner-btn");
  await expect(page.locator("#world-planner-modal")).toBeVisible();
  await page.click("#wp-close");
  await expect(page.locator("#world-planner-modal")).toBeHidden();
});
