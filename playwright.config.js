import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the local dev server in sample-data mode (no API key, no cost).
export default defineConfig({
  testDir: "e2e",
  timeout: 20000,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:3210", trace: "off" },
  webServer: {
    command: "node dev-server.js",
    env: { PORT: "3210", GOOGLE_MAPS_API_KEY: "" },
    url: "http://localhost:3210",
    reuseExistingServer: false,
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
