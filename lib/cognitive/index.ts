/**
 * Cognitive Engine V1 — public barrel.
 * ADR-008 · RFC-005
 */

export * from "@/lib/cognitive/types";
export * from "@/lib/cognitive/confidence";
export * from "@/lib/cognitive/privacy";
export * from "@/lib/cognitive/evidence";
export {
  buildCognitiveContext,
  buildCognitiveContextPure,
} from "@/lib/cognitive/context";
export { detectPatterns } from "@/lib/cognitive/patterns";
export { detectConflicts } from "@/lib/cognitive/conflicts";
export { analyzeProgress } from "@/lib/cognitive/progress";
export { generateHypotheses } from "@/lib/cognitive/hypotheses";
export { generateInsights } from "@/lib/cognitive/insights";
export { generateRecommendations } from "@/lib/cognitive/recommendations";
export {
  validateCognitiveArtifact,
  applyValidatorConfidence,
} from "@/lib/cognitive/validation";
export {
  explainCognitiveArtifact,
  explainPattern,
  explainInsight,
  explainRecommendation,
} from "@/lib/cognitive/explain";
export {
  createEmptyCognitiveState,
  generateCognitiveArtifactsPure,
  listCognitiveArtifactsPure,
  getCognitiveArtifactPure,
  searchCognitiveArtifactsPure,
  explainCognitiveArtifactPure,
  submitCognitiveFeedbackPure,
  archiveCognitiveArtifactPure,
  deleteCognitiveArtifactPure,
  revalidateCognitiveArtifactPure,
  getCognitiveContextForBrainPure,
  bootstrapCognitiveEnginePure,
  type CognitiveEngineState,
  type EngineResult,
} from "@/lib/cognitive/engine";
export {
  getCognitiveState,
  setCognitiveState,
  clearCognitiveState,
  cognitiveCacheKey,
  getCachedCognitiveRead,
  setCachedCognitiveRead,
  invalidateCognitiveCache,
  listCognitiveAudits,
} from "@/lib/cognitive/store";
export {
  NoneReasoningProvider,
  defaultProvider,
  validateProviderDraft,
  withProviderTimeout,
  applyProviderClarity,
  type CognitiveReasoningProvider,
} from "@/lib/cognitive/providers";
