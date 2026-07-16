/** Detect Google OAuth invalid_grant (expired/revoked refresh token). */
export function isInvalidGrantError(error: string | null | undefined): boolean {
  if (!error?.trim()) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("invalid_grant") ||
    normalized.includes("token has been expired or revoked") ||
    normalized.includes("token has been expired") ||
    (normalized.includes("refresh token") && normalized.includes("revoked"))
  );
}

export function isOauthReconnectError(error: string | null | undefined): boolean {
  if (isInvalidGrantError(error)) return true;
  if (!error?.trim()) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("google drive precisa ser reconectado") ||
    normalized.includes("refresh token ausente") ||
    normalized.includes("google drive não conectado")
  );
}
