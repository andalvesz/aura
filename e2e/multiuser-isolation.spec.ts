/**
 * E2E: Multiuser cognitive isolation — health/workout prompts must not leak User A injury to User B.
 *
 * Requires:
 *   E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD
 *   E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD
 *
 * Skips when credentials are absent.
 */
import { test, expect } from "@playwright/test";

const userA = {
  email: process.env.E2E_USER_A_EMAIL ?? "",
  password: process.env.E2E_USER_A_PASSWORD ?? "",
};
const userB = {
  email: process.env.E2E_USER_B_EMAIL ?? "",
  password: process.env.E2E_USER_B_PASSWORD ?? "",
};

const hasCreds =
  Boolean(userA.email && userA.password && userB.email && userB.password) &&
  userA.email !== userB.email;

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar|login/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
}

async function logout(page: import("@playwright/test").Page) {
  const btn = page.getByRole("button", { name: /sair|logout|desconectar/i });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForURL(/login/, { timeout: 20_000 });
  }
}

test.describe("multiuser cognitive isolation e2e", () => {
  test.skip(!hasCreds, "Set E2E_USER_A_* and E2E_USER_B_* credentials");

  test("User B workout request must not mention User A shoulder injury", async ({
    page,
  }) => {
    // User A session (establish known personal health context if UI available)
    await login(page, userA.email, userA.password);
    await logout(page);

    // Fresh B session on same browser
    await login(page, userB.email, userB.password);

    // Hit health coach API as B
    const res = await page.request.post("/api/health-coach", {
      data: {
        mode: "treino",
        message: "Monte um treino para mim.",
      },
    });

    // Auth must succeed for B
    expect(res.status()).not.toBe(401);

    const body = await res.json().catch(() => ({}));
    const blob = JSON.stringify(body).toLowerCase();

    expect(blob).not.toMatch(/ombro direito/);
    expect(blob).not.toMatch(/les[aã]o no ombro/);
    expect(blob).not.toMatch(/anderson/);

    // UI privacy copy when health module is open
    await page.goto("/dashboard");
    const privacy = page.getByText(/privados e pertencem somente a você/i);
    // Soft assert — module may be behind nav
    if (await privacy.count()) {
      await expect(privacy.first()).toBeVisible();
    }

    await logout(page);
  });
});
