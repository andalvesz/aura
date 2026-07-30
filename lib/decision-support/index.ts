/**
 * Sprint 7.0 Decision Support — public API.
 * executionInfluence: "none"
 */

export * from "@/lib/decision-support/types/types";
export * from "@/lib/decision-support/store";
export {
  buildDecisionContext,
  emptyDecisionSources,
} from "@/lib/decision-support/context/context";
export {
  registerDecisionEngine,
  unregisterDecisionEngine,
  getDecisionEngine,
  listDecisionEngines,
  listDecisionEnginesByKind,
  clearDecisionRegistry,
  ensureBuiltinDecisionEngines,
  runDecisionRegistry,
} from "@/lib/decision-support/registry/registry";
export {
  validateDecisionCandidate,
  filterValidCandidates,
} from "@/lib/decision-support/validators/validate";
export {
  collectDecisionSources,
  DECISION_PROVIDER_LAYERS,
} from "@/lib/decision-support/providers/sources";
export {
  generateDecisionsPure,
  listDecisionsPure,
  getDecisionPure,
  getHomeDecisionWidgetPure,
} from "@/lib/decision-support/engine";
export { rankDecisionCards, decisionRankScore } from "@/lib/decision-support/ranking";
export {
  applyDecisionFeedbackPure,
  statusAfterDecisionFeedback,
} from "@/lib/decision-support/feedback";
export { explainDecisionPure } from "@/lib/decision-support/explain";
export { searchDecisionsPure } from "@/lib/decision-support/search";
export {
  priorityEngine,
  tradeoffEngine,
  reviewEngine,
  opportunityRankingEngine,
  riskRankingEngine,
  missingInformationEngine,
  staleDecisionEngine,
} from "@/lib/decision-support/engines";
