/**
 * Sprint 9.2 — Continuous Learning Engine public API.
 */

export * from "@/lib/learning/types";
export {
  createEmptyLearningState,
  clearLearningState,
  getLearningState,
  setLearningState,
  hashPayload,
  findProposal,
  findSignal,
  findPattern,
  findApplication,
  sanitizeLearningMeta,
} from "@/lib/learning/store";
export {
  clearLearningRegistry,
  registerLearningAdapter,
  getLearningAdapter,
  listLearningAdapters,
  isEventRegistered,
  ensureBuiltinLearningAdapters,
} from "@/lib/learning/registry";
export {
  normalizeLearningSignal,
  ingestLearningSignal,
  type RawLearningEvent,
} from "@/lib/learning/signal-normalizer";
export { aggregateLearningPatterns } from "@/lib/learning/pattern-aggregator";
export { generateLearningProposals } from "@/lib/learning/proposal-generator";
export {
  canViewProposal,
  canMutateProposal,
  canApplyWorkspaceLearning,
  validateProposedChange,
  validateProposalConfirmation,
  proposalPayload,
} from "@/lib/learning/policy";
export {
  confirmLearningProposalPure,
  rejectLearningProposalPure,
  applyLearningProposalPure,
  completeLearningEvaluationPure,
  revertLearningProposalPure,
  archiveLearningProposalPure,
  explainLearningProposalPure,
} from "@/lib/learning/evaluation";
export {
  runLearningCyclePure,
  getLearningHomeWidgetPure,
  listLearningProposalsPure,
} from "@/lib/learning/engine";
export {
  validateProviderProposalDraft,
  deterministicProposalCopy,
} from "@/lib/learning/providers/schema";
