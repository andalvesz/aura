/**
 * Conversation service — wires pure orchestrator to existing modules.
 * Confirmations never execute tools directly from chat.
 */

import {
  archiveConversationPure,
  deleteConversationPure,
  exportConversationPure,
  getConversationState,
  handleAuraConversationPure,
  listConversationsPure,
  conversationMessagesPure,
  setConversationState,
  startConversationPure,
  type ConversationViewer,
  type HandleConversationResult,
  type MemoryPromotionChoice,
} from "@/lib/conversation";
import { getDataContext } from "@/lib/supabase/services/context";
import { buildConversationFocus } from "@/lib/conversation/context-resolver";

async function viewerFromCtx(): Promise<ConversationViewer> {
  const ctx = await getDataContext();
  return {
    userId: ctx.userId,
    workspaceId: ctx.activeWorkspaceId,
    role: ctx.workspaceRole,
    isWorkspaceMember: Boolean(ctx.activeWorkspaceId && ctx.workspaceRole),
  };
}

export async function startConversation(input?: {
  title?: string;
  focus?: Parameters<typeof buildConversationFocus>[0];
}) {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  const { state: next, conversation } = startConversationPure(state, {
    viewer,
    focus: input?.focus,
    title: input?.title,
  });
  setConversationState(viewer.userId, next);
  return { conversation, error: null as string | null };
}

export async function sendConversationMessage(input: {
  conversationId?: string | null;
  message: string;
  focus?: Parameters<typeof buildConversationFocus>[0];
  memoryChoice?: MemoryPromotionChoice;
}): Promise<HandleConversationResult> {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);

  let globalContext = null;
  try {
    const { getOrchestratorGlobalContext } = await import(
      "@/lib/supabase/services/orchestrator.service"
    );
    globalContext = await getOrchestratorGlobalContext();
  } catch {
    globalContext = null;
  }

  let searchHits: Array<{ id: string; title: string; href: string; kind: string }> =
    [];
  const lower = input.message.toLowerCase();
  if (/encontr|busc|procur|documento|mem[oó]ria|plano/.test(lower)) {
    try {
      const { resolveSearchQueryForIndex } = await import("@/lib/orchestrator");
      const { runGlobalSearch } = await import("@/lib/search/global-search");
      const resolved = resolveSearchQueryForIndex(input.message);
      const res = await runGlobalSearch(resolved.query, {
        filter: resolved.filter,
        limit: 15,
      });
      searchHits = res.results.map((r) => ({
        id: r.id,
        title: r.title,
        href: r.moduleHref,
        kind: r.entity,
      }));
    } catch {
      searchHits = [];
    }
  }

  const { state: next, result } = handleAuraConversationPure(state, {
    conversationId: input.conversationId,
    message: input.message,
    viewer,
    focus: input.focus,
    memoryChoice: input.memoryChoice,
    globalContext,
    searchHits,
  });
  setConversationState(viewer.userId, next);
  return result;
}

export async function confirmConversationAction(input: {
  conversationId: string;
  actionId: string;
}): Promise<HandleConversationResult> {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  const { state: next, result } = handleAuraConversationPure(state, {
    conversationId: input.conversationId,
    message: "",
    viewer,
    confirmActionId: input.actionId,
  });
  setConversationState(viewer.userId, next);

  // Bridge to existing engines ONLY after hash-validated confirmation
  if (result.ok && result.pendingAction?.status === "CONFIRMED") {
    const kind = result.pendingAction.kind;
    try {
      if (kind === "propose_plan") {
        // Planner draft only — never approve/start
        // Caller may open Plan Center; we do not auto-generate without recommendation id
      } else if (kind === "propose_automation") {
        // Automation Engine remains authority — open center / require plan step UI
      } else if (kind === "start_agent") {
        // Agent Runtime remains authority
      }
    } catch {
      /* bridge best-effort */
    }
  }

  return result;
}

export async function cancelConversationAction(input: {
  conversationId: string;
  actionId: string;
}): Promise<HandleConversationResult> {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  const { state: next, result } = handleAuraConversationPure(state, {
    conversationId: input.conversationId,
    message: "",
    viewer,
    cancelActionId: input.actionId,
  });
  setConversationState(viewer.userId, next);
  return result;
}

export async function listConversations(opts?: {
  query?: string;
  includeArchived?: boolean;
}) {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  return {
    items: listConversationsPure(state, opts),
    error: null as string | null,
  };
}

export async function getConversation(id: string) {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  const conversation =
    state.conversations.find(
      (c) => c.id === id && !c.softDeleted && c.ownerId === viewer.userId
    ) ?? null;
  return {
    conversation,
    messages: conversation ? conversationMessagesPure(state, id) : [],
    drafts: conversation
      ? state.drafts.filter((d) => conversation.draftIds.includes(d.id))
      : [],
    pendingActions: conversation
      ? state.pendingActions.filter((p) =>
          conversation.pendingActionIds.includes(p.id)
        )
      : [],
    error: conversation ? null : "not_found",
  };
}

export async function updateConversationContext(input: {
  conversationId: string;
  focus: Parameters<typeof buildConversationFocus>[0];
}) {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  const conv = state.conversations.find((c) => c.id === input.conversationId);
  if (!conv || conv.ownerId !== viewer.userId) {
    return { error: "not_found" as string | null, conversation: null };
  }
  const focus = buildConversationFocus({ ...conv.focus, ...input.focus });
  const updated = {
    ...conv,
    focus,
    workspaceId: focus.workspaceId,
    updatedAt: new Date().toISOString(),
    rowVersion: conv.rowVersion + 1,
  };
  setConversationState(viewer.userId, {
    ...state,
    conversations: [
      updated,
      ...state.conversations.filter((c) => c.id !== updated.id),
    ],
  });
  return { conversation: updated, error: null as string | null };
}

export async function archiveConversation(id: string) {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  setConversationState(
    viewer.userId,
    archiveConversationPure(state, viewer, id)
  );
  return { error: null as string | null };
}

export async function deleteConversation(id: string) {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  setConversationState(
    viewer.userId,
    deleteConversationPure(state, viewer, id)
  );
  return { error: null as string | null };
}

export async function exportConversation(id: string) {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  const data = exportConversationPure(state, id);
  if (!data.conversation || data.conversation.ownerId !== viewer.userId) {
    return { error: "not_found" as string | null, export: null };
  }
  return { export: data, error: null as string | null };
}

export async function explainConversationResponse(messageId: string) {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  const msg = state.messages.find(
    (m) => m.id === messageId && !m.softDeleted
  );
  if (!msg) return { explanation: null, error: "not_found" as string | null };
  const conv = state.conversations.find((c) => c.id === msg.conversationId);
  if (!conv || conv.ownerId !== viewer.userId) {
    return { explanation: null, error: "forbidden" as string | null };
  }
  return { explanation: msg.explanation, error: null as string | null };
}

export async function getHomeConversationWidget() {
  const viewer = await viewerFromCtx();
  const state = getConversationState(viewer.userId);
  const recent = listConversationsPure(state, { limit: 5 });
  const pending = state.pendingActions
    .filter((p) => p.status === "PENDING")
    .slice(0, 5);
  const drafts = state.drafts
    .filter((d) => d.status === "PREVIEW")
    .slice(0, 5);
  return {
    recent,
    pendingConfirmations: pending,
    preparedDrafts: drafts,
  };
}
