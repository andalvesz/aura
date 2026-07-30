import { test, expect } from "@playwright/test";
import { destructiveAllowed, hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

test.describe("auth flows", () => {
  test("wrong password shows error", async ({ page }) => {
    test.skip(!hasCredentials("E2E_OWNER_EMAIL"), "E2E_OWNER_EMAIL missing");
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill(process.env.E2E_OWNER_EMAIL!);
    await page.getByLabel(/senha|password/i).fill("E2E_wrong_password_!!!_999");
    await page.getByRole("button", { name: /entrar|login|acessar/i }).click();
    await page.waitForTimeout(1500);
    // Should remain on login or show error — not land on dashboard
    expect(page.url()).not.toMatch(/\/dashboard$/);
  });

  test("logout returns to login or public", async ({ page }) => {
    test.skip(!hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"), "creds missing");
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    const logout = page.getByRole("button", { name: /sair|logout|desconectar/i });
    if (await logout.count()) {
      await logout.first().click();
      await page.waitForTimeout(1000);
      expect(page.url()).not.toMatch(/\/dashboard$/);
    }
  });
});

test.describe("modules — read-only smoke (authenticated)", () => {
  const modules = [
    "/dashboard/financeiro",
    "/dashboard/saude",
    "/dashboard/calendario",
    "/dashboard/viagens",
    "/dashboard/idiomas",
    "/dashboard/metas",
    "/dashboard/ceo",
    "/dashboard/opportunities",
    "/dashboard/master-flow",
    "/dashboard/expert-brain",
    "/dashboard/alvesz",
    "/dashboard/memoria",
    "/dashboard/workspace",
  ];

  for (const route of modules) {
    test(`module opens ${route}`, async ({ page }) => {
      test.skip(!hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"), "creds missing");
      await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
      const res = await page.goto(route);
      expect(res?.status()).not.toBe(500);
      expect(res?.status()).not.toBe(404);
      await expectNoWhiteScreen(page);
    });
  }
});

test.describe("destructive guards", () => {
  test("production forbids destructive flag", async () => {
    if (process.env.E2E_BASE_URL && /https:\/\//i.test(process.env.E2E_BASE_URL) &&
        !/localhost|127\.0\.0\.1/i.test(process.env.E2E_BASE_URL)) {
      expect(destructiveAllowed()).toBe(false);
    }
  });
});

test.describe("alvesz PDF access (outsider)", () => {
  test("outsider cannot open foreign proposal PDF API", async ({ page, request }) => {
    test.skip(
      !hasCredentials("E2E_OUTSIDER_EMAIL", "E2E_OUTSIDER_PASSWORD"),
      "outsider creds missing"
    );
    await loginAs(page, "E2E_OUTSIDER_EMAIL", "E2E_OUTSIDER_PASSWORD");
    // Random UUID — should 401/403/404, never 200 with PDF
    const res = await page.request.get(
      "/api/alvesz-proposta-pdf/00000000-0000-4000-8000-000000000099"
    );
    expect([401, 403, 404]).toContain(res.status());
  });
});
