/**
 * Sprint 8.2 — Aura Agent Runtime V1 public API.
 * Controlled agents only. Tools = Action Registry wrappers.
 */

export * from "@/lib/agent-runtime/types";
export * from "@/lib/agent-runtime/store";
export {
  registerAgent,
  clearAgentRegistry,
  getAgentDefinition,
  listAgentDefinitions,
  ensureBuiltinAgents,
  isActionAllowedForAgent,
  BUILTIN_AGENTS,
  GLOBALLY_BLOCKED_ACTIONS,
} from "@/lib/agent-runtime/registry";
export {
  createAgentSessionPure,
  runAgentSessionPure,
  confirmAgentStepPure,
  answerAgentInputPure,
  pauseAgentSessionPure,
  cancelAgentSessionPure,
  listAgentSessionsPure,
  getAgentSessionPure,
  explainAgentSessionPure,
  getHomeAgentWidgetPure,
  enableAgentPure,
  listSessionStepsPure,
  canViewSession,
  canMutateSession,
} from "@/lib/agent-runtime/runtime";
export {
  buildAgentContext,
  emptyContextSlice,
  detectPromptInjection,
  sanitizeContextAgainstInjection,
} from "@/lib/agent-runtime/context-builder";
export {
  evaluateStepPolicy,
  canConfirmSession,
} from "@/lib/agent-runtime/policy-engine";
export { checkBudgets, formatBudgetReport } from "@/lib/agent-runtime/budget";
export { buildCheckpoint, alreadyExecuted } from "@/lib/agent-runtime/checkpoints";
export { verifyStepResult } from "@/lib/agent-runtime/verification";
export {
  classifyRecovery,
  acquireSessionLease,
  releaseSessionLease,
} from "@/lib/agent-runtime/recovery";
export {
  suggestNextStep,
  deterministicSuggest,
  validateProviderOutput,
} from "@/lib/agent-runtime/provider";
export {
  getAgentTool,
  resolveAgentTool,
  invokeAgentTool,
  rejectClientProvidedTools,
} from "@/lib/agent-runtime/tools/boundary";
