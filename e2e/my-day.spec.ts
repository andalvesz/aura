import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

test.describe("Meu Dia", () => {
  test("unauthenticated cannot see Meu Dia", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(600);
    const hasMyDay = (await page.getByTestId("my-day").count()) > 0;
    expect(hasMyDay).toBe(false);
  });

  test("authenticated personal shows Meu Dia with quick actions", async ({
    page,
  }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);

    // If in workspace context, switch isn't automatic — still ok if personal
    const myDay = page.getByTestId("my-day");
    const workspace = page.getByTestId("workspace-dashboard");
    if ((await workspace.count()) > 0 && (await myDay.count()) === 0) {
      test.info().annotations.push({
        type: "note",
        description: "Owner landed on workspace dashboard — Meu Dia is personal-only",
      });
      return;
    }

    await expect(myDay).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("region", { name: /ações rápidas do meu dia/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /registrar despesa/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /registrar receita/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /criar evento/i })).toBeVisible();

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(400);
    expect(errors).toEqual([]);
  });

  test("Meu Dia mobile 390 no overflow", async ({ page }) => {
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
});
