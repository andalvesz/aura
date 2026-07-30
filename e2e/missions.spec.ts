import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

test.describe("Mission Engine V1", () => {
  test("/missions redirects to dashboard missions", async ({ page }) => {
    await page.goto("/missions");
    await page.waitForTimeout(500);
    // Unauthenticated → login, or authenticated → /dashboard/missions
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard\/missions)/);
  });

  test("missions page loads when authenticated", async ({ page }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing — configure .env.e2e locally (never commit)"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard/missions");
    await expectNoWhiteScreen(page);
    await expect(page.getByTestId("missions-dashboard")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("create-mission-form")).toBeVisible();
  });

  test("create mission plans structure", async ({ page }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard/missions");
    await expect(page.getByTestId("missions-dashboard")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("mission-title-input").fill("E2E Aprender inglês");
    await page.getByTestId("mission-type-select").selectOption("LEARNING");
    await page.getByTestId("mission-create-submit").click();
    await expect(page.getByTestId("mission-card").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("mission-phases").first()).toBeVisible();
  });

  test("Meu Dia shows mission of the day block", async ({ page }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);
    const myDay = page.getByTestId("my-day");
    if ((await myDay.count()) === 0) return;
    await expect(page.getByTestId("my-day-mission")).toBeVisible({
      timeout: 20_000,
    });
  });
});
