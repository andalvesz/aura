/**
 * Production URL audit — no silent localhost in app/lib runtime code.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  PRODUCTION_SITE_URL,
  PublicSiteUrlError,
  absolutePublicUrl,
  buildBetaInviteUrl,
  getAuthCallbackUrl,
  getPasswordRecoveryRedirectUrl,
  getPublicSiteUrl,
  isLocalhostUrl,
  resolvePublicSiteUrl,
  vercelUrlToOrigin,
} from "@/lib/site-url";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "lib", "utils", "hooks", "components"];
const SKIP_NAME = /(\.test\.|\.spec\.|playwright|e2e)/i;
const FORBIDDEN =
  /(?:\|\||\?\?)\s*["'`]https?:\/\/localhost(?::\d+)?["'`]|["'`]http:\/\/localhost:3000["'`]\s*(?:\|\||\?\?)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !SKIP_NAME.test(name)) out.push(p);
  }
  return out;
}

const originalEnv = { ...process.env };

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const keys = Object.keys(patch);
  for (const key of keys) {
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      const prev = originalEnv[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  }
}

describe("production URL audit", () => {
  test("no silent localhost fallbacks in runtime source", () => {
    const offenders: string[] = [];
    for (const d of SCAN_DIRS) {
      const abs = join(ROOT, d);
      try {
        statSync(abs);
      } catch {
        continue;
      }
      for (const file of walk(abs)) {
        const rel = relative(ROOT, file).replace(/\\/g, "/");
        // Allowed: lib/site-url.ts owns the sole deliberate localhost (dev-only)
        if (rel === "lib/site-url.ts") continue;
        const text = readFileSync(file, "utf8");
        if (FORBIDDEN.test(text) || / \|\| ["']http:\/\/localhost:3000["']/.test(text)) {
          offenders.push(rel);
        }
        if (
          /NEXT_PUBLIC_SITE_URL[^;\n]{0,80}localhost:3000/.test(text) &&
          rel !== "lib/site-url.ts"
        ) {
          offenders.push(rel);
        }
      }
    }
    assert.deepEqual(offenders, [], `localhost fallbacks: ${offenders.join(", ")}`);
  });

  test("production uses VERCEL_URL when NEXT_PUBLIC_SITE_URL missing", () => {
    withEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: undefined,
        SITE_URL: undefined,
        APP_URL: undefined,
        VERCEL_URL: "aura-ten-rose.vercel.app",
      },
      () => {
        assert.equal(resolvePublicSiteUrl(), "https://aura-ten-rose.vercel.app");
      }
    );
  });

  test("production throws without any public URL", () => {
    withEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: undefined,
        SITE_URL: undefined,
        APP_URL: undefined,
        VERCEL_URL: undefined,
      },
      () => {
        assert.throws(() => resolvePublicSiteUrl(), (e: unknown) => e instanceof PublicSiteUrlError);
      }
    );
  });

  test("auth / recovery / invite / absolute helpers never localhost in prod", () => {
    withEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: PRODUCTION_SITE_URL,
      },
      () => {
        assert.equal(getPublicSiteUrl(), PRODUCTION_SITE_URL);
        assert.equal(getAuthCallbackUrl(), `${PRODUCTION_SITE_URL}/auth/callback`);
        assert.ok(
          getPasswordRecoveryRedirectUrl().startsWith(`${PRODUCTION_SITE_URL}/auth/callback`)
        );
        assert.equal(
          absolutePublicUrl("/dashboard"),
          `${PRODUCTION_SITE_URL}/dashboard`
        );
        assert.equal(
          buildBetaInviteUrl(PRODUCTION_SITE_URL, "tok"),
          `${PRODUCTION_SITE_URL}/beta/invite/tok`
        );
        assert.equal(isLocalhostUrl(getPublicSiteUrl()), false);
      }
    );
  });

  test("vercelUrlToOrigin normalizes host-only values", () => {
    assert.equal(vercelUrlToOrigin("aura-ten-rose.vercel.app"), "https://aura-ten-rose.vercel.app");
    assert.equal(
      vercelUrlToOrigin("https://aura-ten-rose.vercel.app/"),
      "https://aura-ten-rose.vercel.app"
    );
  });

  test("oauth configs use resolvePublicSiteUrl (no hardcoded localhost)", async () => {
    await withEnvAsync(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: PRODUCTION_SITE_URL,
        GMAIL_REDIRECT_URI: undefined,
        GOOGLE_REDIRECT_URI: undefined,
        META_REDIRECT_URI: undefined,
        GOOGLE_DRIVE_REDIRECT_URI: undefined,
        GOOGLE_DRIVE_EXPERT_REDIRECT_URI: undefined,
      },
      async () => {
        const { getGmailRedirectUri } = await import("@/lib/gmail/config");
        const { getGoogleRedirectUri } = await import("@/lib/google-calendar/config");
        const { getMetaRedirectUri } = await import("@/lib/meta/config");
        const {
          getGoogleDriveRedirectUri,
          getExpertBrainGoogleDriveRedirectUri,
        } = await import("@/lib/google-drive/config");

        for (const uri of [
          getGmailRedirectUri(),
          getGoogleRedirectUri(),
          getMetaRedirectUri(),
          getGoogleDriveRedirectUri(),
          getExpertBrainGoogleDriveRedirectUri(),
        ]) {
          assert.ok(uri.startsWith(PRODUCTION_SITE_URL), uri);
          assert.equal(isLocalhostUrl(uri), false);
        }
      }
    );
  });
});

async function withEnvAsync(
  patch: Record<string, string | undefined>,
  fn: () => Promise<void>
) {
  const keys = Object.keys(patch);
  for (const key of keys) {
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const key of keys) {
      const prev = originalEnv[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  }
}