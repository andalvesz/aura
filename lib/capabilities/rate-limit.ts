/**
 * Platform rate limiting — in-process buckets (foundation).
 * Does not block normal use for existing users with generous defaults.
 */

export type RateLimitBucket =
  | "signup"
  | "login"
  | "password_reset"
  | "invite"
  | "upload"
  | "ocr"
  | "conversation"
  | "agents"
  | "automations"
  | "skill_install"
  | "config_import"
  | "feedback"
  | "bug_report"
  | "beta_invite"
  | "export"
  | "diagnostics"
  | "admin_action"
  | "announcement";

const LIMITS: Record<RateLimitBucket, { max: number; windowMs: number }> = {
  signup: { max: 10, windowMs: 60 * 60_000 },
  login: { max: 30, windowMs: 15 * 60_000 },
  password_reset: { max: 10, windowMs: 60 * 60_000 },
  invite: { max: 40, windowMs: 60 * 60_000 },
  upload: { max: 60, windowMs: 60 * 60_000 },
  ocr: { max: 30, windowMs: 60 * 60_000 },
  conversation: { max: 60, windowMs: 60_000 },
  agents: { max: 40, windowMs: 60 * 60_000 },
  automations: { max: 120, windowMs: 60 * 60_000 },
  skill_install: { max: 40, windowMs: 60 * 60_000 },
  config_import: { max: 20, windowMs: 60 * 60_000 },
  feedback: { max: 20, windowMs: 60 * 60_000 },
  bug_report: { max: 15, windowMs: 60 * 60_000 },
  beta_invite: { max: 30, windowMs: 60 * 60_000 },
  export: { max: 10, windowMs: 60 * 60_000 },
  diagnostics: { max: 30, windowMs: 60 * 60_000 },
  admin_action: { max: 60, windowMs: 60 * 60_000 },
  announcement: { max: 20, windowMs: 60 * 60_000 },
};

const buckets = new Map<string, number[]>();

export function clearPlatformRateLimits(): void {
  buckets.clear();
}

export function checkPlatformRateLimit(
  bucket: RateLimitBucket,
  key: string,
  now = Date.now()
): { ok: boolean; retryAfterMs: number; message: string | null } {
  const cfg = LIMITS[bucket];
  const mapKey = `${bucket}:${key}`;
  const stamps = (buckets.get(mapKey) ?? []).filter((t) => now - t < cfg.windowMs);
  if (stamps.length >= cfg.max) {
    buckets.set(mapKey, stamps);
    const oldest = stamps[0] ?? now;
    const retryAfterMs = Math.max(0, cfg.windowMs - (now - oldest));
    return {
      ok: false,
      retryAfterMs,
      message: `Limite temporário atingido (${bucket}). Tente novamente em alguns minutos.`,
    };
  }
  stamps.push(now);
  buckets.set(mapKey, stamps);
  return { ok: true, retryAfterMs: 0, message: null };
}
