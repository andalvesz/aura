import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

test.describe("Aura Brain Core", () => {
  test("login page shows Aura Brain identity", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /aura brain/i }).first()).toBeVisible();
  });

  test("consorcios route redirects away from module", async ({ page }) => {
    await page.goto("/dashboard/consorcios");
    await page.waitForTimeout(800);
    expect(page.url()).not.toMatch(/\/dashboard\/consorcios$/);
  });

  test("authenticated Meu Dia shows Aura Brain activity", async ({ page }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing — configure .env.e2e locally (never commit)"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);
    const myDay = page.getByTestId("my-day");
    if ((await myDay.count()) === 0) return;
    await expect(page.getByTestId("aura-brain-activity")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("aura-brain-autonomy")).toBeVisible();
  });

  test("settings page loads", async ({ page }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard/settings/aura-brain");
    await expectNoWhiteScreen(page);
    await expect(page.getByTestId("aura-brain-settings")).toBeVisible({
      timeout: 20_000,
    });
  });
});
