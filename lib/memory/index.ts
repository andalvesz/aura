/**
 * Memory Engine V1 — public surface.
 */

export type * from "@/lib/memory/types";

export {
  experienceFingerprint,
  normalizeExperience,
  validateExperienceInput,
  suggestMemoryTypeFromExperience,
} from "@/lib/memory/experience";

export {
  clampScore,
  confidenceBand,
  sourceTrustBaseline,
  isIsolatedInteractionSource,
  initialMemoryConfidence,
  initialImportance,
  initialWeight,
  reinforceConfidence,
  applyContradictionPenalty,
} from "@/lib/memory/confidence";

export {
  assertMemoryPrivacy,
  defaultSensitivityFor,
  isRestrictedMemoryText,
  memoryVisibleInScope,
} from "@/lib/memory/privacy";

export {
  defaultRetentionFor,
  computeValidUntil,
  isExpired,
  shouldHardDelete,
} from "@/lib/memory/retention";

export {
  evaluateMemoryForPromotionPure,
  promotionBand,
} from "@/lib/memory/promotion";

export type { IdentityGateSnapshot } from "@/lib/memory/promotion";

export {
  createEmptyMemoryState,
  recordExperiencePure,
  createMemoryPure,
  getMemoryPure,
  listMemoriesPure,
  searchMemoriesPure,
  getContextualMemoriesPure,
  getMemoriesBySubjectPure,
  getMemoryTimelinePure,
  explainMemoryPure,
  explainMemoryText,
  correctMemoryPure,
  disputeMemoryPure,
  archiveMemoryPure,
  deleteMemoryPure,
  submitMemoryFeedbackPure,
  evaluateMemoryForPromotion,
  markPromotionAppliedPure,
  expireMemoriesPure,
  getMemoryContextForBrainPure,
  attachEvidencePure,
} from "@/lib/memory/engine";

export type { MemoryEngineState, EngineResult } from "@/lib/memory/engine";

export {
  buildBootstrapMemoryInputs,
  applyBootstrapToMemoryState,
} from "@/lib/memory/bootstrap";

export type {
  MemoryBootstrapInput,
  MemoryBootstrapReport,
} from "@/lib/memory/bootstrap";

export {
  getMemoryState,
  setMemoryState,
  clearMemoryState,
  invalidateMemoryCache,
  listMemoryAudits,
  memoryCacheKey,
  getCachedMemoryRead,
  setCachedMemoryRead,
} from "@/lib/memory/store";
