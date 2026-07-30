import { test, expect } from "@playwright/test";
import { hasCredentials, loginAs, expectNoWhiteScreen } from "./helpers";

test.describe("Aura Intelligence — Meu Dia", () => {
  test("priorities / alerts / recommendations render without duplicates", async ({
    page,
  }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "E2E_OWNER_* missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    await expectNoWhiteScreen(page);

    const myDay = page.getByTestId("my-day");
    const workspace = page.getByTestId("workspace-dashboard");
    if ((await workspace.count()) > 0 && (await myDay.count()) === 0) {
      test.info().annotations.push({
        type: "note",
        description: "Owner on workspace — intelligence Meu Dia is personal-only",
      });
      return;
    }

    await expect(myDay).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("my-day-priorities")).toBeVisible();

    // Header shows health index
    await expect(myDay.getByText(/índice\s+\d+\/100/i)).toBeVisible();

    const priorityItems = page.locator(
      '[data-testid="intelligence-priorities"] > li'
    );
    const count = await priorityItems.count();
    if (count > 0) {
      const titles = await priorityItems.locator("p").evaluateAll((nodes) =>
        nodes
          .filter((_, i) => i % 2 === 0)
          .map((n) => n.textContent?.trim() ?? "")
      );
      const unique = new Set(titles);
      expect(unique.size).toBe(titles.length);
    }

    const alerts = page.getByTestId("intelligence-alerts");
    const recs = page.getByTestId("intelligence-recommendations");
    if ((await alerts.count()) > 0) {
      await expect(alerts).toBeVisible();
      const alertTitles = await alerts.locator("li p").evaluateAll((nodes) =>
        nodes
          .filter((_, i) => i % 3 === 0)
          .map((n) => n.textContent?.trim() ?? "")
      );
      expect(new Set(alertTitles).size).toBe(alertTitles.length);
    }
    if ((await recs.count()) > 0) {
      await expect(recs).toBeVisible();
    }

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });

  test("priority levels use CRITICAL|HIGH|MEDIUM|LOW when present", async ({
    page,
  }) => {
    test.skip(
      !hasCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD"),
      "creds missing"
    );
    await loginAs(page, "E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
    await page.goto("/dashboard");
    const myDay = page.getByTestId("my-day");
    if ((await myDay.count()) === 0) return;

    const leveled = page.locator("[data-priority-level]");
    const n = await leveled.count();
    for (let i = 0; i < n; i++) {
      const level = await leveled.nth(i).getAttribute("data-priority-level");
      expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(level);
    }
  });
});
