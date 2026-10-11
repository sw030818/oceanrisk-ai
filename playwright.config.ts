import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.PLAYWRIGHT_SERVER_MODE === "production" ? "npm run start" : "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI && process.env.PLAYWRIGHT_SERVER_MODE !== "production",
    timeout: 120000,
  },
  reporter: "list",
});
