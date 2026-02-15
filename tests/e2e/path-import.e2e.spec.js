const { test, expect } = require("@playwright/test");
const { waitForApp } = require("./helpers.cjs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
});

test("hash-path all-day pattern imports and rewrites dashes in title", async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
  });

  const slugTitle = `All-Day-Path-${Date.now()}`;
  const expectedTitle = slugTitle.replace(/-/g, " ");

  await page.goto(`/#/${today.y}/${today.m}/${today.day}/${slugTitle}`);
  await waitForApp(page);

  await expect(page.locator("#event-list .event-title", { hasText: expectedTitle })).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("#/");
});

test("hash-path timed pattern with +minutes sets the correct duration", async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
  });

  const title = `PathDuration${Date.now()}`;
  await page.goto(`/#/${today.y}/${today.m}/${today.day}/10/00+90/${title}`);
  await waitForApp(page);

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();

  await page.locator("#event-list .event-item").first().click();
  await expect(page.locator("#event-modal")).toBeVisible();
  await expect(page.locator("#event-all-day")).not.toBeChecked();
  await expect(page.locator("#event-time")).toHaveValue("10:00");
  await expect(page.locator("#event-end-time")).toHaveValue("11:30");
  await page.click("#event-cancel");
});

test("hash-path supports multi-event links and imports once", async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
  });

  const titleA = `PathMultiA${Date.now()}`;
  const titleB = `PathMultiB${Date.now() + 1}`;
  const path = `/#/${today.y}/${today.m}/${today.day}/${titleA},${today.y}/${today.m}/${today.day}/10/15/${titleB}`;

  await page.goto(path);
  await waitForApp(page);

  await expect(page.locator("#event-list .event-title", { hasText: titleA })).toBeVisible();
  await expect(page.locator("#event-list .event-title", { hasText: titleB })).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("#/");

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#event-list .event-title", { hasText: titleA })).toHaveCount(1);
  await expect(page.locator("#event-list .event-title", { hasText: titleB })).toHaveCount(1);
});

test("hash-path falls back to default title when title is missing", async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
  });

  await page.goto(`/#/${today.y}/${today.m}/${today.day}`);
  await waitForApp(page);

  await expect(page.locator("#event-list .event-title", { hasText: "New Event (URL)" })).toBeVisible();
});
