/**
 * Public site origin for invites, email confirmation, password recovery,
 * OAuth callbacks, share/tracking links, and auth redirects.
 *
 * Resolution order (production never allows localhost):
 * 1. NEXT_PUBLIC_SITE_URL
 * 2. SITE_URL / APP_URL (server aliases)
 * 3. Request headers / origin (x-forwarded-host + proto, or host)
 * 4. VERCEL_URL (https://…) when set by Vercel
 * 5. Dev only: localhost fallback
 * 6. Production: throw PublicSiteUrlError — never silent localhost
 */

export const PRODUCTION_SITE_URL = "https://aura-ten-rose.vercel.app";

export type SiteUrlResolveInput = {
  /** Full origin from `new URL(request.url).origin` when available */
  requestOrigin?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
  /** Optional env override bag (tests) */
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
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

function isProductionRuntime(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return (env.NODE_ENV ?? process.env.NODE_ENV) === "production";
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

/** Normalize VERCEL_URL (host only) into https origin. */
export function vercelUrlToOrigin(
  vercelUrl: string | undefined | null
): string | null {
  const raw = vercelUrl?.trim();
  if (!raw) return null;
  if (raw.includes("://")) return cleanSiteUrl(raw);
  return cleanSiteUrl(`https://${raw}`);
}

function envCandidates(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): Array<{ value: string | null; source: string }> {
  return [
    { value: env.NEXT_PUBLIC_SITE_URL ?? null, source: "NEXT_PUBLIC_SITE_URL" },
    { value: env.SITE_URL ?? null, source: "SITE_URL" },
    { value: env.APP_URL ?? null, source: "APP_URL" },
    { value: vercelUrlToOrigin(env.VERCEL_URL), source: "VERCEL_URL" },
  ];
}

/**
 * Resolve the public site base URL for auth / invite / OAuth / tracking links.
 * Never returns localhost when NODE_ENV === "production".
 */
export function resolvePublicSiteUrl(input: SiteUrlResolveInput = {}): string {
  const env = input.env ?? process.env;
  const isProd = isProductionRuntime(env);
  const allowLocalhost = !isProd;
  const envName = isProd ? "production" : env.NODE_ENV || "development";

  const headersOrigin = buildOriginFromHeaders(input);
  const fromHeaders = pickUsableUrl(headersOrigin, allowLocalhost);
  const fromRequest = pickUsableUrl(input.requestOrigin, allowLocalhost);

  let baseUrl: string | null = null;
  let source: string | null = null;

  for (const c of envCandidates(env)) {
    const picked = pickUsableUrl(c.value, allowLocalhost);
    if (picked) {
      baseUrl = picked;
      source = c.source;
      break;
    }
  }

  if (!baseUrl && fromHeaders) {
    baseUrl = fromHeaders;
    source = "request_headers";
  } else if (!baseUrl && fromRequest) {
    baseUrl = fromRequest;
    source = "request_origin";
  } else if (!baseUrl && allowLocalhost) {
    baseUrl =
      pickUsableUrl(headersOrigin, true) ??
      pickUsableUrl(input.requestOrigin, true) ??
      pickUsableUrl(env.NEXT_PUBLIC_SITE_URL, true) ??
      pickUsableUrl(env.SITE_URL, true) ??
      pickUsableUrl(env.APP_URL, true) ??
      "http://localhost:3000";
    source = "dev_localhost_fallback";
  }

  if (!baseUrl) {
    const envWasLocalhost = envCandidates(env).some(
      (c) => c.value && isLocalhostUrl(c.value)
    );
    throw new PublicSiteUrlError(
      envWasLocalhost
        ? `URL pública está como localhost em produção. Defina NEXT_PUBLIC_SITE_URL=${PRODUCTION_SITE_URL}`
        : `Não foi possível determinar a URL pública em produção. Defina NEXT_PUBLIC_SITE_URL=${PRODUCTION_SITE_URL}`
    );
  }

  if (isProd && isLocalhostUrl(baseUrl)) {
    throw new PublicSiteUrlError(
      `Recusa de URL localhost em produção. Defina NEXT_PUBLIC_SITE_URL=${PRODUCTION_SITE_URL}`
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

/** Absolute public URL for a path (leading slash optional). */
export function absolutePublicUrl(
  path: string,
  input: SiteUrlResolveInput = {}
): string {
  const base = resolvePublicSiteUrl(input);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Resolve from an incoming Request (preferred for route handlers). */
export function resolveSiteUrlFromRequest(request: Request): string {
  const url = new URL(request.url);
  return resolvePublicSiteUrl({
    requestOrigin: url.origin,
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
  });
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

/** Beta invite acceptance URL (Sprint 10.2). */
export function buildBetaInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  if (isProductionRuntime() && isLocalhostUrl(base)) {
    throw new PublicSiteUrlError(
      `Recusa de gerar convite beta com localhost em produção. Use ${PRODUCTION_SITE_URL}`
    );
  }
  return `${base}/beta/invite/${encodeURIComponent(token)}`;
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

/**
 * Assert an explicit OAuth redirect override is not localhost in production.
 */
export function assertPublicRedirectUri(uri: string, label: string): string {
  const cleaned = uri.trim();
  if (isProductionRuntime() && isLocalhostUrl(cleaned)) {
    throw new PublicSiteUrlError(
      `${label} não pode ser localhost em produção. Use um redirect em ${PRODUCTION_SITE_URL}`
    );
  }
  return cleaned;
}
