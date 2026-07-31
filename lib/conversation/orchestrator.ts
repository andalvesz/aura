/**
 * handleAuraConversation — main Conversational Orchestrator entry.
 */

import { draftFromIntent } from "@/lib/conversation/action-proposal";
import { formatSourcesBlock, toCitations } from "@/lib/conversation/citations";
import {
  buildConversationFocus,
  resolveConversationContext,
} from "@/lib/conversation/context-resolver";
import {
  evaluateConversationPolicy,
  validateConfirmation,
} from "@/lib/conversation/conversation-policy";
import { sanitizeAuditMetadata } from "@/lib/conversation/history";
import { routeConversationIntent } from "@/lib/conversation/intent-router";
import {
  deterministicSuggestIntent,
  validateProviderIntentOutput,
} from "@/lib/conversation/providers/schema";
import {
  composeExplainAnswer,
  composeExplanation,
  composeNavigateAnswer,
  composeSearchAnswer,
  composeStatusAnswer,
  composeSummaryAnswer,
  composeUnknownAnswer,
} from "@/lib/conversation/response-composer";
import {
  findConversation,
  findPending,
  hashPayload,
  pushAudit,
} from "@/lib/conversation/store";
import type { ConversationState } from "@/lib/conversation/types";
import {
  getPlatformState,
  handlePlatformCommand,
} from "@/lib/capabilities";
import { handleBetaOpsCommand } from "@/lib/beta-ops/command-center";
import type {
  ConversationAuditEntry,
  ConversationMessage,
  ConversationRecord,
  HandleConversationInput,
  HandleConversationResult,
} from "@/lib/conversation/types";
import type { GlobalContext } from "@/lib/orchestrator/types";
import { ROUTE_REGISTRY } from "@/lib/conversation/types";

function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function audit(
  partial: Omit<ConversationAuditEntry, "id" | "createdAt"> & { createdAt?: string }
): ConversationAuditEntry {
  return {
    id: nid("aud"),
    createdAt: partial.createdAt ?? new Date().toISOString(),
    conversationId: partial.conversationId,
    userId: partial.userId,
    workspaceId: partial.workspaceId,
    event: partial.event,
    summary: partial.summary,
    metadata: sanitizeAuditMetadata(partial.metadata),
  };
}

export function startConversationPure(
  state: ConversationState,
  input: {
    viewer: HandleConversationInput["viewer"];
    focus?: HandleConversationInput["focus"];
    title?: string;
    now?: string;
  }
): { state: ConversationState; conversation: ConversationRecord } {
  const now = input.now ?? new Date().toISOString();
  const focus = buildConversationFocus({
    ...input.focus,
    workspaceId:
      input.focus?.workspaceId ?? input.viewer.workspaceId ?? null,
    contextMode:
      input.focus?.contextMode ??
      (input.viewer.workspaceId ? "workspace" : "personal"),
  });
  const conv: ConversationRecord = {
    id: nid("conv"),
    userId: input.viewer.userId,
    ownerId: input.viewer.userId,
    workspaceId: focus.workspaceId,
    title: input.title ?? "Nova conversa",
    status: "ACTIVE",
    focus,
    messageIds: [],
    draftIds: [],
    pendingActionIds: [],
    memoryChoice: "none",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    softDeleted: false,
    rowVersion: 1,
  };
  let next = {
    ...state,
    conversations: [conv, ...state.conversations],
  };
  next = pushAudit(
    next,
    audit({
      conversationId: conv.id,
      userId: input.viewer.userId,
      workspaceId: focus.workspaceId,
      event: "conversation_started",
      summary: "Conversa iniciada",
      metadata: { focus: focus.label },
      createdAt: now,
    })
  );
  return { state: next, conversation: conv };
}

