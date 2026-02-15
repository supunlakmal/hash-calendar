const { test, expect } = require("@playwright/test");

test("about page loads", async ({ page }) => {
  await page.goto("/about.html");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/About/i);
});

test("help page loads", async ({ page }) => {
  await page.goto("/help.html");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/Help/i);
});

test("FAQ page loads", async ({ page }) => {
  await page.goto("/faq.html");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/FAQ/i);
});

test("privacy page loads", async ({ page }) => {
  await page.goto("/privacy.html");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/Privacy/i);
});

test("404 page loads for unknown route", async ({ page }) => {
  await page.goto("/404.html");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/404/i);
});
