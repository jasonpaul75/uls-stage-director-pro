import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E. Playwright starts `next dev` on port 3000 unless something already listens there
 * (`reuseExistingServer`). Set PLAYWRIGHT_NO_WEBSERVER=1 to skip spawning (fail if nothing is listening).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
  },
  ...(process.env.PLAYWRIGHT_NO_WEBSERVER === "1"
    ? {}
    : {
        webServer: {
          command: "npm run dev -- -p 3000",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: process.env.CI ? false : true,
          timeout: 180_000,
        },
      }),
});
