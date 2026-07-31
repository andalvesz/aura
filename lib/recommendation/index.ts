/**
 * Sprint 7.3 Recommendation Engine — public API.
 * Answers: "O que faz mais sentido considerando tudo que eu sei até agora?"
 * executionInfluence: "none"
 */

export * from "@/lib/recommendation/types/types";
export * from "@/lib/recommendation/store";
export {
  buildRecommendationContext,
  emptyRecommendationSources,
} from "@/lib/recommendation/context/context";
export {
  registerRecommendationEngine,
  unregisterRecommendationEngine,
  getRecommendationEngine,
  listRecommendationEngines,
  listRecommendationEnginesByType,
  clearRecommendationRegistry,
  ensureBuiltinRecommendationEngines,
  runRecommendationRegistry,
} from "@/lib/recommendation/registry/registry";
export {
  validateRecommendationCandidate,
  filterValidRecommendationCandidates,
} from "@/lib/recommendation/validators/validate";
export {
  collectRecommendationSources,
  RECOMMENDATION_PROVIDER_LAYERS,
} from "@/lib/recommendation/providers/sources";
export {
  generateRecommendationsPure,
  listRecommendationsPure,
  getRecommendationPure,
  getHomeRecommendationWidgetPure,
  type RecommendationListFilters,
} from "@/lib/recommendation/engine";
export {
  computeRecommendationScore,
  rankRecommendationItems,
  SCORE_WEIGHTS,
  LEVEL_SCORE,
  REVERSIBILITY_SCORE,
  recencyFactor,
} from "@/lib/recommendation/ranking";
export {
  applyRecommendationFeedbackPure,
  statusAfterRecommendationFeedback,
} from "@/lib/recommendation/feedback";
export { explainRecommendationPure } from "@/lib/recommendation/explain";
export { searchRecommendationsPure } from "@/lib/recommendation/search";
export { annotateRecommendationConflicts } from "@/lib/recommendation/contradictions";
export {
  opportunityRecommender,
  riskRecommender,
  projectRecommender,
  learningRecommender,
  relationshipRecommender,
  reviewRecommender,
} from "@/lib/recommendation/engines";
