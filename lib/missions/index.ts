/**
 * Mission Engine V1 — public surface.
 *
 * App code should consume only getMissionEngine() from the service.
 * Pure helpers are exported for tests and advanced callers.
 */

export type {
  BusinessExperimentDraft,
  BusinessHypothesisDraft,
  BusinessOpportunityDraft,
  Mission,
  MissionCreateInput,
  MissionDependency,
  MissionEngineInput,
  MissionEngineResult,
  MissionGoal,
  MissionInsight,
  MissionInsightKind,
  MissionMetric,
  MissionMilestone,
  MissionModuleId,
  MissionOfTheDay,
  MissionPhase,
  MissionProgress,
  MissionProgressBreakdown,
  MissionRecommendation,
  MissionResource,
  MissionRisk,
  MissionRiskLevel,
  MissionScore,
  MissionStatus,
  MissionSuggestedAction,
  MissionTask,
  MissionTaskStatus,
  MissionTemplate,
  MissionType,
} from "@/lib/missions/mission-types";

export { runMissionEngine } from "@/lib/missions/mission-engine";
export { runMissionPlanner, planMissionFromInput } from "@/lib/missions/mission-planner";
export {
  runMissionProgressPass,
  enrichMission,
  computeMissionProgress,
  computeMissionScore,
  buildMissionInsights,
  pickMissionOfTheDay,
} from "@/lib/missions/mission-progress";
export {
  listMissionTemplates,
  getMissionTemplateByType,
  getMissionTemplateById,
  resolveMissionTemplate,
} from "@/lib/missions/mission-templates";
export {
  detectDependencies,
  applyDependencyBlocks,
  detectRuntimeRisks,
  buildRecommendations,
  buildSuggestedActions,
  filterSafeAutomationProposals,
  isAutoExecutableRisk,
  collectInvolvedModules,
} from "@/lib/missions/mission-rules";
