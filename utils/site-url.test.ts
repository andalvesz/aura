import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_SITE_URL,
  PublicSiteUrlError,
  buildPublicInviteUrl,
  isLocalhostUrl,
  resolvePublicSiteUrl,
} from "@/lib/site-url";

const originalEnv = { ...process.env };

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void
) {
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

test("isLocalhostUrl detects localhost and loopback", () => {
  assert.equal(isLocalhostUrl("http://localhost:3000"), true);
  assert.equal(isLocalhostUrl("http://127.0.0.1:3000"), true);
  assert.equal(isLocalhostUrl(PRODUCTION_SITE_URL), false);
});

test("dev: prefers NEXT_PUBLIC_SITE_URL", () => {
  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_URL: "https://aura-ten-rose.vercel.app",
    },
    () => {
      assert.equal(resolvePublicSiteUrl(), "https://aura-ten-rose.vercel.app");
    }
  );
});

test("dev: allows localhost fallback", () => {
  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_URL: undefined,
    },
    () => {
      assert.equal(resolvePublicSiteUrl(), "http://localhost:3000");
    }
  );
});

test("production: rejects localhost env and uses request headers", () => {
  withEnv(
    {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
    () => {
      const url = resolvePublicSiteUrl({
        forwardedHost: "aura-ten-rose.vercel.app",
        forwardedProto: "https",
      });
      assert.equal(url, "https://aura-ten-rose.vercel.app");
    }
  );
});

test("production: throws when only localhost is available", () => {
  withEnv(
    {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
    () => {
      assert.throws(
        () =>
          resolvePublicSiteUrl({
            forwardedHost: "localhost:3000",
            forwardedProto: "http",
          }),
        (err: unknown) => err instanceof PublicSiteUrlError
      );
    }
  );
});

test("buildPublicInviteUrl format without logging token content in path check", () => {
  withEnv({ NODE_ENV: "development" }, () => {
    const url = buildPublicInviteUrl(
      "https://aura-ten-rose.vercel.app",
      "test-token-value"
    );
    assert.equal(
      url,
      "https://aura-ten-rose.vercel.app/convite/test-token-value"
    );
  });
});

test("production refuses invite URL with localhost origin", () => {
  withEnv({ NODE_ENV: "production" }, () => {
    assert.throws(
      () => buildPublicInviteUrl("http://localhost:3000", "tok"),
      (err: unknown) => err instanceof PublicSiteUrlError
    );
  });
});