export function handleAuraConversationPure(
  state: ConversationState,
  input: HandleConversationInput & {
    globalContext?: GlobalContext | null;
    searchHits?: Array<{
      id: string;
      title: string;
      href: string;
      kind: string;
    }>;
  }
): { state: ConversationState; result: HandleConversationResult } {
  const now = input.now ?? new Date().toISOString();
  let next = state;

  // Explicit confirm / cancel by ID (never by "sim" alone)
  if (input.confirmActionId) {
    return confirmActionPure(next, input, now);
  }
  if (input.cancelActionId) {
    return cancelActionPure(next, input, now);
  }

  let conv =
    (input.conversationId
      ? findConversation(next, input.conversationId)
      : null) ?? null;

  if (!conv) {
    const started = startConversationPure(next, {
      viewer: input.viewer,
      focus: input.focus,
      now,
    });
    next = started.state;
    conv = started.conversation;
  }

  if (input.focus) {
    const prevLabel = conv.focus.label;
    conv = {
      ...conv,
      focus: buildConversationFocus({ ...conv.focus, ...input.focus }),
      workspaceId:
        input.focus.workspaceId !== undefined
          ? input.focus.workspaceId
          : conv.workspaceId,
      updatedAt: now,
      rowVersion: conv.rowVersion + 1,
    };
    // Invalidate mixing: clear nothing from other users; just update focus
    if (prevLabel !== conv.focus.label) {
      next = pushAudit(
        next,
        audit({
          conversationId: conv.id,
          userId: input.viewer.userId,
          workspaceId: conv.workspaceId,
          event: "context_resolved",
          summary: `Contexto atualizado: ${conv.focus.label}`,
          metadata: { from: prevLabel, to: conv.focus.label },
          createdAt: now,
        })
      );
    }
  }

  const policy = evaluateConversationPolicy({
    viewer: input.viewer,
    message: input.message,
    conversation: conv,
  });

  if (!policy.allowed) {
    next = pushAudit(
      next,
      audit({
        conversationId: conv.id,
        userId: input.viewer.userId,
        workspaceId: conv.workspaceId,
        event:
          policy.event === "injection_blocked"
            ? "injection_blocked"
            : "policy_blocked",
        summary: policy.reason ?? "blocked",
        metadata: { event: policy.event },
        createdAt: now,
      })
    );
    return {
      state: upsertConversation(next, conv),
      result: {
        ok: false,
        error: policy.reason,
        conversation: conv,
        assistantMessage: null,
        intent: null,
        context: null,
        pendingAction: null,
        draft: null,
        navigationHref: null,
        blockedReason: policy.reason,
      },
    };
  }

  // Provider suggestion (deterministic) — validated, never trusted blindly
  next = pushAudit(
    next,
    audit({
      conversationId: conv.id,
      userId: input.viewer.userId,
      workspaceId: conv.workspaceId,
      event: "provider_invoked",
      summary: "provider_deterministic",
      metadata: {},
      createdAt: now,
    })
  );
  const rawSuggestion = deterministicSuggestIntent(input.message);
  const validated = validateProviderIntentOutput(rawSuggestion);
  const llmKind = validated.ok ? validated.value.kind : null;

  const intent = routeConversationIntent(input.message, {
    llmKind,
    focus: conv.focus,
  });

  next = pushAudit(
    next,
    audit({
      conversationId: conv.id,
      userId: input.viewer.userId,
      workspaceId: conv.workspaceId,
      event: "intent_classified",
      summary: intent.kind,
      metadata: { confidence: intent.confidence },
      createdAt: now,
    })
  );

  const policy2 = evaluateConversationPolicy({
    viewer: input.viewer,
    message: input.message,
    intent,
    conversation: conv,
  });
  if (!policy2.allowed) {
    return {
      state: upsertConversation(next, conv),
      result: {
        ok: false,
        error: policy2.reason,
        conversation: conv,
        assistantMessage: null,
        intent,
        context: null,
        pendingAction: null,
        draft: null,
        navigationHref: null,
        blockedReason: policy2.reason,
      },
    };
  }

  const extraSources =
    input.searchHits?.map((h) => ({
      id: h.id,
      kind: h.kind,
      title: h.title,
      href: h.href,
    })) ?? [];

  const context = resolveConversationContext({
    viewer: input.viewer,
    focus: conv.focus,
    global: input.globalContext ?? null,
    extraSources,
    now,
  });

  next = pushAudit(
    next,
    audit({
      conversationId: conv.id,
      userId: input.viewer.userId,
      workspaceId: conv.workspaceId,
      event: "context_resolved",
      summary: `sources=${context.sources.length}`,
      metadata: { budgetUsed: context.budgetUsed },
      createdAt: now,
    })
  );
  next = pushAudit(
    next,
    audit({
      conversationId: conv.id,
      userId: input.viewer.userId,
      workspaceId: conv.workspaceId,
      event: "sources_loaded",
      summary: "ok",
      metadata: { count: context.sources.length },
      createdAt: now,
    })
  );

  const userMsg: ConversationMessage = {
    id: nid("msg"),
    conversationId: conv.id,
    role: "user",
    content: input.message.slice(0, 4000),
    intentKind: intent.kind,
    citations: [],
    draftIds: [],
    pendingActionIds: [],
    navigationHref: null,
    explanation: null,
    createdAt: now,
    softDeleted: false,
  };

  let content = "";
  let navigationHref: string | null = null;
  let draft: import("@/lib/conversation/types").ConversationDraft | null = null;
  let pending: import("@/lib/conversation/types").ConversationPendingAction | null =
    null;

  const rules = [
    "intent_router_rules",
    "conversation_policy",
    "no_direct_tools",
    "action_registry_boundary",
  ];

  if (intent.kind === "EXPLAIN") {
    const expl = composeExplanation({ intent, context, rules });
    content = composeExplainAnswer(expl);
  } else if (intent.kind === "NAVIGATE") {
    navigationHref =
      intent.navigationHref ?? ROUTE_REGISTRY.home;
    content = composeNavigateAnswer(navigationHref, intent.targetType);
    next = pushAudit(
      next,
      audit({
        conversationId: conv.id,
        userId: input.viewer.userId,
        workspaceId: conv.workspaceId,
        event: "navigation_triggered",
        summary: navigationHref,
        metadata: {},
        createdAt: now,
      })
    );
  } else if (intent.kind === "SEARCH") {
    content = composeSearchAnswer(
      extraSources.length ? extraSources : context.sources,
      intent.query
    );
  } else if (intent.kind === "SUMMARIZE" || intent.kind === "COMPARE") {
    content = composeSummaryAnswer(intent, context);
  } else if (
    intent.kind === "ASK_STATUS" ||
    intent.kind === "REVIEW"
  ) {
    if (/aprendeu|aprender|prefer[eê]ncia|revert/i.test(intent.query)) {
      content = [
        "Sobre aprendizado contínuo:",
        "• Observo sinais e gero propostas revisáveis (AUTO_OBSERVE).",
        "• Nenhuma mudança é aplicada silenciosamente.",
        "• Abra /dashboard/learning para confirmar, rejeitar ou reverter com card explícito.",
        "• “Não aprenda isso” / reverter exigem ação no Learning Center (ID + hash).",
        "",
        formatSourcesBlock(toCitations(context.sources)),
      ].join("\n");
    } else if (
      /reportar\s+(um\s+)?problema|esta\s+resposta\s+n[aã]o\s+ajudou|quero\s+sugerir\s+(uma\s+)?melhoria|o\s+que\s+mudou\s+(na\s+)?(última|ultima)\s+vers[aã]o|existe\s+algum\s+problema\s+conhecido/i.test(
        intent.query
      )
    ) {
      const ops = handleBetaOpsCommand(intent.query);
      content = [
        ops.message || "Comando de feedback/changelog reconhecido.",
        ops.card?.kind === "feedback_form"
          ? `\nCard: ${ops.card.title} (tipo ${ops.card.type}) — use /dashboard/feedback ou “Reportar problema”.`
          : "",
        ops.card?.kind === "changelog"
          ? `\nVersão: ${ops.card.version ?? "—"}\n${ops.card.summary}\nProblemas conhecidos: ${(ops.card.knownIssues ?? []).join("; ") || "nenhum"}\nChangelog: /dashboard/changelog`
          : "",
        formatSourcesBlock(toCitations(context.sources)),
      ]
        .filter(Boolean)
        .join("\n");
    } else if (
      /skills?\s+instalad|capacidades\s+desativ|skill\s+de\s+projetos|permiss[oõ]es\s+(desta|da)\s+skill|configure\s+meu\s+workspace/i.test(
        intent.query
      )
    ) {
      const platform = handlePlatformCommand(
        getPlatformState(),
        {
          userId: input.viewer.userId,
          workspaceId: input.viewer.workspaceId,
          workspaceSlug: null,
          role: (input.viewer.role as "owner" | "admin" | "member" | "viewer") ?? "member",
          isWorkspaceMember: Boolean(input.viewer.workspaceId),
        },
        intent.query
      );
      content = [
        platform.message || "Comando de plataforma reconhecido.",
        platform.requiresConfirmation
          ? "\nAtivar/desativar exige card explícito e permissão — use /dashboard/skills."
          : "",
        platform.proposalCard
          ? `\nCard proposto: ${platform.proposalCard.title} (${platform.proposalCard.skillId}).`
          : "",
        "",
        `Skill Center: ${ROUTE_REGISTRY.skills}`,
        formatSourcesBlock(toCitations(context.sources)),
      ]
        .filter(Boolean)
        .join("\n");
    } else {
      content = composeStatusAnswer(intent, context);
    }
  } else if (intent.kind === "CREATE_DRAFT" ||
    intent.kind === "PROPOSE_PLAN" ||
    intent.kind === "PROPOSE_AUTOMATION" ||
    intent.kind === "START_AGENT_SESSION"
  ) {
    const proposed = draftFromIntent(intent, now);
    if (proposed) {
      draft = proposed.draft;
      pending = proposed.pending;
      content = [
        `Preparei um rascunho: **${draft.title}**`,
        "",
        draft.preview,
        "",
        "Nenhuma ação foi executada. Use o card de confirmação (ID + hash) para continuar.",
        "Texto como “sim” sozinho não confirma.",
      ].join("\n");
      next = {
        ...next,
        drafts: [draft, ...next.drafts],
        pendingActions: [pending, ...next.pendingActions],
      };
      next = pushAudit(
        next,
        audit({
          conversationId: conv.id,
          userId: input.viewer.userId,
          workspaceId: conv.workspaceId,
          event: "draft_prepared",
          summary: draft.kind,
          metadata: { draftId: draft.id },
          createdAt: now,
        })
      );
      next = pushAudit(
        next,
        audit({
          conversationId: conv.id,
          userId: input.viewer.userId,
          workspaceId: conv.workspaceId,
          event:
            intent.kind === "START_AGENT_SESSION"
              ? "agent_session_proposed"
              : "confirmation_presented",
          summary: pending.id,
          metadata: { payloadHash: pending.payloadHash },
          createdAt: now,
        })
      );
      conv = {
        ...conv,
        status: "WAITING_CONFIRMATION",
        draftIds: [draft.id, ...conv.draftIds],
        pendingActionIds: [pending.id, ...conv.pendingActionIds],
      };
    } else {
      content = composeUnknownAnswer(intent);
    }
  } else if (intent.kind === "UPDATE_CONTEXT") {
    content = `Contexto ativo: ${context.focus.label}. Informe projeto/missão/plano para trocar com precisão.`;
  } else if (intent.kind === "UNKNOWN") {
    content = composeUnknownAnswer(intent);
  } else {
    content = composeStatusAnswer(intent, context);
  }

  const explanation = composeExplanation({
    intent,
    context,
    rules,
    executedAnything: false,
    executedSummary: null,
  });

  const assistantMsg: ConversationMessage = {
    id: nid("msg"),
    conversationId: conv.id,
    role: "assistant",
    content,
    intentKind: intent.kind,
    citations: toCitations(context.sources),
    draftIds: draft ? [draft.id] : [],
    pendingActionIds: pending ? [pending.id] : [],
    navigationHref,
    explanation,
    createdAt: now,
    softDeleted: false,
  };

  conv = {
    ...conv,
    messageIds: [...conv.messageIds, userMsg.id, assistantMsg.id],
    updatedAt: now,
    rowVersion: conv.rowVersion + 1,
    title:
      conv.messageIds.length === 0
        ? input.message.slice(0, 60) || conv.title
        : conv.title,
  };

  next = {
    ...upsertConversation(next, conv),
    messages: [...next.messages, userMsg, assistantMsg],
  };
  next = pushAudit(
    next,
    audit({
      conversationId: conv.id,
      userId: input.viewer.userId,
      workspaceId: conv.workspaceId,
      event: "response_generated",
      summary: intent.kind,
      metadata: { messageId: assistantMsg.id },
      createdAt: now,
    })
  );

  if (input.memoryChoice && input.memoryChoice !== "none") {
    conv = { ...conv, memoryChoice: input.memoryChoice };
    next = upsertConversation(next, conv);
    // Never auto-promote to Memory Engine — only record preference
  }

  return {
    state: next,
    result: {
      ok: true,
      error: null,
      conversation: conv,
      assistantMessage: assistantMsg,
      intent,
      context,
      pendingAction: pending,
      draft,
      navigationHref,
      blockedReason: null,
    },
  };
}

