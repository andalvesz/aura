import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { probeRoute, isProductionTarget } from "./helpers";

/** Core public + auth routes always smoke-tested. */
const PUBLIC_ROUTES = ["/", "/login", "/cadastro"];

/** Dashboard routes — require auth; unauthenticated should redirect. */
const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/missions",
  "/dashboard/financeiro",
  "/dashboard/saude",
  "/dashboard/calendario",
  "/dashboard/viagens",
  "/dashboard/idiomas",
  "/dashboard/metas",
  "/dashboard/ceo",
  "/dashboard/opportunities",
  "/dashboard/master-flow",
  "/dashboard/creator/factory",
  "/dashboard/expert-brain",
  "/dashboard/social-media",
  "/dashboard/crescimento",
  "/dashboard/money",
  "/dashboard/alvesz",
  "/dashboard/memoria",
  "/dashboard/integrations",
  "/dashboard/diagnostico",
  "/dashboard/logs",
  "/dashboard/workspace",
  "/dashboard/comunicacao",
  "/dashboard/discovery",
];

test.describe("smoke — public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`opens ${route}`, async ({ page }) => {
      const probe = await probeRoute(page, route);
      expect(probe.status, `${route} status`).not.toBe(500);
      expect(probe.status, `${route} not 404`).not.toBe(404);
      expect(probe.blank, `${route} blank`).toBe(false);
      expect(probe.hydrationError, `${route} hydration`).toBe(false);
      expect(probe.pageErrors, `${route} pageerrors`).toEqual([]);
    });
  }
});

test.describe("smoke — unauthenticated dashboard protection", () => {
  for (const route of DASHBOARD_ROUTES) {
    test(`protects ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      const url = page.url();
      const redirected =
        /\/login|\/cadastro|\//.test(new URL(url).pathname) &&
        !url.includes(route);
      const onLogin = /\/login/.test(url);
      // Accept redirect to login OR stay with auth gate content
      expect(onLogin || redirected || /login|entrar|cadastr/i.test(await page.locator("body").innerText())).toBeTruthy();
    });
  }
});

test.describe("smoke — inventory snapshot", () => {
  test("write route smoke summary", async ({ page }) => {
    test.setTimeout(180_000);
    const results = [];
    for (const route of [...PUBLIC_ROUTES, ...DASHBOARD_ROUTES]) {
      const probe = await probeRoute(page, route);
      results.push({
        ...probe,
        production: isProductionTarget(),
      });
    }
    mkdirSync(resolve(process.cwd(), "reports"), { recursive: true });
    writeFileSync(
      resolve(process.cwd(), "reports/ui-smoke-results.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)
    );
    expect(results.length).toBeGreaterThan(10);
  });
});
