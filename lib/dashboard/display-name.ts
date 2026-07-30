export function resolveDashboardDisplayName(
  fullName?: string | null,
  email?: string | null
): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const first = trimmed.split(/\s+/)[0];
    return first || trimmed;
  }
  const fromEmail = email?.split("@")[0]?.trim();
  return fromEmail || "você";
}
