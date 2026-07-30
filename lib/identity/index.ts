/**
 * Identity Engine V1 — public surface.
 *
 * App code should prefer getIdentityProfile() / mutations from the service.
 * Pure helpers exported for tests.
 */

export type * from "@/lib/identity/types";

export {
  clampConfidence,
  confidenceBand,
  sourceTrustBaseline,
  isLowTrustIsolatedSource,
  initialConfidenceForCreate,
  statusFromConfidence,
  applyObservation,
  applyConfirm,
  applyReject,
  applyCorrect,
  applyArchive,
  assertObservationAllowedAsGoal,
} from "@/lib/identity/confidence";

export {
  isRestrictedIdentityKey,
  assertObservationPrivacy,
  defaultSensitivityFor,
  claimVisibleInScope,
} from "@/lib/identity/privacy";

export {
  detectIdentityConflicts,
  markConflictGroups,
  wouldConflictWith,
} from "@/lib/identity/conflicts";

export {
  buildIdentityProfile,
  profileDecisionSafeClaims,
} from "@/lib/identity/profile";

export {
  createEmptyIdentityState,
  createIdentityClaimPure,
  observeIdentityEvidencePure,
  confirmIdentityClaimPure,
  rejectIdentityClaimPure,
  correctIdentityClaimPure,
  archiveIdentityClaimPure,
  deleteIdentityClaimPure,
  getIdentityProfilePure,
  getIdentityClaimsPure,
  explainIdentityClaimPure,
} from "@/lib/identity/engine";

export type { IdentityEngineState, EngineResult } from "@/lib/identity/engine";

export {
  buildBootstrapClaimInputs,
  applyBootstrapToState,
} from "@/lib/identity/bootstrap";

export type { IdentityBootstrapInput } from "@/lib/identity/bootstrap";

export {
  getIdentityState,
  setIdentityState,
  clearIdentityState,
  invalidateIdentityProfileCache,
  listIdentityAudits,
} from "@/lib/identity/store";
