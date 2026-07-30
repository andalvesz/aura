const DEFAULT_DASHBOARD = "/dashboard";

const ALLOWED_AUTH_NEXT = new Set(["/redefinir-senha", "/sem-permissao", "/offline"]);

/** Evita open redirect — apenas paths internos do dashboard */
export function safeDashboardPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/dashboard")) {
    return DEFAULT_DASHBOARD;
  }
  if (path.includes("//") || path.includes("\\") || path.includes("@")) {
    return DEFAULT_DASHBOARD;
  }
  return path;
}

/**
 * Safe post-auth redirects (email confirm, password recovery).
 * Allows dashboard paths + a small whitelist of system pages.
 */
export function safeAuthNextPath(path: string | null | undefined): string {
  if (!path) return DEFAULT_DASHBOARD;
  if (path.includes("//") || path.includes("\\") || path.includes("@")) {
    return DEFAULT_DASHBOARD;
  }
  if (path.startsWith("/dashboard")) return safeDashboardPath(path);
  if (ALLOWED_AUTH_NEXT.has(path)) return path;
  return DEFAULT_DASHBOARD;
}
