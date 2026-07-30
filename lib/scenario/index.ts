/**
 * Sprint 7.1 Scenario Engine — public API.
 * executionInfluence: "none"
 */

export * from "@/lib/scenario/types/types";
export * from "@/lib/scenario/store";
export {
  buildScenarioContext,
  emptyScenarioSources,
} from "@/lib/scenario/context/context";
export {
  registerScenarioEngine,
  unregisterScenarioEngine,
  getScenarioEngine,
  listScenarioEngines,
  clearScenarioRegistry,
  ensureBuiltinScenarioEngines,
  runScenarioRegistry,
} from "@/lib/scenario/registry/registry";
export {
  validateScenarioCandidate,
  filterValidScenarioCandidates,
} from "@/lib/scenario/validators/validate";
export {
  collectScenarioSources,
  SCENARIO_PROVIDER_LAYERS,
} from "@/lib/scenario/providers/sources";
export {
  simulateScenariosPure,
  listScenariosPure,
  getScenarioPure,
  getHomeScenarioWidgetPure,
} from "@/lib/scenario/engine";
export {
  applyScenarioFeedbackPure,
  statusAfterScenarioFeedback,
} from "@/lib/scenario/feedback";
export { explainScenarioPure } from "@/lib/scenario/explain";
export { searchScenariosPure } from "@/lib/scenario/search";
export { compareScenariosPure } from "@/lib/scenario/compare";
export {
  whatIfEngine,
  comparisonEngine,
  typedScenarioEngines,
  bestCaseEngine,
  worstCaseEngine,
  mostLikelyEngine,
} from "@/lib/scenario/engines";
