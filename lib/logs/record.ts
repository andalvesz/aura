import type { SystemLogTipo } from "@/types/database";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import type { RecordSystemLogInput } from "./system-log.service";
import { recordSystemLogInternal } from "./system-log.service";

export type { RecordSystemLogInput } from "./system-log.service";

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Registra log sem propagar falha (fire-and-forget). */
export function recordSystemLog(input: RecordSystemLogInput): void {
  void recordSystemLogInternal(input).catch(() => {
    /* tabela ausente ou rede — não interrompe fluxo principal */
  });
}

export function logSupabaseError(
  modulo: string,
  operation: string,
  error: string | null | undefined
): void {
  if (!error) return;
  recordSystemLog({
    tipo: isMissingSupabaseTableError(error) ? "warning" : "error",
    modulo: "supabase",
    mensagem: `Supabase · ${modulo}: ${operation}`,
    detalhes: { modulo, operation, error },
  });
}

export function logOpenAiError(modulo: string, error: unknown, route?: string): void {
  recordSystemLog({
    tipo: "error",
    modulo: "openai",
    mensagem: `OpenAI · ${modulo}${route ? ` (${route})` : ""}`,
    detalhes: { modulo, route, error: serializeError(error) },
  });
}

export function logApiError(
  modulo: string,
  route: string,
  error: unknown,
  status?: number
): void {
  recordSystemLog({
    tipo: status === 401 ? "warning" : "error",
    modulo: modulo === "auth" ? "auth" : "api",
    mensagem: `API ${route} falhou`,
    detalhes: { route, status, error: serializeError(error), contextModulo: modulo },
  });
}

export function logAuthFailure(route: string, detail?: string): void {
  recordSystemLog({
    tipo: "warning",
    modulo: "auth",
    mensagem: "Falha de autenticação",
    detalhes: { route, detail },
  });
}

export function logSearchFailure(error: string): void {
  recordSystemLog({
    tipo: "error",
    modulo: "busca-global",
    mensagem: "Falha na busca global",
    detalhes: { error },
  });
}

export function logCalendarFailure(error: unknown, route = "/api/calendar-agenda"): void {
  recordSystemLog({
    tipo: "error",
    modulo: "calendario",
    mensagem: "Falha no calendário / agenda IA",
    detalhes: { route, error: serializeError(error) },
  });
}

export function logFinanceFailure(operation: string, error: string): void {
  recordSystemLog({
    tipo: isMissingSupabaseTableError(error) ? "warning" : "error",
    modulo: "financeiro",
    mensagem: `Financeiro · ${operation}`,
    detalhes: { operation, error },
  });
}

export function logDiagnosticRun(summary: {
  ok: number;
  warning: number;
  error: number;
  durationMs: number;
}): void {
  const tipo =
    summary.error > 0 ? "error" : summary.warning > 0 ? "warning" : "success";
  recordSystemLog({
    tipo,
    modulo: "diagnostico",
    mensagem: `Diagnóstico concluído · ${summary.ok} OK, ${summary.warning} atenção, ${summary.error} erro`,
    detalhes: summary,
  });
}
