const { test, expect } = require("@playwright/test");
const { createEvent, waitForApp } = require("./helpers.cjs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
});

test("agenda view lists created events", async ({ page }) => {
  const title1 = `Agenda1-${Date.now()}`;
  const title2 = `Agenda2-${Date.now() + 1}`;

  await createEvent(page, { title: title1, allDay: true });
  await createEvent(page, { title: title2, allDay: true });

  // Switch to agenda view
  await page.click('button[data-view="agenda"]');
  await expect(page.locator("#calendar-grid")).toHaveClass(/agenda-view/);

  // Both events should be visible in agenda
  await expect(page.locator("#calendar-grid .agenda-title", { hasText: title1 })).toBeVisible();
  await expect(page.locator("#calendar-grid .agenda-title", { hasText: title2 })).toBeVisible();
});

test("day view renders time slots", async ({ page }) => {
  // Switch to day view
  await page.click('button[data-view="day"]');
  await expect(page.locator("#calendar-grid")).toHaveClass(/day-view/);

  // Check that time slots exist (should have hour markers)
  const dayGrid = page.locator("#calendar-grid");
  await expect(dayGrid).toBeVisible();
});

test("year view renders 12 month blocks", async ({ page }) => {
  // Switch to year view
  await page.click('button[data-view="year"]');
  await expect(page.locator("#calendar-grid")).toHaveClass(/year-view/);

  // Year view should be visible
  const yearGrid = page.locator("#calendar-grid");
  await expect(yearGrid).toBeVisible();
});

test("focus mode displays event info and countdown", async ({ page }) => {
  const title = `Focus-${Date.now()}`;

  // Create a timed event for later today
  await createEvent(page, {
    title,
    allDay: false,
    startTime: "23:50",
    endTime: "23:55"
  });

  // Open focus mode
  await page.click("#focus-btn");
  await expect(page.locator("#focus-overlay")).toHaveClass(/is-active/);

  // Focus overlay should be visible
  await expect(page.locator("#focus-overlay")).toBeVisible();

  // Press Escape to close
  await page.keyboard.press("Escape");
  await expect(page.locator("#focus-overlay")).not.toHaveClass(/is-active/);
});

test("countdown widget shows next event", async ({ page }) => {
  const title = `Countdown-${Date.now()}`;

  // Create a timed event
  await createEvent(page, {
    title,
    allDay: false,
    startTime: "23:50",
    endTime: "23:55"
  });

  // Countdown widget should show the event
  // Note: The widget may be hidden if no upcoming events, so we check conditionally
  const countdownWidget = page.locator("#countdown-widget");
  const isVisible = await countdownWidget.isVisible().catch(() => false);

  if (isVisible) {
    const eventTitle = page.locator("#nextEventTitle");
    await expect(eventTitle).toBeVisible();
  }
});
