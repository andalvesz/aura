/**
 * Input validation helpers for action registry.
 */

export function requireString(
  input: Record<string, unknown>,
  key: string,
  max = 500
): string | null {
  const v = input[key];
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim().slice(0, max);
}

export function requireObject(
  input: Record<string, unknown>
): Record<string, unknown> {
  return input && typeof input === "object" ? input : {};
}

export function draftOk(): { ok: true; error: null } {
  return { ok: true, error: null };
}

export function draftFail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
