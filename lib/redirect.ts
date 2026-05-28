const DEFAULT_DASHBOARD = "/dashboard";

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
