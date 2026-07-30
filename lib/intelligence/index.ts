/**
 * Aura Intelligence Engine V1 — public surface.
 *
 * App code should prefer `getAuraIntelligence()` from the service.
 * Pure engine helpers are exported for tests and advanced callers.
 */

export type {
  AuraIntelligenceInput,
  AuraIntelligenceResult,
  ExplainWithAI,
  ExplainWithAIInput,
  IntelligenceAlert,
  IntelligenceInsight,
  IntelligenceModule,
  IntelligencePriority,
  IntelligencePriorityLevel,
  IntelligenceRecommendation,
  IntelligenceRule,
  IntelligenceScore,
  PersonalIntelligenceDTO,
  RuleResult,
  RuleStatus,
  WorkspaceIntelligenceDTO,
} from "@/lib/intelligence/types";

export { runAuraIntelligenceEngine, ensureDefaultPlugins } from "@/lib/intelligence/engine";
export {
  registerRule,
  registerRules,
  clearRules,
  listRules,
  evaluateRules,
  registerDefaultPlugins,
  BudgetCriticalRule,
  OverdueEventRule,
  CalendarConflictRule,
  HabitBrokenRule,
  WorkoutOverdueRule,
  GoalDeadlineRule,
  TripSoonRule,
  LanguageStreakRule,
  ExpertBrainErrorRule,
  ExpertBrainQueueRule,
} from "@/lib/intelligence/rules";
export {
  getAuraIntelligence,
  getAuraIntelligenceFromMyDay,
} from "@/lib/intelligence/services/intelligence.service";
export {
  invalidateAuraIntelligenceCache,
} from "@/lib/intelligence/invalidate";
export type {
  CacheInvalidationReason,
  InvalidateAuraIntelligenceCacheParams,
} from "@/lib/intelligence/invalidate";
export {
  emptyPersonalDTO,
  mapMyDayToPersonalDTO,
  mapWorkspaceToDTO,
  buildPersonalIntelligenceInput,
  buildWorkspaceIntelligenceInput,
} from "@/lib/intelligence/map";
