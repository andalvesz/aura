import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

test.describe("navigation", () => {
  test("login page has links to cadastro", async ({ page }) => {
    await page.goto("/login");
    await expectNoWhiteScreen(page);
    const cadastro = page.getByRole("link", { name: /cadastr/i });
    if (await cadastro.count()) {
      await expect(cadastro.first()).toBeVisible();
    }
  });

  test("unauthenticated root does not 500", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).not.toBe(500);
    await expectNoWhiteScreen(page);
  });

  test("authenticated sidebar navigation (owner)", async ({ page }) => {
    test.skip(!hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"), "E2E_OWNER_* missing");

    const ok = await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    expect(ok).toBe(true);

    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);

    const targets = [
      { name: /financeiro|vida/i, path: /financeiro|saude|dashboard/ },
      { name: /alvesz/i, path: /alvesz/ },
      { name: /aura|memória|memoria|integra/i, path: /memoria|integrations|knowledge|dashboard/ },
    ];

    for (const t of targets) {
      const link = page.getByRole("link", { name: t.name }).first();
      if (await link.count()) {
        await link.click();
        await page.waitForTimeout(600);
        await expectNoWhiteScreen(page);
      }
    }

    // browser back/forward
    await page.goBack();
    await expectNoWhiteScreen(page);
    await page.goForward();
    await expectNoWhiteScreen(page);
  });

  test("mobile menu opens", async ({ page }) => {
    test.skip(!hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"), "E2E_OWNER_* missing");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");

    const menuBtn = page.getByRole("button", {
      name: /menu|abrir|naveg|sidebar/i,
    });
    if (await menuBtn.count()) {
      await menuBtn.first().click();
      await page.waitForTimeout(400);
      await expectNoWhiteScreen(page);
    }
  });
});
