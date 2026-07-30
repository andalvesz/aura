import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.describe("responsive", () => {
  for (const vp of VIEWPORTS) {
    test(`login layout ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login");
      await expectNoWhiteScreen(page);
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      });
      expect(overflow, `horizontal overflow on ${vp.name}`).toBe(false);
    });

    test(`dashboard layout ${vp.name}`, async ({ page }) => {
      test.skip(!hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"), "creds missing");
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
      await page.goto("/dashboard");
      await expectNoWhiteScreen(page);
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 4;
      });
      expect(overflow, `dashboard overflow ${vp.name}`).toBe(false);
    });
  }
});
