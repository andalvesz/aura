/**
 * Conversation policy — ownership, visibility, injection, budgets, confirmation.
 */

import { detectPromptInjection } from "@/lib/conversation/injection";
import type {
  ConversationIntent,
  ConversationPendingAction,
  ConversationRecord,
  ConversationViewer,
} from "@/lib/conversation/types";
import { hashPayload } from "@/lib/conversation/store";

export const CONVERSATION_BUDGET = {
  maxSources: 24,
  maxMessageChars: 4000,
  maxPayloadBytes: 32_000,
  confirmationTtlMs: 15 * 60 * 1000,
  rateLimitPerMinute: 30,
};

const rateBuckets = new Map<string, number[]>();

export function clearConversationRateLimits(): void {
  rateBuckets.clear();
}

export function checkRateLimit(userId: string, now = Date.now()): boolean {
  const windowMs = 60_000;
  const stamps = (rateBuckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= CONVERSATION_BUDGET.rateLimitPerMinute) {
    rateBuckets.set(userId, stamps);
    return false;
  }
  stamps.push(now);
  rateBuckets.set(userId, stamps);
  return true;
}

export function canViewConversation(
  viewer: ConversationViewer,
  conv: ConversationRecord
): boolean {
  if (conv.softDeleted) return false;
  if (conv.ownerId === viewer.userId) return true;
  if (
    conv.workspaceId &&
    viewer.workspaceId === conv.workspaceId &&
    viewer.isWorkspaceMember
  ) {
    return viewer.role === "owner" || viewer.role === "admin" || viewer.role === "member";
  }
  return false;
}

export function canMutateConversation(
  viewer: ConversationViewer,
  conv: ConversationRecord
): boolean {
  if (!canViewConversation(viewer, conv)) return false;
  if (conv.ownerId === viewer.userId) return true;
  return (
    !!conv.workspaceId &&
    viewer.workspaceId === conv.workspaceId &&
    (viewer.role === "owner" || viewer.role === "admin")
  );
}

export type PolicyResult = {
  allowed: boolean;
  reason: string | null;
  event:
    | "ok"
    | "injection_blocked"
    | "policy_blocked"
    | "rate_limited"
    | "payload_too_large";
};

export function evaluateConversationPolicy(input: {
  viewer: ConversationViewer;
  message: string;
  intent?: ConversationIntent | null;
  conversation?: ConversationRecord | null;
}): PolicyResult {
  if (input.message.length > CONVERSATION_BUDGET.maxMessageChars) {
    return {
      allowed: false,
      reason: "Mensagem excede o tamanho permitido.",
      event: "payload_too_large",
    };
  }
  if (!checkRateLimit(input.viewer.userId)) {
    return {
      allowed: false,
      reason: "Limite de mensagens por minuto atingido.",
      event: "rate_limited",
    };
  }
  const inj = detectPromptInjection(input.message);
  if (inj.blocked) {
    return {
      allowed: false,
      reason: `Bloqueado por segurança: ${inj.reasons.join(", ")}`,
      event: "injection_blocked",
    };
  }
  if (input.conversation && !canMutateConversation(input.viewer, input.conversation)) {
    return {
      allowed: false,
      reason: "Sem permissão neste contexto.",
      event: "policy_blocked",
    };
  }
  if (
    input.intent?.requiresConfirmation &&
    input.intent.actionability === "propose" &&
    input.viewer.role === "viewer"
  ) {
    return {
      allowed: false,
      reason: "Viewers não podem propor ações operacionais.",
      event: "policy_blocked",
    };
  }
  return { allowed: true, reason: null, event: "ok" };
}

export function validateConfirmation(input: {
  pending: ConversationPendingAction;
  payload: Record<string, unknown>;
  nowIso: string;
}): { ok: boolean; error: string | null } {
  if (pendingExpired(input.pending, input.nowIso)) {
    return { ok: false, error: "Confirmação expirada." };
  }
  if (input.pending.status !== "PENDING") {
    return { ok: false, error: "Ação não está pendente." };
  }
  const hash = hashPayload(input.payload);
  if (hash !== input.pending.payloadHash) {
    return { ok: false, error: "Payload alterado — confirme novamente." };
  }
  return { ok: true, error: null };
}

export function pendingExpired(
  pending: ConversationPendingAction,
  nowIso: string
): boolean {
  return new Date(nowIso).getTime() > new Date(pending.expiresAt).getTime();
}
