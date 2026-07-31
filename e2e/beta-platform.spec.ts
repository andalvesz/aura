/**
 * Sprint 10.1 — authenticated beta happy-path sketch.
 * Requires .env.e2e (see .env.e2e.example). Skips when credentials missing.
 */

import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs } from "./helpers";

test.describe("Sprint 10.1 beta persistence smoke", () => {
  test.skip(
    !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
    "Missing E2E credentials"
  );

  test("login → onboarding/skills routes reachable", async ({ page }) => {
    const ok = await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    expect(ok).toBeTruthy();
    await page.goto("/dashboard/onboarding");
    await expect(
      page.getByTestId("onboarding-v2").or(page.getByTestId("onboarding-v2-done"))
    ).toBeVisible({ timeout: 30_000 });
    await page.goto("/dashboard/skills");
    await expect(page.getByTestId("skill-center")).toBeVisible({ timeout: 30_000 });
    await page.goto("/dashboard/settings/privacy");
    await expect(page.getByTestId("privacy-center")).toBeVisible({ timeout: 30_000 });
  });
});
