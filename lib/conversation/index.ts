/**
 * Sprint 9.1 — Conversational Command Center public API.
 */

export * from "@/lib/conversation/types";
export {
  createEmptyConversationState,
  clearConversationState,
  getConversationState,
  setConversationState,
  hashPayload,
  findConversation,
  findPending,
  findDraft,
} from "@/lib/conversation/store";
export { routeConversationIntent, intentsAreCompatible } from "@/lib/conversation/intent-router";
export {
  buildConversationFocus,
  resolveConversationContext,
  filterPrivateMemberData,
} from "@/lib/conversation/context-resolver";
export {
  evaluateConversationPolicy,
  validateConfirmation,
  pendingExpired,
  canViewConversation,
  canMutateConversation,
  clearConversationRateLimits,
  CONVERSATION_BUDGET,
} from "@/lib/conversation/conversation-policy";
export {
  detectPromptInjection,
  wrapUntrustedContent,
  stripUntrustedInstructions,
} from "@/lib/conversation/injection";
export {
  toCitations,
  formatSourcesBlock,
  assertNoInventedSources,
} from "@/lib/conversation/citations";
export {
  composeExplanation,
  composeStatusAnswer,
  composeSummaryAnswer,
  composeSearchAnswer,
  composeNavigateAnswer,
  composeUnknownAnswer,
  composeExplainAnswer,
} from "@/lib/conversation/response-composer";
export {
  prepareDraft,
  proposePendingAction,
  draftFromIntent,
} from "@/lib/conversation/action-proposal";
export {
  listConversationsPure,
  conversationMessagesPure,
  exportConversationPure,
  sanitizeAuditMetadata,
} from "@/lib/conversation/history";
export {
  handleAuraConversationPure,
  startConversationPure,
  archiveConversationPure,
  deleteConversationPure,
} from "@/lib/conversation/orchestrator";
export {
  validateProviderIntentOutput,
  deterministicSuggestIntent,
  providerTimeoutFallback,
} from "@/lib/conversation/providers/schema";
