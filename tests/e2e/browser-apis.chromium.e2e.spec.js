const { test, expect } = require("@playwright/test");
const { waitForApp, createEvent } = require("./helpers.cjs");

test("copy link writes to clipboard API", async ({ page }) => {
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
  await waitForApp(page);
  await createEvent(page, { title: `Clipboard-${Date.now()}`, allDay: true });

  await page.click("#copy-link");

  await expect.poll(() => page.evaluate(() => window.__copiedText)).toContain("#");
});

test("notification toggle requests permission and flips state", async ({ page }) => {
  await page.addInitScript(() => {
    window.__notifyRequestCount = 0;

    function MockNotification() {
      this.close = () => {};
      this.onclick = null;
    }

    MockNotification.permission = "default";
    MockNotification.requestPermission = async () => {
      window.__notifyRequestCount += 1;
      MockNotification.permission = "granted";
      return "granted";
    };

    window.Notification = MockNotification;
  });

  await page.goto("/");
  await waitForApp(page);
  await createEvent(page, { title: `Notify-${Date.now()}`, allDay: true });

  await page.click("#notify-toggle");
  await expect(page.locator("#notify-toggle")).toContainText(/On/i);
  await expect.poll(() => page.evaluate(() => window.__notifyRequestCount)).toBe(1);

  await page.click("#notify-toggle");
  await expect(page.locator("#notify-toggle")).toContainText(/Off/i);
  await expect.poll(() => page.evaluate(() => window.__notifyRequestCount)).toBe(1);
});
