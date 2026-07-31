/**
 * Sprint 9.0 — Aura Orchestrator public API.
 * Coordinates Identity, Memory, World, Knowledge, Cognitive, Discovery,
 * Decision, Scenario, Prioritization, Recommendation, Planner, Automation,
 * Agent Runtime. Does not replace any of them.
 */

export * from "@/lib/orchestrator/types";
export {
  emptyGlobalContextSlice,
  buildGlobalContext,
} from "@/lib/orchestrator/context-builder";
export {
  buildGlobalTimeline,
  mergeTimelineSources,
  mapLegacyTimelineKind,
  normalizeTimelineEvent,
  type TimelineInputEvent,
} from "@/lib/orchestrator/timeline";
export {
  parseCommandIntent,
  listCommandSuggestions,
  isCommandLikeQuery,
} from "@/lib/orchestrator/command-palette";
export {
  parseNaturalSearchQuery,
  resolveSearchQueryForIndex,
  describeNaturalSearch,
} from "@/lib/orchestrator/search-v2";
export {
  clearOrchestratorSessions,
  getOrchestratorSession,
  setSessionFocus,
  switchWorkspaceContext,
  setActiveProject,
  setActiveMission,
  setActivePlan,
  setActiveBusiness,
  setPersonality,
  type OrchestratorSessionState,
} from "@/lib/orchestrator/session";
export {
  emptySmartLinksBundle,
  buildSmartLinks,
  flattenSmartLinks,
  type SmartLinkCandidate,
} from "@/lib/orchestrator/smart-links";
export { prioritizeHomeWidgets } from "@/lib/orchestrator/dashboard";
export {
  crossNavFrom,
  moduleHref,
  moduleLabel,
  allModuleHrefs,
} from "@/lib/orchestrator/navigation";
export {
  DEFAULT_QUICK_ACTIONS,
  buildQuickActions,
} from "@/lib/orchestrator/quick-actions";
export {
  clearOrchestratorCache,
  cacheGet,
  cacheSet,
  cacheGetOrSet,
} from "@/lib/orchestrator/cache";
export { buildAuraHome } from "@/lib/orchestrator/home";
export {
  normalizePersonality,
  formatWithPersonality,
  PERSONALITY_TONES,
  PERSONALITY_LANGUAGES,
} from "@/lib/orchestrator/personality";
