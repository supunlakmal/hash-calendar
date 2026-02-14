const { expect } = require("@playwright/test");

async function waitForApp(page, { requireEventList = true } = {}) {
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "1");
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

async function ensureDetailsMenuOpen(page, detailsSelector) {
  const details = page.locator(detailsSelector).first();
  await expect(details).toBeVisible();
  const isOpen = await details.evaluate((element) => element.hasAttribute("open"));
  if (isOpen) return;
  await details.locator("summary").click();
}

async function openViewMenu(page) {
  await ensureDetailsMenuOpen(page, "#view-menu");
  await expect(page.locator("#view-menu .view-menu-panel")).toBeVisible();
}

async function openSettingsMenu(page) {
  await ensureDetailsMenuOpen(page, ".settings-menu");
  await expect(page.locator(".settings-menu .settings-menu-panel")).toBeVisible();
}

async function selectCalendarView(page, view) {
  const visibleViewButton = page.locator(`button[data-view="${view}"]:visible`).first();
  if ((await visibleViewButton.count()) > 0) {
    await visibleViewButton.click();
    return;
  }

  if ((await page.locator("#view-menu").count()) === 0) {
    throw new Error(`No visible view button or view menu found for view "${view}"`);
  }

  await openViewMenu(page);
  await page.click(`.view-menu-option[data-view="${view}"]`);
}

async function clickSettingsControl(page, selector) {
  const visibleControl = page.locator(`${selector}:visible`).first();
  if ((await visibleControl.count()) > 0) {
    await visibleControl.click();
    return;
  }

  if ((await page.locator(".settings-menu").count()) === 0) {
    throw new Error(`Settings menu is unavailable for selector "${selector}"`);
  }

  await openSettingsMenu(page);
  await expect(page.locator(selector)).toBeVisible();
  await page.click(selector);
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
  clickSettingsControl,
  createEvent,
  getDateKeyOffset,
  openSettingsMenu,
  openViewMenu,
  selectCalendarView,
  waitForApp,
  waitForPersist,
};