function upsertConversation(
  state: ConversationState,
  conv: ConversationRecord
): ConversationState {
  const others = state.conversations.filter((c) => c.id !== conv.id);
  return { ...state, conversations: [conv, ...others] };
}

function confirmActionPure(
  state: ConversationState,
  input: HandleConversationInput,
  now: string
): { state: ConversationState; result: HandleConversationResult } {
  const pending = findPending(state, input.confirmActionId!);
  const conv = input.conversationId
    ? findConversation(state, input.conversationId)
    : state.conversations[0] ?? null;

  if (!pending || !conv) {
    return {
      state,
      result: {
        ok: false,
        error: "Confirmação inválida.",
        conversation: conv,
        assistantMessage: null,
        intent: null,
        context: null,
        pendingAction: null,
        draft: null,
        navigationHref: null,
        blockedReason: "invalid_confirmation",
      },
    };
  }

  const check = validateConfirmation({
    pending,
    payload: pending.payload,
    nowIso: now,
  });
  if (!check.ok) {
    const updated = {
      ...pending,
      status: check.error?.includes("expir") ? ("EXPIRED" as const) : pending.status,
    };
    return {
      state: {
        ...state,
        pendingActions: state.pendingActions.map((p) =>
          p.id === pending.id ? updated : p
        ),
      },
      result: {
        ok: false,
        error: check.error,
        conversation: conv,
        assistantMessage: null,
        intent: null,
        context: null,
        pendingAction: updated,
        draft: null,
        navigationHref: null,
        blockedReason: check.error,
      },
    };
  }

  // Confirmation only marks the conversation action as confirmed.
  // Actual Planner/Automation/Agent calls happen in the service layer adapters.
  const confirmed = { ...pending, status: "CONFIRMED" as const };
  let next: ConversationState = {
    ...state,
    pendingActions: state.pendingActions.map((p) =>
      p.id === pending.id ? confirmed : p
    ),
  };
  next = pushAudit(
    next,
    audit({
      conversationId: conv.id,
      userId: input.viewer.userId,
      workspaceId: conv.workspaceId,
      event: "action_confirmed",
      summary: pending.kind,
      metadata: {
        pendingId: pending.id,
        payloadHash: pending.payloadHash,
        hashCheck: hashPayload(pending.payload),
      },
      createdAt: now,
    })
  );

  const assistantMsg: ConversationMessage = {
    id: nid("msg"),
    conversationId: conv.id,
    role: "assistant",
    content: [
      `Confirmação registrada para “${pending.title}”.`,
      "A execução operacional, se aplicável, segue Planner / Automation / Agent Runtime / Action Registry — nunca direto do chat.",
    ].join("\n"),
    intentKind: "CONFIRM_ACTION",
    citations: [],
    draftIds: [],
    pendingActionIds: [pending.id],
    navigationHref: null,
    explanation: null,
    createdAt: now,
    softDeleted: false,
  };

  const updatedConv: ConversationRecord = {
    ...conv,
    status: "ACTIVE",
    messageIds: [...conv.messageIds, assistantMsg.id],
    updatedAt: now,
    rowVersion: conv.rowVersion + 1,
  };

  next = {
    ...upsertConversation(next, updatedConv),
    messages: [...next.messages, assistantMsg],
  };

  return {
    state: next,
    result: {
      ok: true,
      error: null,
      conversation: updatedConv,
      assistantMessage: assistantMsg,
      intent: null,
      context: null,
      pendingAction: confirmed,
      draft: null,
      navigationHref: null,
      blockedReason: null,
    },
  };
}

