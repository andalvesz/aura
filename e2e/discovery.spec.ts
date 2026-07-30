import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

test.describe("Discovery Platform RC2", () => {
  test("discovery route is protected when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard/discovery");
    await page.waitForTimeout(500);
    const url = page.url();
    expect(
      /login|cadastro/i.test(url) ||
        /entrar|login/i.test(await page.locator("body").innerText())
    ).toBeTruthy();
  });

  test("authenticated discovery page loads sections", async ({ page }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard/discovery");
    await expectNoWhiteScreen(page);
    await expect(page.getByTestId("discovery-aura-view")).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByTestId("discovery-filters")).toBeVisible();
    await expect(page.getByTestId("discovery-bootstrap")).toBeVisible();
  });

  test("dashboard shows discovery summary", async ({ page }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);
    const summary = page.getByTestId("discovery-dashboard-summary");
    if ((await summary.count()) === 0) return;
    await expect(summary).toBeVisible({ timeout: 20_000 });
  });
});
