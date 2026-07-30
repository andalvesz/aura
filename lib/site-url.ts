/**
 * Public site origin for invites, email confirmation, password recovery, and auth callbacks.
 *
 * Resolution order:
 * 1. NEXT_PUBLIC_SITE_URL (if set and not localhost in production)
 * 2. Request headers / origin (x-forwarded-host + x-forwarded-proto, or host)
 * 3. localhost only when NODE_ENV !== "production"
 * 4. In production: throw — never emit a broken localhost invite/redirect
 */

export const PRODUCTION_SITE_URL = "https://aura-ten-rose.vercel.app";

export type SiteUrlResolveInput = {
  /** Full origin from `new URL(request.url).origin` when available */
  requestOrigin?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
};

export class PublicSiteUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicSiteUrlError";
  }
}

function cleanSiteUrl(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  return value.trim().replace(/\/$/, "");
}

export function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url.includes("://") ? url : `https://${url}`).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function buildOriginFromHeaders(input: SiteUrlResolveInput): string | null {
  const hostHeader = (input.forwardedHost ?? input.host ?? "")
    .split(",")[0]
    ?.trim();
  if (!hostHeader) return null;
  const host = hostHeader.replace(/\/$/, "");
  const protoRaw = (input.forwardedProto ?? "").split(",")[0]?.trim();
  const proto =
    protoRaw === "http" || protoRaw === "https"
      ? protoRaw
      : isLocalhostUrl(`http://${host}`)
        ? "http"
        : "https";
  return cleanSiteUrl(`${proto}://${host}`);
}

function pickUsableUrl(
  candidate: string | null | undefined,
  allowLocalhost: boolean
): string | null {
  const cleaned = cleanSiteUrl(candidate);
  if (!cleaned) return null;
  if (!allowLocalhost && isLocalhostUrl(cleaned)) return null;
  return cleaned;
}

/**
 * Resolve the public site base URL for auth / invite links.
 * Never returns localhost when NODE_ENV === "production".
 */
export function resolvePublicSiteUrl(input: SiteUrlResolveInput = {}): string {
  const isProd = isProductionRuntime();
  const allowLocalhost = !isProd;
  const envName = isProd ? "production" : process.env.NODE_ENV || "development";

  const fromEnv = pickUsableUrl(process.env.NEXT_PUBLIC_SITE_URL, allowLocalhost);
  const headersOrigin = buildOriginFromHeaders(input);
  const fromHeaders = pickUsableUrl(headersOrigin, allowLocalhost);
  const fromRequest = pickUsableUrl(input.requestOrigin, allowLocalhost);

  let baseUrl: string | null = null;
  let source: string | null = null;

  if (fromEnv) {
    baseUrl = fromEnv;
    source = "NEXT_PUBLIC_SITE_URL";
  } else if (fromHeaders) {
    baseUrl = fromHeaders;
    source = "request_headers";
  } else if (fromRequest) {
    baseUrl = fromRequest;
    source = "request_origin";
  } else if (allowLocalhost) {
    baseUrl =
      pickUsableUrl(headersOrigin, true) ??
      pickUsableUrl(input.requestOrigin, true) ??
      pickUsableUrl(process.env.NEXT_PUBLIC_SITE_URL, true) ??
      "http://localhost:3000";
    source = "dev_localhost_fallback";
  }

  if (!baseUrl) {
    const envWasLocalhost = isLocalhostUrl(
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || ""
    );
    throw new PublicSiteUrlError(
      envWasLocalhost
        ? `NEXT_PUBLIC_SITE_URL está como localhost em produção. Defina NEXT_PUBLIC_SITE_URL=${PRODUCTION_SITE_URL}`
        : `Não foi possível determinar a URL pública em produção. Defina NEXT_PUBLIC_SITE_URL=${PRODUCTION_SITE_URL}`
    );
  }

  console.info("[site-url]", {
    baseUrl,
    env: envName,
    source,
  });

  return baseUrl;
}

/** Sync helper when no request headers are available (uses env + rules above). */
export function getPublicSiteUrl(): string {
  return resolvePublicSiteUrl();
}

export function getAuthCallbackUrl(input: SiteUrlResolveInput = {}): string {
  const base = resolvePublicSiteUrl(input);
  const route = `${base}/auth/callback`;
  console.info("[site-url]", {
    baseUrl: base,
    env: isProductionRuntime() ? "production" : process.env.NODE_ENV || "development",
    route: "/auth/callback",
  });
  return route;
}

export function getPasswordRecoveryRedirectUrl(
  input: SiteUrlResolveInput = {},
  nextPath = "/redefinir-senha"
): string {
  const base = resolvePublicSiteUrl(input);
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  const route = `${base}/auth/callback?next=${encodeURIComponent(next)}`;
  console.info("[site-url]", {
    baseUrl: base,
    env: isProductionRuntime() ? "production" : process.env.NODE_ENV || "development",
    route: "/auth/callback?next=/redefinir-senha",
  });
  return route;
}

/** Build invite URL and log base + route template (never logs raw token). */
export function buildPublicInviteUrl(
  origin: string,
  token: string
): string {
  const base = origin.replace(/\/$/, "");
  if (isProductionRuntime() && isLocalhostUrl(base)) {
    throw new PublicSiteUrlError(
      `Recusa de gerar convite com localhost em produção. Use ${PRODUCTION_SITE_URL}`
    );
  }
  const url = `${base}/convite/${encodeURIComponent(token)}`;
  console.info("[site-url]", {
    baseUrl: base,
    env: isProductionRuntime() ? "production" : process.env.NODE_ENV || "development",
    route: "/convite/[token]",
  });
  return url;
}

/** Read Next.js request headers into SiteUrlResolveInput. */
export function siteUrlInputFromHeaders(hdrs: {
  get(name: string): string | null;
}): SiteUrlResolveInput {
  return {
    forwardedHost: hdrs.get("x-forwarded-host"),
    forwardedProto: hdrs.get("x-forwarded-proto"),
    host: hdrs.get("host"),
  };
}
