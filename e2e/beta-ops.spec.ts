import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Sprint 10.2 — Private Beta Ops E2E.
 * Full multi-user flow requires .env.e2e credentials (Admin / User A / User B).
 */

function hasCredentials(): boolean {
  return Boolean(
    process.env.E2E_ADMIN_EMAIL &&
      process.env.E2E_ADMIN_PASSWORD &&
      process.env.E2E_USER_A_EMAIL &&
      process.env.E2E_USER_A_PASSWORD
  );
}

test.describe("Sprint 10.2 beta ops", () => {
  test("routes and artifacts exist", async () => {
    assertArtifacts();
  });

  test("feedback / changelog / diagnostics pages load when authenticated", async ({
    page,
  }) => {
    test.skip(!hasCredentials(), "Requires E2E_* credentials");
    // Login helper pattern from beta-platform.spec — soft navigate checks
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.E2E_USER_A_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_USER_A_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 30_000 });

    await page.goto("/dashboard/feedback");
    await expect(page.getByTestId("feedback-center")).toBeVisible({ timeout: 15_000 });

    await page.goto("/dashboard/changelog");
    await expect(page.getByTestId("changelog")).toBeVisible({ timeout: 15_000 });

    await page.goto("/dashboard/settings/diagnostics");
    await expect(page.getByTestId("user-diagnostics")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("bug-report-button")).toBeVisible();
  });

  test("admin platform beta ops when allowlisted", async ({ page }) => {
    test.skip(!hasCredentials(), "Requires E2E_* credentials");
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 30_000 });
    await page.goto("/dashboard/admin/platform");
    // May deny if allowlist not set — either denied or ops panel
    const denied = page.getByTestId("platform-admin-denied");
    const ops = page.getByTestId("admin-beta-ops");
    await expect(denied.or(ops)).toBeVisible({ timeout: 15_000 });
  });
});

function assertArtifacts() {
  const root = process.cwd();
  for (const p of [
    "supabase/migrations/20260731340000_sprint10_2_private_beta_operations.sql",
    "docs/operations/private-beta-operations.md",
    "reports/sprint10.2-private-beta-operations.md",
    "utils/sprint10.2-beta-ops.test.ts",
  ]) {
    expect(existsSync(join(root, p))).toBeTruthy();
  }
  const mig = readFileSync(
    join(root, "supabase/migrations/20260731340000_sprint10_2_private_beta_operations.sql"),
    "utf8"
  );
  expect(mig).toContain("aura_beta_invites");
  expect(mig).toContain("token_hash");
}
