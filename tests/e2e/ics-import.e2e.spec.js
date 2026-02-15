const { test, expect } = require("@playwright/test");
const { getDateKeyOffset, waitForApp } = require("./helpers.cjs");

function toYmdCompact(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
});

test("ics weekly RRULE imports and recurs 7 days later", async ({ page }) => {
  const title = `ICSWeekly-${Date.now()}`;
  const today = new Date();
  const tomorrow = new Date(today.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    `DTSTART;VALUE=DATE:${toYmdCompact(today)}`,
    `DTEND;VALUE=DATE:${toYmdCompact(tomorrow)}`,
    "RRULE:FREQ=WEEKLY",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\n");

  await page.setInputFiles("#ics-input", {
    name: "weekly.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(ics),
  });

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();

  const weekLater = await getDateKeyOffset(page, 7);
  await page.click(`.day-cell[data-date="${weekLater}"] .day-number`);
  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
});

test("ics timed UTC event preserves start and end times", async ({ page }) => {
  const title = `ICSTimed-${Date.now()}`;
  const now = new Date();
  const ymd = toYmdCompact(now);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    `DTSTART:${ymd}T100000Z`,
    `DTEND:${ymd}T113000Z`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\n");

  await page.setInputFiles("#ics-input", {
    name: "timed.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(ics),
  });

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();

  await page.locator("#event-list .event-item", { hasText: title }).first().click();
  await expect(page.locator("#event-modal")).toBeVisible();
  await expect(page.locator("#event-all-day")).not.toBeChecked();
  await expect(page.locator("#event-time")).toHaveValue("10:00");
  await expect(page.locator("#event-end-time")).toHaveValue("11:30");
  await page.click("#event-cancel");
});

test("ics import with no valid events shows an error toast and keeps calendar unchanged", async ({ page }) => {
  const invalidIcs = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//No Events//EN",
    "END:VCALENDAR",
    "",
  ].join("\n");

  await page.setInputFiles("#ics-input", {
    name: "invalid.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(invalidIcs),
  });

  await expect(page.locator(".toast", { hasText: /No events found/i })).toBeVisible();
  await expect(page.locator("#event-list .event-title")).toHaveCount(0);
});
