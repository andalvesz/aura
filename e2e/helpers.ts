import { expect, type Page } from "@playwright/test";

export function e2eEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export function hasCredentials(...keys: string[]): boolean {
  return keys.every((k) => Boolean(e2eEnv(k)));
}

export function isProductionTarget(baseURL = process.env.E2E_BASE_URL): boolean {
  if (!baseURL) return false;
  return /https:\/\//i.test(baseURL) && !/localhost|127\.0\.0\.1/i.test(baseURL);
}

export function destructiveAllowed(): boolean {
  if (isProductionTarget()) return false;
  return process.env.E2E_ALLOW_DESTRUCTIVE === "1";
}

export async function loginAs(
  page: Page,
  emailKey: string,
  passwordKey: string
): Promise<boolean> {
  const email = e2eEnv(emailKey);
  const password = e2eEnv(passwordKey);
  if (!email || !password) return false;

  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha|password/i).fill(password);
  await page.getByRole("button", { name: /entrar|login|acessar/i }).click();
  await page.waitForURL(/\/dashboard|\/convite/, { timeout: 30_000 });
  return true;
}

export type PageProbe = {
  route: string;
  status: number | null;
  blank: boolean;
  hydrationError: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  httpFailures: { url: string; status: number }[];
  title: string;
};

export async function probeRoute(page: Page, route: string): Promise<PageProbe> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const httpFailures: { url: string; status: number }[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("response", (res) => {
    const status = res.status();
    if ([400, 401, 403, 404, 500].includes(status)) {
      const url = res.url();
      // Ignore expected auth redirects / favicon
      if (/favicon|\/_next\/static/i.test(url)) return;
      httpFailures.push({ url, status });
    }
  });

  let status: number | null = null;
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  status = response?.status() ?? null;

  await page.waitForTimeout(300);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const blank = !bodyText || bodyText.trim().length < 2;
  const hydrationError =
    consoleErrors.some((e) => /hydrat/i.test(e)) ||
    pageErrors.some((e) => /hydrat/i.test(e));

  return {
    route,
    status,
    blank,
    hydrationError,
    consoleErrors: consoleErrors.slice(0, 20),
    pageErrors: pageErrors.slice(0, 20),
    httpFailures: httpFailures.slice(0, 30),
    title: await page.title(),
  };
}

export async function expectNoWhiteScreen(page: Page) {
  const text = await page.locator("body").innerText();
  expect(text.trim().length).toBeGreaterThan(0);
}
