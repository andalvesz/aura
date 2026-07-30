/**
 * Privacy gates for Memory — ADR-007.
 */

import type {
  MemorySensitivity,
  MemorySourceType,
} from "@/lib/memory/types";

const RESTRICTED_PATTERNS: RegExp[] = [
  /medical|diagnos|disease|disorder|clinical|psicolog|psychiatr|mental_health/i,
  /sexual|orientation|relig|politic|ethnic|race|biometric|genetic/i,
  /legal_case|criminal|lawsuit|cpf|passport_number|ssn/i,
  /password|secret|token|credential/i,
];

export function isRestrictedMemoryText(...parts: Array<string | null | undefined>): boolean {
  const blob = parts.filter(Boolean).join(" ");
  return RESTRICTED_PATTERNS.some((re) => re.test(blob));
}

export function assertMemoryPrivacy(input: {
  title: string;
  content: string;
  semanticKey?: string | null;
  sourceType: MemorySourceType;
  sensitivity?: MemorySensitivity;
}): { ok: boolean; reason: string | null; forceSensitivity?: MemorySensitivity } {
  const restricted = isRestrictedMemoryText(
    input.title,
    input.content,
    input.semanticKey
  );

  if (restricted) {
    if (
      input.sourceType !== "user_explicit" &&
      input.sourceType !== "manual_entry" &&
      input.sourceType !== "user_feedback"
    ) {
      return {
        ok: false,
        reason:
          "Inferência automática bloqueada para conteúdo sensível (ADR-007)",
      };
    }
    if (/diagnos|clinical|disorder|psicolog|psychiatr/i.test(input.title + input.content)) {
      return {
        ok: false,
        reason: "Classificações clínicas não são suportadas pelo Memory Engine",
      };
    }
    return {
      ok: true,
      reason: null,
      forceSensitivity: "RESTRICTED",
    };
  }

  if (
    input.sensitivity === "RESTRICTED" &&
    input.sourceType !== "user_explicit" &&
    input.sourceType !== "manual_entry" &&
    input.sourceType !== "user_feedback"
  ) {
    return {
      ok: false,
      reason: "Memórias RESTRICTED exigem entrada explícita do usuário",
    };
  }

  return { ok: true, reason: null };
}

export function defaultSensitivityFor(input: {
  title: string;
  content: string;
  sourceType: MemorySourceType;
  context?: string;
}): MemorySensitivity {
  if (isRestrictedMemoryText(input.title, input.content, input.context)) {
    return "RESTRICTED";
  }
  if (/financ|saldo|renda|health|saúde|saude/i.test(input.title + input.content)) {
    return "SENSITIVE";
  }
  if (input.sourceType === "user_explicit" || input.sourceType === "manual_entry") {
    return "STANDARD";
  }
  return "STANDARD";
}

export function memoryVisibleInScope(input: {
  memoryUserId: string;
  memoryWorkspaceId: string | null;
  viewerUserId: string;
  viewerWorkspaceId: string | null;
  mode: "personal" | "workspace";
}): boolean {
  if (input.memoryUserId !== input.viewerUserId) return false;
  if (input.mode === "personal") {
    return (
      input.memoryWorkspaceId == null ||
      input.memoryWorkspaceId === input.viewerWorkspaceId
    );
  }
  return (
    input.memoryWorkspaceId != null &&
    input.memoryWorkspaceId === input.viewerWorkspaceId
  );
}
