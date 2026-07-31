/**
 * Sprint 8.1 — Automation Engine V1 public API.
 * Consolidates Aura Brain Action Registry + autonomy. No second registry.
 * No autonomous agents. Plans remain revisable (executionInfluence none).
 */

export * from "@/lib/automation/types/types";
export * from "@/lib/automation/store";
export {
  proposeAutomationPure,
  prepareAutomationPure,
  confirmAutomationPure,
  executeAutomationPure,
  scheduleAutomationPure,
  cancelAutomationPure,
  retryAutomationPure,
  undoAutomationPure,
  listAutomationsPure,
  getAutomationPure,
  explainAutomationPure,
  getHomeAutomationWidgetPure,
  processEligibleAutomationsPure,
  revokePendingConfirmationsPure,
  canViewAutomation,
  canMutateAutomation,
} from "@/lib/automation/engine";
export {
  evaluateExecutionGates,
  evaluateAutoSafeGates,
  classifyError,
  isRetryable,
  dailyCountFor,
  bumpDailyCount,
  cooldownActive,
} from "@/lib/automation/gates";
export {
  acquireLease,
  releaseLease,
  conditionalUpdate,
  hashPayload,
  newId,
} from "@/lib/automation/lease";
export { searchAutomationsPure } from "@/lib/automation/search";
export { listAutomationAuditPure } from "@/lib/automation/audit";
