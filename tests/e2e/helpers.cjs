const { expect } = require("@playwright/test");

async function waitForApp(page, { requireEventList = true } = {}) {
  await expect(page.locator("#calendar-grid")).toBeVisible();
  if (requireEventList) {
    await expect(page.locator("#event-list")).toBeVisible();
  }
}

async function waitForPersist(page, ms = 800) {
  await page.waitForTimeout(ms);
}

async function getDateKeyOffset(page, offsetDays = 0) {
  return page.evaluate((offset) => {
    const target = new Date();
    target.setDate(target.getDate() + offset);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, offsetDays);
}

async function createEvent(
  page,
  {
    title,
    allDay = true,
    recurrence = "",
    dateKey = null,
    startTime = "09:00",
    endTime = "10:00",
    triggerSelector = "#add-event",
  } = {}
) {
  await page.click(triggerSelector);
  await expect(page.locator("#event-modal")).toBeVisible();

  if (title) {
    await page.fill("#event-title", title);
  }

  if (dateKey) {
    await page.fill("#event-date", dateKey);
    await page.fill("#event-end-date", dateKey);
  }

  if (allDay) {
    await page.check("#event-all-day");
  } else {
    await page.uncheck("#event-all-day");
    await page.fill("#event-time", startTime);
    await page.fill("#event-end-time", endTime);
  }

  if (recurrence) {
    await page.selectOption("#event-recurrence", recurrence);
  }

  await page.click("#event-save");
  await expect(page.locator("#event-modal")).toBeHidden();

  if (title) {
    await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
  }
}

module.exports = {
  createEvent,
  getDateKeyOffset,
  waitForApp,
  waitForPersist,
};
