/**
 * Consolidated Identity Profile — read-only aggregation.
 * Never mutates claims. Never invents data.
 */

import { detectIdentityConflicts } from "@/lib/identity/conflicts";
import type {
  IdentityClaim,
  IdentityClaimView,
  IdentityContextScope,
  IdentityProfile,
} from "@/lib/identity/types";

function explainClaim(claim: IdentityClaim): string {
  const evid =
    claim.evidence.length > 0
      ? claim.evidence
          .slice(-3)
          .map((e) => e.summary)
          .join("; ")
      : "sem evidências adicionais";
  const src = claim.sourceType;
  return `Status ${claim.status} · confiança ${claim.confidence} (${claim.confidenceBand}) · origem ${src} · ${evid}`;
}

function toView(claim: IdentityClaim): IdentityClaimView {
  return { claim, explanation: explainClaim(claim) };
}

export function buildIdentityProfile(input: {
  userId: string;
  workspaceId?: string | null;
  claims: IdentityClaim[];
  contextScope?: IdentityContextScope | "all";
  asOf?: string;
}): IdentityProfile {
  const asOf = input.asOf ?? new Date().toISOString();
  const scope = input.contextScope ?? "all";

  let rejected = 0;
  let archived = 0;

  const scoped = input.claims.filter((c) => {
    if (c.userId !== input.userId) return false;
    if (input.workspaceId) {
      // workspace view: only that workspace's claims
      if (c.workspaceId !== input.workspaceId) return false;
    } else {
      // personal: exclude other workspaces' exclusive claims
      if (c.workspaceId != null) return false;
    }
    if (scope !== "all" && c.contextScope !== scope && c.contextScope !== "global") {
      return false;
    }
    return true;
  });

  const usable: IdentityClaim[] = [];
  for (const c of scoped) {
    if (c.status === "REJECTED") {
      rejected += 1;
      continue;
    }
    if (c.status === "ARCHIVED") {
      archived += 1;
      continue;
    }
    if (c.status === "UNKNOWN") continue;
    if (c.validUntil && c.validUntil < asOf) {
      usable.push({ ...c, status: "OUTDATED" });
      continue;
    }
    usable.push(c);
  }

  const conflicts = detectIdentityConflicts(usable);
  const conflictIds = new Set(conflicts.flatMap((c) => c.claimIds));

  const confirmed = usable
    .filter((c) => c.status === "CONFIRMED" || c.status === "LEARNED")
    .map(toView);
  const likely = usable
    .filter((c) => c.status === "LIKELY")
    .map(toView);
  const hypotheses = usable
    .filter(
      (c) =>
        c.status === "HYPOTHESIS" ||
        c.status === "OBSERVED" ||
        conflictIds.has(c.id)
    )
    .filter(
      (c) =>
        c.status === "HYPOTHESIS" ||
        c.status === "OBSERVED" ||
        (conflictIds.has(c.id) &&
          c.status !== "CONFIRMED" &&
          c.status !== "LEARNED" &&
          c.status !== "LIKELY")
    )
    .map(toView);

  // Deduplicate hypotheses list if also in confirmed/likely
  const confirmedIds = new Set(confirmed.map((v) => v.claim.id));
  const likelyIds = new Set(likely.map((v) => v.claim.id));
  const hypothesesClean = hypotheses.filter(
    (v) => !confirmedIds.has(v.claim.id) && !likelyIds.has(v.claim.id)
  );

  const outdated = usable
    .filter((c) => c.status === "OUTDATED")
    .map(toView);

  const preferenceHints = confirmed
    .filter((v) => v.claim.category === "preference" || v.claim.category === "communication")
    .map((v) => v.claim.label)
    .slice(0, 8);
  const roleHints = confirmed
    .filter((v) => v.claim.category === "role")
    .map((v) => v.claim.label)
    .slice(0, 8);
  const constraintHints = confirmed
    .filter((v) => v.claim.category === "constraint")
    .map((v) => v.claim.label)
    .slice(0, 8);

  const toneClaim = confirmed.find(
    (v) =>
      v.claim.key === "communication.tone" ||
      v.claim.key === "preferred_tone"
  );

  return {
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    contextScope: scope,
    confirmed,
    likely,
    hypotheses: hypothesesClean,
    conflicts,
    outdated,
    summary: {
      confirmedCount: confirmed.length,
      likelyCount: likely.length,
      hypothesisCount: hypothesesClean.length,
      conflictCount: conflicts.length,
      preferenceHints,
      roleHints,
      constraintHints,
      communicationTone:
        toneClaim && typeof toneClaim.claim.value === "string"
          ? toneClaim.claim.value
          : null,
    },
    meta: {
      generatedAt: asOf,
      activeClaimCount: usable.length,
      excludedRejected: rejected,
      excludedArchived: archived,
    },
  };
}

/** Hypotheses must not drive important decisions. */
export function profileDecisionSafeClaims(
  profile: IdentityProfile
): IdentityClaim[] {
  return profile.confirmed.map((v) => v.claim);
}
