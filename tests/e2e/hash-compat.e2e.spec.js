const { test, expect } = require("@playwright/test");
const { waitForApp } = require("./helpers.cjs");

test("legacy timezone arrays are migrated into mp.z when loading from hash", async ({ page }) => {
  await page.goto("/");

  const hash = await page.evaluate(() => {
    const payload = {
      mp: { z: ["Asia/Tokyo"] },
      tz: ["Europe/London"],
      s: { v: "month" },
    };
    return window.LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  });

  await page.goto(`/#${hash}`);
  await waitForApp(page);

  await expect(page.locator("#tz-list")).toContainText(/Tokyo/i);
  await expect(page.locator("#tz-list")).toContainText(/London/i);
});
