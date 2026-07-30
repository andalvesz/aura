/**
 * Minimal production logger — no secrets, tokens, passwords, or PII payloads.
 * Use for deploy diagnostics and ops only.
 */

export type ProdLogLevel = "info" | "warn" | "error";

export type ProdLogContext = {
  scope: string;
  action?: string;
  correlationId?: string;
  userId?: string | null;
  workspaceId?: string | null;
  route?: string;
  digest?: string;
  status?: number;
  /** Safe, non-sensitive metadata only */
  meta?: Record<string, string | number | boolean | null | undefined>;
};

const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|anon.?key|service.?role|api.?key|private/i;

function sanitizeMeta(
  meta?: ProdLogContext["meta"]
): Record<string, string | number | boolean | null> | undefined {
  if (!meta) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function maskId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function prodLog(
  level: ProdLogLevel,
  message: string,
  ctx: ProdLogContext
): void {
  const payload = {
    level,
    message,
    scope: ctx.scope,
    action: ctx.action ?? null,
    correlationId: ctx.correlationId ?? null,
    userId: maskId(ctx.userId),
    workspaceId: maskId(ctx.workspaceId),
    route: ctx.route ?? null,
    digest: ctx.digest ?? null,
    status: ctx.status ?? null,
    meta: sanitizeMeta(ctx.meta),
    at: new Date().toISOString(),
  };

  if (level === "error") console.error("[aura-prod]", payload);
  else if (level === "warn") console.warn("[aura-prod]", payload);
  else console.info("[aura-prod]", payload);
}

export function prodInfo(message: string, ctx: ProdLogContext): void {
  prodLog("info", message, ctx);
}

export function prodWarn(message: string, ctx: ProdLogContext): void {
  prodLog("warn", message, ctx);
}

export function prodError(message: string, ctx: ProdLogContext): void {
  prodLog("error", message, ctx);
}
