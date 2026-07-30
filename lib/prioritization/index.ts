/**
 * Sprint 7.2 Prioritization Engine — public API.
 * Answers: "O que merece mais atenção agora?"
 * executionInfluence: "none"
 */

export * from "@/lib/prioritization/types/types";
export * from "@/lib/prioritization/store";
export {
  buildPriorityContext,
  emptyPrioritySources,
} from "@/lib/prioritization/context/context";
export {
  registerPriorityEngine,
  unregisterPriorityEngine,
  getPriorityEngine,
  listPriorityEngines,
  listPriorityEnginesByKind,
  clearPriorityRegistry,
  ensureBuiltinPriorityEngines,
  runPriorityRegistry,
} from "@/lib/prioritization/registry/registry";
export {
  validatePriorityCandidate,
  filterValidPriorityCandidates,
} from "@/lib/prioritization/validators/validate";
export {
  collectPrioritySources,
  PRIORITY_PROVIDER_LAYERS,
} from "@/lib/prioritization/providers/sources";
export {
  generatePrioritiesPure,
  listPrioritiesPure,
  getPriorityPure,
  getHomePriorityWidgetPure,
  type PriorityListFilters,
} from "@/lib/prioritization/engine";
export {
  computePriorityScore,
  priorityRankScore,
  rankPriorityItems,
  SCORE_WEIGHTS,
  LEVEL_SCORE,
  REVERSIBILITY_SCORE,
  recencyFactor,
} from "@/lib/prioritization/ranking";
export {
  applyPriorityFeedbackPure,
  statusAfterPriorityFeedback,
} from "@/lib/prioritization/feedback";
export { explainPriorityPure } from "@/lib/prioritization/explain";
export { searchPrioritiesPure } from "@/lib/prioritization/search";
export { comparePrioritiesPure } from "@/lib/prioritization/compare";
export {
  impactPrioritizer,
  urgencyPrioritizer,
  confidencePrioritizer,
  opportunityPrioritizer,
  riskPrioritizer,
  reviewPrioritizer,
  stalePrioritizer,
} from "@/lib/prioritization/engines";
