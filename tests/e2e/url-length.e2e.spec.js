const { test, expect } = require("@playwright/test");
const { waitForApp } = require("./helpers.cjs");

test("long hashes show URL warnings and QR over-limit warning", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);

  await page.evaluate(() => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const rand = (len) => {
      let out = "";
      for (let i = 0; i < len; i += 1) {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
      return out;
    };
    const startMin = Math.floor(Date.now() / 60000);
    const payload = {
      t: `LengthSeed-${Date.now()}`,
      e: Array.from({ length: 180 }, (_, index) => [
        startMin + index,
        0,
        `Len${index}-${rand(44)}`,
        index % 5,
      ]),
    };
    const compressed = window.LZString.compressToEncodedURIComponent(JSON.stringify(payload));
    window.location.hash = compressed;
  });

  await expect.poll(async () => {
    const text = await page.locator("#url-length").innerText();
    return Number(text.trim()) || 0;
  }).toBeGreaterThan(2000);

  const urlLength = Number((await page.locator("#url-length").innerText()).trim());
  expect(urlLength).toBeGreaterThan(2000);

  await expect(page.locator("#url-warning")).not.toHaveText("");
  await expect(page.locator("#mobile-url-warning")).not.toHaveText("");

  await page.click("#share-qr");
  await expect(page.locator("#qr-modal")).toBeVisible();
  await expect(page.locator("#qr-warning")).toBeVisible();
  await expect(page.locator("#qr-warning")).toContainText(/Warning:/i);
  await expect(page.locator("#qrcode-container canvas")).toHaveCount(0);

  await page.click("#qr-close");
  await expect(page.locator("#qr-modal")).toBeHidden();
});
