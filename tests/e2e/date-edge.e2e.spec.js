const { test, expect } = require("@playwright/test");
const { waitForApp } = require("./helpers.cjs");

function formatDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function findNextMonthEndPair(from = new Date()) {
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = 0; i < 24; i += 1) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInNextMonth = new Date(year, month + 2, 0).getDate();
    if (daysInMonth === 31 && daysInNextMonth < 31) {
      return {
        baseKey: formatDateKey(new Date(year, month, 31)),
        targetKey: formatDateKey(new Date(year, month + 1, daysInNextMonth)),
      };
    }
    cursor.setMonth(month + 1, 1);
  }
  throw new Error("Could not find month-end fallback test window");
}

function findNextLeapYear(year) {
  let y = year;
  while (!(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) {
    y += 1;
  }
  return y;
}

async function navigateFromCurrentMonth(page, targetKey) {
  const diff = await page.evaluate((key) => {
    const [year, month] = String(key).split("-").map(Number);
    const now = new Date();
    const nowTotal = now.getFullYear() * 12 + now.getMonth();
    const targetTotal = year * 12 + (month - 1);
    return targetTotal - nowTotal;
  }, targetKey);
  if (diff > 0) {
    for (let i = 0; i < diff; i += 1) {
      await page.click("#next-month");
    }
  } else if (diff < 0) {
    for (let i = 0; i < Math.abs(diff); i += 1) {
      await page.click("#prev-month");
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
});

async function createRecurringAllDayEvent(page, { title, dateKey, recurrence }) {
  await page.click("#add-event");
  await expect(page.locator("#event-modal")).toBeVisible();
  await page.fill("#event-title", title);
  await page.fill("#event-date", dateKey);
  await page.check("#event-all-day");
  await page.selectOption("#event-recurrence", recurrence);
  await page.click("#event-save");
  await expect(page.locator("#event-modal")).toBeHidden();
}

test("cross-day timed event appears on both start and end dates", async ({ page }) => {
  const title = `CrossDay-${Date.now()}`;
  const dates = await page.evaluate(() => {
    const format = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    const today = new Date();
    const tomorrow = new Date(today.getTime());
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { todayKey: format(today), tomorrowKey: format(tomorrow) };
  });

  await page.click("#add-event");
  await expect(page.locator("#event-modal")).toBeVisible();
  await page.fill("#event-title", title);
  await page.uncheck("#event-all-day");
  await page.fill("#event-date", dates.todayKey);
  await page.fill("#event-time", "23:30");
  await page.fill("#event-end-date", dates.tomorrowKey);
  await page.fill("#event-end-time", "01:15");
  await page.click("#event-save");
  await expect(page.locator("#event-modal")).toBeHidden();

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();

  await page.click(`.day-cell[data-date="${dates.tomorrowKey}"] .day-number`);
  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();

  await page.locator("#event-list .event-item", { hasText: title }).first().click();
  await expect(page.locator("#event-date")).toHaveValue(dates.todayKey);
  await expect(page.locator("#event-end-date")).toHaveValue(dates.tomorrowKey);
  await expect(page.locator("#event-time")).toHaveValue("23:30");
  await expect(page.locator("#event-end-time")).toHaveValue("01:15");
  await page.click("#event-cancel");
});

test("monthly recurrence from day 31 falls back to next month end", async ({ page }) => {
  const title = `MonthEdge-${Date.now()}`;
  const { baseKey, targetKey } = findNextMonthEndPair(new Date());

  await createRecurringAllDayEvent(page, {
    title,
    dateKey: baseKey,
    recurrence: "m",
  });

  await navigateFromCurrentMonth(page, targetKey);
  await page.click(`.day-cell[data-date="${targetKey}"] .day-number`);
  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
});

test("yearly recurrence from leap day falls back to Feb 28 on non-leap year", async ({ page }) => {
  const title = `LeapEdge-${Date.now()}`;
  const leapYear = findNextLeapYear(new Date().getFullYear());
  const baseKey = `${leapYear}-02-29`;
  const targetKey = `${leapYear + 1}-02-28`;

  await createRecurringAllDayEvent(page, {
    title,
    dateKey: baseKey,
    recurrence: "y",
  });

  await navigateFromCurrentMonth(page, targetKey);
  await page.click(`.day-cell[data-date="${targetKey}"] .day-number`);
  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
});
