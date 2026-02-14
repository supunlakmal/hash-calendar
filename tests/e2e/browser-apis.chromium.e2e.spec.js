const { test, expect } = require("@playwright/test");
const { waitForApp, createEvent, waitForPersist } = require("./helpers.cjs");

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

test("copy hash from JSON modal writes to clipboard", async ({ page }) => {
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
  await createEvent(page, { title: `HashCopy-${Date.now()}`, allDay: true });
  await waitForPersist(page);

  await page.click("#view-json");
  await expect(page.locator("#json-modal")).toBeVisible();

  await page.click("#json-copy-hash");

  await expect.poll(() => page.evaluate(() => window.__copiedText)).toContain("#");

  await page.click("#json-close");
});

test("copy JSON from JSON modal writes to clipboard", async ({ page }) => {
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
  const title = `JSONCopy-${Date.now()}`;
  await createEvent(page, { title, allDay: true });

  await page.click("#view-json");
  await expect(page.locator("#json-modal")).toBeVisible();

  await page.click("#json-copy");

  const copiedText = await page.evaluate(() => window.__copiedText);
  expect(copiedText).toContain(title);

  await page.click("#json-close");
});

test("export JSON triggers file download", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
  await createEvent(page, { title: `Export-${Date.now()}`, allDay: true });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#export-json"),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.json$/);
});
