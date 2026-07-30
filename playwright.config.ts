import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename: string) {
  try {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvFile(".env.e2e");
loadEnvFile(".env.local");

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const isProductionTarget = /auraos\.app|vercel\.app|https:\/\//i.test(baseURL) &&
  !/localhost|127\.0\.0\.1/i.test(baseURL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "reports/playwright-results.json" }],
  ],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 12_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-tablet",
      use: { ...devices["iPad Mini"], viewport: { width: 768, height: 1024 } },
      testMatch: /smoke|nav|responsive/,
    },
    {
      name: "chromium-mobile",
      use: { ...devices["iPhone 12"], viewport: { width: 390, height: 844 } },
      testMatch: /smoke|nav|responsive/,
    },
  ],
  metadata: {
    isProductionTarget,
    destructiveAllowed: !isProductionTarget,
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
