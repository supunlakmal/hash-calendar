const { test, expect } = require("@playwright/test");
const { waitForApp } = require("./helpers.cjs");

function buildPayload(title) {
  const startMin = Math.floor(Date.now() / 60000);
  return {
    t: `Bridge-${Date.now()}`,
    e: [[startMin, 0, title, 0]],
    s: { v: "month" },
  };
}

async function openBridgeAndWait(page, queryKey, payload) {
  const encoded = encodeURIComponent(JSON.stringify(payload));
  await page.goto(`/json.html?${queryKey}=${encoded}`);
  await page.waitForURL((url) => !url.pathname.endsWith("/json.html") && url.hash.length > 1);
  await waitForApp(page);
}

["json", "data", "state", "payload"].forEach((queryKey) => {
  test(`json bridge accepts ${queryKey} query key`, async ({ page }) => {
    const title = `BridgeEvent-${queryKey}-${Date.now()}`;
    const payload = buildPayload(title);

    await openBridgeAndWait(page, queryKey, payload);

    await expect(page.locator("#event-list .event-title", { hasText: title })).toBeVisible();
    await expect(page).toHaveURL(/#.+/);
  });
});

test("json bridge shows error for missing payload", async ({ page }) => {
  await page.goto("/json.html");

  await expect(page.locator("#status")).toContainText("Missing JSON payload.");
  await expect(page).toHaveURL(/\/json\.html$/);
});

test("json bridge shows error for invalid payload", async ({ page }) => {
  await page.goto("/json.html?json=%7Bnot-valid-json");

  await expect(page.locator("#status")).toContainText("Invalid JSON payload");
  await expect(page).toHaveURL(/\/json\.html\?json=/);
});