function cancelActionPure(
  state: ConversationState,
  input: HandleConversationInput,
  now: string
): { state: ConversationState; result: HandleConversationResult } {
  const pending = findPending(state, input.cancelActionId!);
  const conv = input.conversationId
    ? findConversation(state, input.conversationId)
    : null;
  if (!pending) {
    return {
      state,
      result: {
        ok: false,
        error: "Ação não encontrada.",
        conversation: conv,
        assistantMessage: null,
        intent: null,
        context: null,
        pendingAction: null,
        draft: null,
        navigationHref: null,
        blockedReason: "not_found",
      },
    };
  }
  const cancelled = { ...pending, status: "CANCELLED" as const };
  let next: ConversationState = {
    ...state,
    pendingActions: state.pendingActions.map((p) =>
      p.id === pending.id ? cancelled : p
    ),
  };
  next = pushAudit(
    next,
    audit({
      conversationId: conv?.id ?? null,
      userId: input.viewer.userId,
      workspaceId: input.viewer.workspaceId,
      event: "action_cancelled",
      summary: pending.id,
      metadata: {},
      createdAt: now,
    })
  );
  return {
    state: next,
    result: {
      ok: true,
      error: null,
      conversation: conv,
      assistantMessage: null,
      intent: null,
      context: null,
      pendingAction: cancelled,
      draft: null,
      navigationHref: null,
      blockedReason: null,
    },
  };
}

