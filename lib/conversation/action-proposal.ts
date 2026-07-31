/**
 * Action proposals — drafts / plan / automation / agent.
 * Never executes. Confirmation requires explicit card + payload hash.
 */

import {
  CONVERSATION_BUDGET,
} from "@/lib/conversation/conversation-policy";
import { hashPayload } from "@/lib/conversation/store";
import type {
  ConversationDraft,
  ConversationDraftKind,
  ConversationIntent,
  ConversationPendingAction,
} from "@/lib/conversation/types";

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function prepareDraft(input: {
  kind: ConversationDraftKind;
  title: string;
  preview: string;
  payload: Record<string, unknown>;
  nowIso: string;
}): ConversationDraft {
  const expires = new Date(
    new Date(input.nowIso).getTime() + CONVERSATION_BUDGET.confirmationTtlMs
  ).toISOString();
  return {
    id: id("draft"),
    kind: input.kind,
    title: input.title,
    preview: input.preview,
    payload: input.payload,
    riskLevel: "LOW",
    requiresConfirmation: true,
    status: "PREVIEW",
    createdAt: input.nowIso,
    expiresAt: expires,
  };
}

export function proposePendingAction(input: {
  kind: ConversationPendingAction["kind"];
  title: string;
  origin: string;
  changesSummary: string;
  payload: Record<string, unknown>;
  riskLevel?: ConversationPendingAction["riskLevel"];
  reversibility?: ConversationPendingAction["reversibility"];
  nowIso: string;
}): ConversationPendingAction {
  const expires = new Date(
    new Date(input.nowIso).getTime() + CONVERSATION_BUDGET.confirmationTtlMs
  ).toISOString();
  return {
    id: id("pact"),
    kind: input.kind,
    title: input.title,
    origin: input.origin,
    changesSummary: input.changesSummary,
    riskLevel: input.riskLevel ?? "LOW",
    reversibility: input.reversibility ?? "reversible",
    expiresAt: expires,
    payloadHash: hashPayload(input.payload),
    payload: input.payload,
    status: "PENDING",
  };
}

export function draftFromIntent(
  intent: ConversationIntent,
  nowIso: string
): { draft: ConversationDraft; pending: ConversationPendingAction } | null {
  if (intent.kind === "CREATE_DRAFT") {
    const kind: ConversationDraftKind = /mem[oó]ria/i.test(intent.query)
      ? "memory"
      : /nota/i.test(intent.query)
        ? "note"
        : /ideia|neg[oó]cio/i.test(intent.query)
          ? "business_idea"
          : /evento/i.test(intent.query)
            ? "event"
            : /automa/i.test(intent.query)
              ? "automation"
              : /plano/i.test(intent.query)
                ? "plan"
                : "note";
    const draft = prepareDraft({
      kind,
      title: `Rascunho: ${kind}`,
      preview: intent.query.slice(0, 280),
      payload: {
        kind,
        query: intent.query,
        projectId: intent.projectId,
        planId: intent.planId,
      },
      nowIso,
    });
    const pending = proposePendingAction({
      kind: "save_draft",
      title: `Salvar rascunho (${kind})`,
      origin: "conversation",
      changesSummary: "Cria rascunho estruturado — não publica nem executa.",
      payload: { draftId: draft.id, ...draft.payload },
      nowIso,
    });
    return { draft, pending };
  }

  if (intent.kind === "PROPOSE_PLAN") {
    const draft = prepareDraft({
      kind: "plan",
      title: "Rascunho de plano",
      preview:
        "Plano DRAFT gerado a partir da recomendação/contexto. Não aprova nem inicia.",
      payload: {
        source: "recommendation",
        recommendationId: intent.targetId,
        query: intent.query,
      },
      nowIso,
    });
    const pending = proposePendingAction({
      kind: "propose_plan",
      title: "Salvar plano como DRAFT no Planner",
      origin: "conversation→planner",
      changesSummary:
        "Chama Planner V1 para criar DRAFT. Não aprova, não inicia, não executa.",
      payload: { draftId: draft.id, ...draft.payload },
      riskLevel: "LOW",
      nowIso,
    });
    return { draft, pending };
  }

  if (intent.kind === "PROPOSE_AUTOMATION") {
    const draft = prepareDraft({
      kind: "automation",
      title: "Proposta de automação",
      preview:
        "Automação PROPOSED via Automation Engine. Gates e confirmação obrigatórios.",
      payload: {
        planId: intent.planId,
        query: intent.query,
      },
      nowIso,
    });
    const pending = proposePendingAction({
      kind: "propose_automation",
      title: "Preparar automação (Engine 8.1)",
      origin: "conversation→automation",
      changesSummary:
        "Delega ao Automation Engine. Nunca executa fora dos gates existentes.",
      payload: { draftId: draft.id, ...draft.payload },
      riskLevel: "MEDIUM",
      reversibility: "partial",
      nowIso,
    });
    return { draft, pending };
  }

  if (intent.kind === "START_AGENT_SESSION") {
    const draft = prepareDraft({
      kind: "internal_reply",
      title: "Sessão de agente (DRAFT)",
      preview:
        "Cria sessão DRAFT no Agent Runtime (ex.: Plan Assistant). Não inicia sem confirmação.",
      payload: {
        agentId: "plan_assistant",
        planId: intent.planId,
        query: intent.query,
      },
      nowIso,
    });
    const pending = proposePendingAction({
      kind: "start_agent",
      title: "Criar sessão DRAFT no Agent Runtime",
      origin: "conversation→agent-runtime",
      changesSummary:
        "Agent Runtime permanece autoridade. Sessão nasce DRAFT; início exige confirmação.",
      payload: { draftId: draft.id, ...draft.payload },
      riskLevel: "MEDIUM",
      nowIso,
    });
    return { draft, pending };
  }

  return null;
}
