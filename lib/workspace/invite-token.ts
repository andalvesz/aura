import { createHash, randomBytes } from "node:crypto";

/** Raw invite token (shown once in URL). Never store plaintext. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function inviteExpiresAt(days = 14): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function buildInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/convite/${encodeURIComponent(token)}`;
}
