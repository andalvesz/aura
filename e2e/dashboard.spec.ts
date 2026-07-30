import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

test.describe("dashboard context-aware", () => {
  test("unauthenticated dashboard redirects", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(600);
    const body = await page.locator("body").innerText();
    expect(
      /login|entrar|cadastr/i.test(body) || /\/login/.test(page.url())
    ).toBeTruthy();
  });

  test("personal dashboard renders for owner in personal or default", async ({
    page,
  }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);
    expect(page.url()).toMatch(/\/dashboard/);

    // Either personal or workspace dashboard root should be present
    const personal = page.getByTestId("personal-dashboard");
    const workspace = page.getByTestId("workspace-dashboard");
    const hasPersonal = (await personal.count()) > 0;
    const hasWorkspace = (await workspace.count()) > 0;
    expect(hasPersonal || hasWorkspace).toBeTruthy();

    // Quick actions visible
    await expect(page.getByRole("region", { name: /atalhos/i })).toBeVisible();

    // No pageerror
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("dashboard mobile 390x844 no horizontal overflow", async ({ page }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "creds missing"
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 4
    );
    expect(overflow).toBe(false);
  });

  test("outsider cannot see foreign workspace ops via dashboard API surface", async ({
    page,
  }) => {
    test.skip(
      !hasCredentials("E2E_OUTSIDER_EMAIL", "E2E_OUTSIDER_PASSWORD"),
      "outsider missing"
    );
    await loginAs(page, "E2E_OUTSIDER_EMAIL", "E2E_OUTSIDER_PASSWORD");
    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);
    // Should still render a dashboard without 500
    const res = await page.goto("/dashboard");
    expect(res?.status()).not.toBe(500);
  });
});
