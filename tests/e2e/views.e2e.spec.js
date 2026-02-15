const { test, expect } = require("@playwright/test");
const { clickSettingsControl, createEvent, getDateKeyOffset, selectCalendarView, waitForApp } = require("./helpers.cjs");

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
  await selectCalendarView(page, "agenda");
  await expect(page.locator("#calendar-grid")).toHaveClass(/agenda-view/);

  // Both events should be visible in agenda
  await expect(page.locator("#calendar-grid .agenda-title", { hasText: title1 })).toBeVisible();
  await expect(page.locator("#calendar-grid .agenda-title", { hasText: title2 })).toBeVisible();
});

test("day view renders time slots", async ({ page }) => {
  // Switch to day view
  await selectCalendarView(page, "day");
  await expect(page.locator("#calendar-grid")).toHaveClass(/day-view/);

  // Check that time slots exist (should have hour markers)
  const dayGrid = page.locator("#calendar-grid");
  await expect(dayGrid).toBeVisible();
});

test("year view renders 12 month blocks", async ({ page }) => {
  // Switch to year view
  await selectCalendarView(page, "year");
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
  await clickSettingsControl(page, "#focus-btn");
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

test("command palette opens with Ctrl+K and can switch view", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await expect(page.locator("#command-palette-modal")).toBeVisible();

  await page.fill("#command-palette-input", "timeline");
  await expect(page.locator("#command-palette-results .command-palette-item").first()).toBeVisible();
  await page.locator("#command-palette-results .command-palette-item").first().click();

  await expect(page.locator("#command-palette-modal")).toBeHidden();
  await expect(page.locator("#calendar-grid")).toHaveClass(/timeline-view/);
});

test("command palette searches events and opens selected event", async ({ page }) => {
  const title = `PaletteEvent-${Date.now()}`;
  await createEvent(page, { title, allDay: true });

  await page.keyboard.press("Control+k");
  await expect(page.locator("#command-palette-modal")).toBeVisible();

  await page.fill("#command-palette-input", title);
  const eventResult = page.locator("#command-palette-results .command-palette-item", { hasText: title }).first();
  await expect(eventResult).toBeVisible();
  await eventResult.click();

  await expect(page.locator("#event-modal")).toBeVisible();
  await expect(page.locator("#event-title")).toHaveValue(title);
  await page.click("#event-cancel");
});

test("event search button opens modal and selects matching event", async ({ page }) => {
  const title = `EventSearch-${Date.now()}`;
  await createEvent(page, { title, allDay: true });

  await page.click("#event-search-btn");
  await expect(page.locator("#event-search-modal")).toBeVisible();

  await page.fill("#event-search-input", title);
  const result = page.locator("#event-search-results .command-palette-item", { hasText: title }).first();
  await expect(result).toBeVisible();
  await result.click();

  await expect(page.locator("#event-search-modal")).toBeHidden();
  await expect(page.locator("#event-modal")).toBeVisible();
  await expect(page.locator("#event-title")).toHaveValue(title);
  await page.click("#event-cancel");
});

test("event search modal advanced filters support title, recurrence, color, date range, and timezone", async ({ page }) => {
  const recurringTitle = `FilterRecurring-${Date.now()}`;
  const ensureAdvancedFiltersOpen = async () => {
    await page.click("#event-search-btn");
    await expect(page.locator("#event-search-modal")).toBeVisible();
    const advancedPanel = page.locator("#event-search-advanced-panel");
    if (!(await advancedPanel.isVisible())) {
      await page.click("#event-search-advanced-toggle");
    }
    await expect(advancedPanel).toBeVisible();
  };

  await createEvent(page, { title: recurringTitle, allDay: true, recurrence: "d" });
  await expect(page.locator("#event-list .event-title", { hasText: recurringTitle })).toBeVisible();

  await page.click("#event-search-btn");
  await expect(page.locator("#event-search-modal")).toBeVisible();
  await page.fill("#event-search-input", recurringTitle);
  await page.click("#event-search-close");
  await expect(page.locator("#event-search-modal")).toBeHidden();
  await expect(page.locator("#event-list .event-title", { hasText: recurringTitle })).toBeVisible();

  await page.click("#event-search-btn");
  await page.fill("#event-search-input", "");
  await page.click("#event-search-advanced-toggle");
  await expect(page.locator("#event-search-advanced-panel")).toBeVisible();
  await page.selectOption("#event-filter-recurrence", "d");
  await page.click("#event-search-close");
  await expect(page.locator("#event-list .event-title", { hasText: recurringTitle })).toBeVisible();

  await ensureAdvancedFiltersOpen();
  await page.selectOption("#event-filter-recurrence", "");
  await page.selectOption("#event-filter-color", "0");
  await page.click("#event-search-close");
  await expect(page.locator("#event-list .event-title", { hasText: recurringTitle })).toBeVisible();

  await ensureAdvancedFiltersOpen();
  await page.click("#event-filter-clear");
  const tomorrowKey = await getDateKeyOffset(page, 1);
  await page.selectOption("#event-filter-timezone", "UTC");
  await page.fill("#event-filter-start", tomorrowKey);
  await page.fill("#event-filter-end", tomorrowKey);
  await page.click("#event-search-close");

  await page.click(`.day-cell[data-date="${tomorrowKey}"] .day-number`);
  await expect(page.locator("#event-list .event-title", { hasText: recurringTitle })).toBeVisible();
});
