const { test, expect } = require("@playwright/test");
const { createEvent, waitForApp } = require("./helpers.cjs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForApp(page, { requireEventList: false });
});

test("wrong password keeps encrypted calendar locked", async ({ page }) => {
  const title = `LockedWrongPw-${Date.now()}`;
  const password = "correct-password-123";

  await createEvent(page, { title, allDay: true });

  await page.click("#lock-btn");
  await expect(page.locator("#password-modal")).toBeVisible();
  await page.fill("#password-input", password);
  await page.fill("#password-confirm", password);
  await page.click("#password-submit");

  await expect.poll(() => page.url()).toContain("#ENC:");

  await page.reload();
  await waitForApp(page, { requireEventList: false });
  await expect(page.locator("#locked-overlay")).toBeVisible();
  await expect(page.locator("#password-modal")).toBeVisible();

  await page.fill("#password-input", "wrong-password");
  await page.click("#password-submit");

  await expect(page.locator("#locked-overlay")).toBeVisible();
  await expect(page.locator(".toast", { hasText: /Incorrect password/i })).toBeVisible();
  await expect(page.locator("#event-list .event-title", { hasText: title })).toHaveCount(0);
});

test("malformed encrypted hash stays locked and fails unlock gracefully", async ({ page }) => {
  await page.goto("/#ENC:not-a-valid-encrypted-payload");
  await waitForApp(page, { requireEventList: false });

  await expect(page.locator("#locked-overlay")).toBeVisible();
  if (!(await page.locator("#password-modal").isVisible())) {
    await page.click("#lock-btn");
  }
  await expect(page.locator("#password-modal")).toBeVisible();

  await page.fill("#password-input", "any-password");
  await page.click("#password-submit");

  await expect(page.locator("#locked-overlay")).toBeVisible();
  await expect(page.locator(".toast", { hasText: /Incorrect password/i })).toBeVisible();
});
