/**
 * Privacy gates for Identity — ADR-007.
 * Blocks automatic inference of sensitive categories.
 */

import type {
  IdentityCategory,
  IdentitySensitivity,
  IdentitySourceType,
} from "@/lib/identity/types";

/** Keys/patterns that must never be auto-inferred. */
const RESTRICTED_KEY_PATTERNS: RegExp[] = [
  /medical|diagnos|disease|disorder|clinical|psicolog|psychiatr|mental_health/i,
  /sexual|orientation|relig|politic|ethnic|race|biometric|genetic/i,
  /legal_case|criminal|lawsuit|cpf|passport_number|ssn/i,
  /password|secret|token|credential/i,
];

const RESTRICTED_CATEGORIES = new Set<string>([]);

export function isRestrictedIdentityKey(key: string, category?: string): boolean {
  if (category && RESTRICTED_CATEGORIES.has(category)) return true;
  return RESTRICTED_KEY_PATTERNS.some((re) => re.test(key));
}

/**
 * Automatic observation sources cannot create RESTRICTED/SENSITIVE medical-like claims.
 * User explicit / manual_entry may still create STANDARD/SENSITIVE with awareness —
 * but never RESTRICTED clinical labels via system.
 */
export function assertObservationPrivacy(input: {
  key: string;
  category: IdentityCategory;
  sourceType: IdentitySourceType;
  sensitivity?: IdentitySensitivity;
}): { ok: boolean; reason: string | null } {
  if (isRestrictedIdentityKey(input.key, input.category)) {
    if (
      input.sourceType !== "user_explicit" &&
      input.sourceType !== "manual_entry"
    ) {
      return {
        ok: false,
        reason:
          "Inferência automática bloqueada para categoria/chave sensível (ADR-007)",
      };
    }
    // Even explicit: force RESTRICTED handling — still allow user to store preference-like
    // but block clinical diagnostic keys entirely
    if (/diagnos|clinical|disorder|psicolog|psychiatr/i.test(input.key)) {
      return {
        ok: false,
        reason: "Classificações clínicas não são suportadas pelo Identity Engine",
      };
    }
  }

  if (
    input.sensitivity === "RESTRICTED" &&
    input.sourceType !== "user_explicit" &&
    input.sourceType !== "manual_entry"
  ) {
    return {
      ok: false,
      reason: "Claims RESTRICTED exigem entrada explícita do usuário",
    };
  }

  return { ok: true, reason: null };
}

export function defaultSensitivityFor(
  category: IdentityCategory,
  key: string
): IdentitySensitivity {
  if (isRestrictedIdentityKey(key, category)) return "RESTRICTED";
  if (category === "constraint" && /financ|health|saúde|saude/i.test(key)) {
    return "SENSITIVE";
  }
  if (category === "preference" || category === "communication") {
    return "PUBLIC_PREF";
  }
  return "STANDARD";
}

/** Workspace claims must not leak personal-only data into other users' reads — enforced at service. */
export function claimVisibleInScope(input: {
  claimUserId: string;
  claimWorkspaceId: string | null;
  viewerUserId: string;
  viewerWorkspaceId: string | null;
  mode: "personal" | "workspace";
}): boolean {
  if (input.claimUserId !== input.viewerUserId) return false;
  if (input.mode === "personal") {
    // Personal view: only claims without foreign workspace, or null workspace
    return (
      input.claimWorkspaceId == null ||
      input.claimWorkspaceId === input.viewerWorkspaceId
    );
  }
  // Workspace mode: claim must belong to that workspace
  return (
    input.claimWorkspaceId != null &&
    input.claimWorkspaceId === input.viewerWorkspaceId
  );
}
