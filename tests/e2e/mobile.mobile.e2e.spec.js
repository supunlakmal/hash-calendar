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

test("mobile copy link writes to clipboard", async ({ page }) => {
  await page.addInitScript(() => {
    window.__copiedText = "";
    const clipboard = {
      writeText: async (text) => {
        window.__copiedText = String(text || "");
      },
    };
    try {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      });
    } catch (error) {
      navigator.clipboard = clipboard;
    }
  });

  await page.goto("/");
  await waitForApp(page, { requireEventList: false });
  await createEvent(page, { title: `MobileCopy-${Date.now()}`, allDay: true, triggerSelector: "#mobile-add-event" });

  await page.click("#mobile-copy-link");

  const copiedText = await page.evaluate(() => window.__copiedText);
  expect(copiedText).toContain("#");
});

test("mobile lock and unlock flow", async ({ page }) => {
  test.setTimeout(60_000);
  const title = `MobileLock-${Date.now()}`;
  const password = "mobile-password-123";

  await createEvent(page, { title, allDay: true, triggerSelector: "#mobile-add-event" });

  await page.click("#mobile-lock-btn");
  await expect(page.locator("#password-modal")).toBeVisible();
  await page.fill("#password-input", password);
  await page.fill("#password-confirm", password);
  await page.click("#password-submit");

  await expect.poll(() => page.url()).toContain("#ENC:");

  await page.reload();
  await waitForApp(page, { requireEventList: false });
  await expect(page.locator("#locked-overlay")).toBeVisible();

  await expect(page.locator("#password-modal")).toBeVisible();
  await page.fill("#password-input", password);
  await page.click("#password-submit");

  await expect(page.locator("#locked-overlay")).toBeHidden();
  await page.click("#hamburger-btn");
  await expect(page.locator("#mobile-event-list .event-title", { hasText: title })).toBeVisible();
});

test("mobile QR code modal opens", async ({ page }) => {
  await createEvent(page, { title: `MobileQR-${Date.now()}`, allDay: true, triggerSelector: "#mobile-add-event" });

  await page.click("#mobile-share-qr");
  await expect(page.locator("#qr-modal")).toBeVisible();
  await expect(page.locator("#qrcode-container")).toBeVisible();

  await page.click("#qr-close");
  await expect(page.locator("#qr-modal")).toBeHidden();
});

test("mobile focus mode opens and closes", async ({ page }) => {
  await page.click("#mobile-focus-btn");
  await expect(page.locator("#focus-overlay")).toHaveClass(/is-active/);

  await page.keyboard.press("Escape");
  await expect(page.locator("#focus-overlay")).not.toHaveClass(/is-active/);
});
