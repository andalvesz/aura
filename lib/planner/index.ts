/**
 * Sprint 8.0 Planner V1 — public API.
 * Answers: "Como posso transformar esta recomendação em um plano?"
 * Distinct from lib/aura-brain/planner (action proposals).
 * executionInfluence: "none"
 */

export * from "@/lib/planner/types/types";
export * from "@/lib/planner/store";
export {
  buildPlanContext,
  emptyPlanSources,
} from "@/lib/planner/context/context";
export {
  registerPlannerEngine,
  unregisterPlannerEngine,
  getPlannerEngine,
  listPlannerEngines,
  clearPlannerRegistry,
  ensureBuiltinPlannerEngines,
  runPlannerRegistry,
  PLANNER_PIPELINE_ORDER,
} from "@/lib/planner/registry/registry";
export {
  validatePlanDraft,
  validatePlanForApproval,
} from "@/lib/planner/validators/validate";
export {
  collectPlanSources,
  PLAN_PROVIDER_LAYERS,
} from "@/lib/planner/providers/sources";
export {
  detectCircularDependencies,
  topologicalOrder,
  analyzePlanDependencies,
} from "@/lib/planner/dependencies/detect";
export {
  generatePlanPure,
  listPlansPure,
  getPlanPure,
  getHomePlanWidgetPure,
  seedDraftFromSource,
  type PlanListFilters,
} from "@/lib/planner/engine";
export {
  submitPlanForReviewPure,
  approvePlanPure,
  rejectPlanPure,
  startPlanPure,
  pausePlanPure,
  completeStepPure,
  completePlanPure,
  archivePlanPure,
  reorderStepsPure,
  updatePlanStatusPure,
  duplicatePlanPure,
} from "@/lib/planner/approval";
export { applyPlanFeedbackPure } from "@/lib/planner/feedback";
export { addPlanCommentPure } from "@/lib/planner/comments";
export { assignCollaboratorPure } from "@/lib/planner/collaboration";
export { explainPlanPure } from "@/lib/planner/explain";
export {
  searchPlansPure,
  searchPlanEntitiesPure,
} from "@/lib/planner/search";
export {
  goalBreakdownEngine,
  stepSequencingEngine,
  dependencyEngine,
  resourcePlanningEngine,
  riskPlanningEngine,
  milestoneEngine,
  reviewCadenceEngine,
} from "@/lib/planner/engines";
export { baseManualDraft } from "@/lib/planner/templates/templates";
export {
  suggestPlanWindow,
  suggestStepDates,
  addDaysIso,
} from "@/lib/planner/scheduling/dates";
