const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.PORT || 4173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
    locale: "en-US",
    timezoneId: "UTC",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `node tests/e2e/static-server.cjs ${PORT}`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/*.mobile.e2e.spec.js"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testMatch: ["**/*.cross.e2e.spec.js"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: ["**/*.cross.e2e.spec.js"],
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: ["**/*.mobile.e2e.spec.js"],
    },
  ],
});
