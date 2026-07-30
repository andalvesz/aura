/**
 * Privacy gates — ADR-007.
 */

import type { WorldSensitivity, WorldSourceType } from "@/lib/world-model/types";

const RESTRICTED = [
  /medical|diagnos|disease|disorder|clinical|psicolog|psychiatr|mental_health/i,
  /sexual|orientation|relig|politic|ethnic|race|biometric|genetic/i,
  /legal_case|criminal|lawsuit|cpf|passport_number|ssn/i,
  /password|secret|token|credential/i,
];

export function isRestrictedText(...parts: Array<string | null | undefined>): boolean {
  const blob = parts.filter(Boolean).join(" ");
  return RESTRICTED.some((re) => re.test(blob));
}

export function assertWorldPrivacy(input: {
  displayName: string;
  description?: string;
  entityType?: string;
  sourceType: WorldSourceType;
  sensitivity?: WorldSensitivity;
}): { ok: boolean; reason: string | null; forceSensitivity?: WorldSensitivity } {
  if (isRestrictedText(input.displayName, input.description, input.entityType)) {
    if (
      input.sourceType !== "user_explicit" &&
      input.sourceType !== "manual_entry"
    ) {
      return {
        ok: false,
        reason: "Inferência automática bloqueada para conteúdo sensível (ADR-007)",
      };
    }
    if (/diagnos|clinical|disorder|psicolog|psychiatr/i.test(
      `${input.displayName} ${input.description ?? ""}`
    )) {
      return {
        ok: false,
        reason: "Classificações clínicas não são suportadas pelo World Model",
      };
    }
    return { ok: true, reason: null, forceSensitivity: "RESTRICTED" };
  }
  if (
    input.sensitivity === "RESTRICTED" &&
    input.sourceType !== "user_explicit" &&
    input.sourceType !== "manual_entry"
  ) {
    return {
      ok: false,
      reason: "RESTRICTED exige entrada explícita",
    };
  }
  return { ok: true, reason: null };
}

export function worldVisibleInScope(input: {
  ownerUserId: string;
  ownerWorkspaceId: string | null;
  viewerUserId: string;
  viewerWorkspaceId: string | null;
  mode: "personal" | "workspace";
}): boolean {
  if (input.ownerUserId !== input.viewerUserId) return false;
  if (input.mode === "personal") {
    return (
      input.ownerWorkspaceId == null ||
      input.ownerWorkspaceId === input.viewerWorkspaceId
    );
  }
  return (
    input.ownerWorkspaceId != null &&
    input.ownerWorkspaceId === input.viewerWorkspaceId
  );
}
