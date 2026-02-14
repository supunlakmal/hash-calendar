const { test, expect } = require("@playwright/test");
const { createEvent, getDateKeyOffset, waitForApp, waitForPersist } = require("./helpers.cjs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
});

test("creates an event and restores it after reload", async ({ page }) => {
  const title = `E2E-${Date.now()}`;

  await createEvent(page, { title, allDay: true });
  await expect(page).toHaveURL(/#.+/);

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
});

test("edits and deletes an event", async ({ page }) => {
  const title = `EditMe-${Date.now()}`;
  const updated = `${title}-Updated`;

  await createEvent(page, { title, allDay: true });

  await page.locator("#event-list .event-item").first().click();
  await expect(page.locator("#event-modal")).toBeVisible();
  await expect(page.locator("#event-delete")).toBeVisible();

  await page.fill("#event-title", updated);
  await page.click("#event-save");
  await expect(page.locator("#event-list .event-title", { hasText: updated })).toBeVisible();

  await page.locator("#event-list .event-item").first().click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#event-delete");

  await expect(page.locator("#event-list .event-title", { hasText: updated })).toHaveCount(0);
});

test("clear calendar removes all events", async ({ page }) => {
  await createEvent(page, { title: `A-${Date.now()}`, allDay: true });
  await createEvent(page, { title: `B-${Date.now()}`, allDay: true });
  await expect(page.locator("#event-list .event-title")).toHaveCount(2);

  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#clear-all");

  await expect(page.locator("#event-list .event-title")).toHaveCount(0);
});

test("daily recurring event appears on the next day", async ({ page }) => {
  const title = `Recurring-${Date.now()}`;

  await createEvent(page, { title, allDay: true, recurrence: "d" });

  const tomorrowKey = await getDateKeyOffset(page, 1);
  await page.click(`.day-cell[data-date="${tomorrowKey}"]`);

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
});

test("read-only mode hides edit controls and persists", async ({ page }) => {
  await page.click("#readonly-btn");
  await expect(page.locator("#readonly-btn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#add-event")).toBeHidden();
  await expect(page.locator("#share-export-section")).toBeHidden();
  await expect(page.locator("#danger-zone-section")).toBeHidden();

  await waitForPersist(page);
  await page.reload();
  await waitForApp(page);

  await expect(page.locator("#readonly-btn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#add-event")).toBeHidden();
});

test("theme toggle persists after reload", async ({ page }) => {
  await createEvent(page, { title: `ThemeSeed-${Date.now()}`, allDay: true });
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");

  await page.click("#theme-toggle");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");

  await waitForPersist(page);
  await page.reload();
  await waitForApp(page);
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
});

test("week start setting persists after reload", async ({ page }) => {
  await createEvent(page, { title: `WeekSeed-${Date.now()}`, allDay: true });
  await page.click("#weekstart-toggle");
  await expect(page.locator("#weekstart-toggle")).toContainText(/Monday/i);

  await waitForPersist(page);
  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#weekstart-toggle")).toContainText(/Monday/i);
});

test("language selection persists after reload", async ({ page }) => {
  await createEvent(page, { title: `LangSeed-${Date.now()}`, allDay: true });
  await page.click("#language-btn");
  await page.click('#language-list .dropdown-item[data-lang="it"]');

  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(page.locator("body")).toHaveAttribute("lang", "it");

  await waitForPersist(page);
  await page.reload();
  await waitForApp(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
});

test("view switching and timeline controls work", async ({ page }) => {
  const grid = page.locator("#calendar-grid");

  await page.click('.view-toggle button[data-view="week"]');
  await expect(grid).toHaveClass(/week-view/);

  await page.click('.view-toggle button[data-view="day"]');
  await expect(grid).toHaveClass(/day-view/);

  await page.click('.view-toggle button[data-view="agenda"]');
  await expect(grid).toHaveClass(/agenda-view/);

  await page.click('.view-toggle button[data-view="year"]');
  await expect(grid).toHaveClass(/year-view/);

  await page.click('.view-toggle button[data-view="timeline"]');
  await expect(grid).toHaveClass(/timeline-view/);
  await expect(page.locator("#timeline-controls")).toBeVisible();

  const beforeZoom = (await page.locator("#timeline-zoom-value").innerText()).trim();
  await page.click("#timeline-zoom-in");
  await expect.poll(async () => (await page.locator("#timeline-zoom-value").innerText()).trim()).not.toBe(beforeZoom);

  await page.click('.view-toggle button[data-view="month"]');
  await expect(grid).toHaveClass(/month-view/);
  await expect(page.locator("#timeline-controls")).toBeHidden();
});

test("focus mode opens and closes with Escape", async ({ page }) => {
  await page.click("#focus-btn");
  await expect(page.locator("#focus-overlay")).toHaveClass(/is-active/);
  await expect(page.locator("#focus-overlay")).toHaveAttribute("aria-hidden", "false");

  await page.keyboard.press("Escape");
  await expect(page.locator("#focus-overlay")).not.toHaveClass(/is-active/);
  await expect(page.locator("#focus-overlay")).toHaveAttribute("aria-hidden", "true");
});

test("timezone modal can add and remove a timezone", async ({ page }) => {
  await page.click("#add-tz-btn");
  await page.fill("#tz-search", "london");

  let option = page.locator('#tz-results button[data-zone="Europe/London"]');
  if ((await option.count()) === 0) {
    option = page.locator("#tz-results button", { hasText: /London/i }).first();
  }

  await expect(option).toBeVisible();
  const zone = await option.getAttribute("data-zone");
  await option.click();

  await expect(page.locator("#tz-list")).toContainText(/London/i);

  if (zone) {
    const removeButton = page.locator(`#tz-list button[data-zone="${zone}"]`);
    await expect(removeButton).toBeVisible();
    await removeButton.click();
    await expect(removeButton).toHaveCount(0);
  } else {
    const removeFallback = page.locator("#tz-list .tz-remove").first();
    await removeFallback.click();
    await expect(page.locator("#tz-list")).not.toContainText(/London/i);
  }
});

test("world planner supports zone add/remove and time format toggle", async ({ page }) => {
  await page.click("#world-planner-btn");
  await expect(page.locator("#world-planner-modal")).toBeVisible();
  await expect.poll(async () => await page.locator("#wp-grid .wp-row-header").count()).toBeGreaterThan(0);

  await page.fill("#wp-add-zone", "tokyo");
  const tokyoOption = page.locator("#wp-tz-results button", { hasText: /Tokyo/i }).first();
  await expect(tokyoOption).toBeVisible();
  await tokyoOption.click();

  await expect(page.locator("#wp-grid")).toContainText(/Tokyo/i);

  await page.click("#wp-format-toggle");
  await expect(page.locator("#wp-format-toggle")).toHaveText("24h");

  const tokyoRow = page.locator('#wp-grid .wp-row-header:has(.wp-city-name:has-text("Tokyo"))').first();
  await tokyoRow.hover();
  const removeButton = tokyoRow.locator('.wp-control-btn[data-action="remove"]');
  await removeButton.click();
  await expect(page.locator("#wp-grid .wp-city-name", { hasText: /Tokyo/i })).toHaveCount(0);

  await page.click("#wp-close");
  await expect(page.locator("#world-planner-modal")).toBeHidden();
});

test("template gallery loads cards", async ({ page }) => {
  await page.click("#open-template-gallery");
  await expect(page.locator("#template-modal")).toBeVisible();

  await expect.poll(async () => await page.locator("#template-links .template-card").count()).toBeGreaterThan(0);

  await page.click("#template-close");
  await expect(page.locator("#template-modal")).toBeHidden();
});

test("json modal displays serialized state and hash", async ({ page }) => {
  const title = `Json-${Date.now()}`;
  await createEvent(page, { title, allDay: true });
  await waitForPersist(page);

  await page.click("#view-json");
  await expect(page.locator("#json-modal")).toBeVisible();

  const json = await page.locator("#json-output").inputValue();
  const hash = await page.locator("#json-hash").inputValue();

  expect(json).toContain(title);
  expect(hash.startsWith("#")).toBeTruthy();

  await page.click("#json-close");
  await expect(page.locator("#json-modal")).toBeHidden();
});

test("lock and unlock flow restores encrypted calendar data", async ({ page }) => {
  test.setTimeout(60_000);
  const title = `Locked-${Date.now()}`;
  const password = "e2e-password-123";

  await createEvent(page, { title, allDay: true });

  await page.click("#lock-btn");
  await expect(page.locator("#password-modal")).toBeVisible();
  await page.fill("#password-input", password);
  await page.fill("#password-confirm", password);
  await page.click("#password-submit");

  await expect.poll(() => page.url()).toContain("#ENC:");

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#locked-overlay")).toBeVisible();

  await expect(page.locator("#password-modal")).toBeVisible();
  await page.fill("#password-input", password);
  await page.click("#password-submit");

  await expect(page.locator("#locked-overlay")).toBeHidden();
  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
});

test("imports events from .ics file", async ({ page }) => {
  const title = `ICS-${Date.now()}`;
  const dates = await page.evaluate(() => {
    const toYmd = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}${mm}${dd}`;
    };

    const start = new Date();
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + 1);

    return { start: toYmd(start), end: toYmd(end) };
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    `DTSTART;VALUE=DATE:${dates.start}`,
    `DTEND;VALUE=DATE:${dates.end}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\n");

  await page.setInputFiles("#ics-input", {
    name: "import.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(ics),
  });

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
});

test("imports a hash-path event once and rewrites the hash", async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  });
  const title = `PathEvent${Date.now()}`;

  await page.goto(`/#/${today.year}/${today.month}/${today.day}/10/30/${title}`);
  await waitForApp(page);

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("#/");

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#event-list .event-title", { hasText: title })).toHaveCount(1);
});

test("app launcher modal opens and closes", async ({ page }) => {
  await page.click("#app-launcher-btn");
  await expect(page.locator("#app-launcher-modal")).toBeVisible();
  await expect(page.locator("#app-launcher-iframe")).toHaveAttribute("src", /open-edit\.netlify\.app/);

  await page.click("#app-launcher-close");
  await expect(page.locator("#app-launcher-modal")).toBeHidden();
});
