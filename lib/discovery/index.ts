/**
 * Discovery Engine V1 — public barrel.
 * ADR-006
 */

export * from "@/lib/discovery/types";
export {
  confidenceBand,
  clampConfidence,
  calibrateDiscoveryConfidence,
} from "@/lib/discovery/confidence";
export {
  assertDiscoveryPrivacy,
  inferSensitivity,
  sanitizeDiscoveryText,
} from "@/lib/discovery/privacy";
export {
  createDiscoveryFeedback,
  createFeedback,
  statusAfterDiscoveryFeedback,
  statusAfterFeedback,
  createDiscoverySuppression,
  createSuppression,
  isDiscoverySuppressionActive,
  isSuppressionActive,
  matchesSuppression,
  recalculateConfidenceAfterFeedback,
} from "@/lib/discovery/feedback";
export { explainDiscovery } from "@/lib/discovery/explain";
export {
  buildDiscoveryContext,
  buildDiscoveryContextPure,
} from "@/lib/discovery/context";
export {
  registerDiscoveryDetector,
  unregisterDiscoveryDetector,
  getDiscoveryDetector,
  listDiscoveryDetectors,
  listDiscoveryDetectorsByType,
  clearDiscoveryRegistry,
  ensureBuiltinDiscoveryDetectors,
  runDiscoveryRegistry,
  opportunityDetector,
  riskDetector,
  gapDetector,
  dependencyDetector,
  stagnationDetector,
  duplicateDetector,
  unknownDetector,
} from "@/lib/discovery/registry";
export {
  createEmptyDiscoveryState,
  generateDiscoveriesPure,
  listDiscoveriesPure,
  getDiscoveryPure,
  searchDiscoveriesPure,
  explainDiscoveryPure,
  submitDiscoveryFeedbackPure,
  confirmDiscoveryPure,
  rejectDiscoveryPure,
  archiveDiscoveryPure,
  suppressSimilarDiscoveriesPure,
  getDiscoveryContextForBrainPure,
  bootstrapDiscoveryEnginePure,
  listDiscoveryAuditsPure,
  type DiscoveryEngineState,
  type EngineResult,
  type FeedbackResult,
} from "@/lib/discovery/engine";
export {
  getDiscoveryState,
  setDiscoveryState,
  clearDiscoveryState,
  discoveryCacheKey,
  getCachedDiscoveryRead,
  setCachedDiscoveryRead,
  invalidateDiscoveryCache,
  listDiscoveryAudits,
} from "@/lib/discovery/store";
export {
  buildAuraTimeline,
  buildAuraBrainTimeline,
  mergeTimelineSources,
  type TimelineSourceItem,
} from "@/lib/discovery/timeline";
export {
  searchAuraBrainSources,
  type AuraBrainSearchSources,
} from "@/lib/discovery/search";
