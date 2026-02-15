const { test, expect } = require("@playwright/test");
const { clickSettingsControl, waitForApp, createEvent, waitForPersist } = require("./helpers.cjs");

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

  await clickSettingsControl(page, "#notify-toggle");
  await expect(page.locator("#notify-toggle")).toContainText(/On/i);
  await expect.poll(() => page.evaluate(() => window.__notifyRequestCount)).toBe(1);

  await clickSettingsControl(page, "#notify-toggle");
  await expect(page.locator("#notify-toggle")).toContainText(/Off/i);
  await expect.poll(() => page.evaluate(() => window.__notifyRequestCount)).toBe(1);
});

test("notification toggle handles denied permission without requesting again", async ({ page }) => {
  await page.addInitScript(() => {
    window.__notifyRequestCount = 0;

    function MockNotification() {
      this.close = () => {};
      this.onclick = null;
    }

    MockNotification.permission = "denied";
    MockNotification.requestPermission = async () => {
      window.__notifyRequestCount += 1;
      return "denied";
    };

    window.Notification = MockNotification;
  });

  await page.goto("/");
  await waitForApp(page);
  await createEvent(page, { title: `NotifyDenied-${Date.now()}`, allDay: true });

  await clickSettingsControl(page, "#notify-toggle");
  await expect(page.locator("#notify-toggle")).toContainText(/Blocked/i);
  await expect.poll(() => page.evaluate(() => window.__notifyRequestCount)).toBe(0);
});

test("enabling notifications triggers an upcoming event notification when event is 30 minutes away", async ({ page }) => {
  await page.addInitScript(() => {
    window.__notifications = [];

    function MockNotification(title, options = {}) {
      window.__notifications.push({
        title: String(title || ""),
        body: String(options.body || ""),
        tag: String(options.tag || ""),
      });
      this.close = () => {};
      this.onclick = null;
    }

    MockNotification.permission = "granted";
    MockNotification.requestPermission = async () => "granted";
    window.Notification = MockNotification;
  });

  await page.goto("/");
  await waitForApp(page);

  const title = `NotifySoon-${Date.now()}`;
  const timing = await page.evaluate(() => {
    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    const formatTime = (d) => {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    };

    const start = new Date(Date.now() + 30 * 60 * 1000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    return {
      startDate: formatDate(start),
      startTime: formatTime(start),
      endDate: formatDate(end),
      endTime: formatTime(end),
    };
  });

  await page.click("#add-event");
  await expect(page.locator("#event-modal")).toBeVisible();
  await page.fill("#event-title", title);
  await page.uncheck("#event-all-day");
  await page.fill("#event-date", timing.startDate);
  await page.fill("#event-time", timing.startTime);
  await page.fill("#event-end-date", timing.endDate);
  await page.fill("#event-end-time", timing.endTime);
  await page.click("#event-save");

  await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();

  await clickSettingsControl(page, "#notify-toggle");
  await expect(page.locator("#notify-toggle")).toContainText(/On/i);

  await expect.poll(() => page.evaluate(() => window.__notifications.length)).toBeGreaterThan(0);

  const firstNotification = await page.evaluate(() => window.__notifications[0] || null);
  expect(firstNotification).not.toBeNull();
  expect(firstNotification.title).toContain(title);
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
