/**
 * Domain error codes — RC1 normalization (gradual adoption).
 * Safe for client surfaces: no SQL, secrets, prompts, or cross-user data.
 */

export type KernelErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE"
  | "SUPPRESSED"
  | "INSUFFICIENT_EVIDENCE"
  | "SENSITIVE_INFERENCE_BLOCKED"
  | "EXECUTION_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "STORAGE_ERROR"
  | "MIGRATION_REQUIRED"
  | "INTERNAL_ERROR";

export type KernelError = {
  code: KernelErrorCode;
  message: string;
  correlationId: string | null;
  details?: Record<string, string | number | boolean | null>;
};

export function kernelError(
  code: KernelErrorCode,
  message: string,
  opts?: {
    correlationId?: string | null;
    details?: Record<string, string | number | boolean | null>;
  }
): KernelError {
  return {
    code,
    message,
    correlationId: opts?.correlationId ?? null,
    details: opts?.details,
  };
}

/** Map free-form service errors to stable codes when possible. */
export function normalizeKernelError(
  raw: string | null | undefined,
  correlationId?: string | null
): KernelError {
  const msg = (raw ?? "Erro interno").slice(0, 280);
  const lower = msg.toLowerCase();
  if (!raw) {
    return kernelError("INTERNAL_ERROR", msg, { correlationId });
  }
  if (/not found|não encontrad|artifact_not_found/i.test(lower)) {
    return kernelError("NOT_FOUND", msg, { correlationId });
  }
  if (/forbidden|ownership|isolament|outro usu/i.test(lower)) {
    return kernelError("FORBIDDEN", msg, { correlationId });
  }
  if (/suppressed|supress/i.test(lower)) {
    return kernelError("SUPPRESSED", msg, { correlationId });
  }
  if (/insufficient|evidência insuficiente/i.test(lower)) {
    return kernelError("INSUFFICIENT_EVIDENCE", msg, { correlationId });
  }
  if (/sensitive|sensível|clínic|psicolog/i.test(lower)) {
    return kernelError("SENSITIVE_INFERENCE_BLOCKED", msg, { correlationId });
  }
  if (/execution|execução|CREATE_MISSION|SCHEDULE_EVENT/i.test(lower)) {
    return kernelError("EXECUTION_NOT_ALLOWED", msg, { correlationId });
  }
  if (/timeout/i.test(lower)) {
    return kernelError("TIMEOUT", msg, { correlationId });
  }
  if (/duplicate|duplic|idempot/i.test(lower)) {
    return kernelError("DUPLICATE", msg, { correlationId });
  }
  if (/valid|obrigat|inválid|invalid/i.test(lower)) {
    return kernelError("VALIDATION_ERROR", msg, { correlationId });
  }
  return kernelError("INTERNAL_ERROR", msg, { correlationId });
}