export function archiveConversationPure(
  state: ConversationState,
  viewer: HandleConversationInput["viewer"],
  conversationId: string,
  now = new Date().toISOString()
): ConversationState {
  const conv = findConversation(state, conversationId);
  if (!conv || conv.ownerId !== viewer.userId) return state;
  const updated = {
    ...conv,
    status: "ARCHIVED" as const,
    archivedAt: now,
    updatedAt: now,
    rowVersion: conv.rowVersion + 1,
  };
  let next = upsertConversation(state, updated);
  next = pushAudit(
    next,
    audit({
      conversationId,
      userId: viewer.userId,
      workspaceId: conv.workspaceId,
      event: "conversation_archived",
      summary: "archived",
      metadata: {},
      createdAt: now,
    })
  );
  return next;
}

export function deleteConversationPure(
  state: ConversationState,
  viewer: HandleConversationInput["viewer"],
  conversationId: string,
  now = new Date().toISOString()
): ConversationState {
  const conv = findConversation(state, conversationId);
  if (!conv || conv.ownerId !== viewer.userId) return state;
  const updated = {
    ...conv,
    status: "DELETED" as const,
    softDeleted: true,
    updatedAt: now,
    rowVersion: conv.rowVersion + 1,
  };
  let next = upsertConversation(state, updated);
  next = pushAudit(
    next,
    audit({
      conversationId,
      userId: viewer.userId,
      workspaceId: conv.workspaceId,
      event: "conversation_deleted",
      summary: "soft_deleted",
      metadata: {},
      createdAt: now,
    })
  );
  return next;
}
