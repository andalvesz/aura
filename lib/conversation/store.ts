/**
 * In-memory conversation store (Sprint 9.1). Migration prepares persistence.
 */

import type {
  ConversationAuditEntry,
  ConversationDraft,
  ConversationMessage,
  ConversationPendingAction,
  ConversationRecord,
  ConversationState,
} from "@/lib/conversation/types";

const globalKey = "__AURA_CONVERSATION_STATE__";

declare global {
  // eslint-disable-next-line no-var
  var __AURA_CONVERSATION_STATE__: Map<string, ConversationState> | undefined;
}

function bucket(): Map<string, ConversationState> {
  if (!globalThis.__AURA_CONVERSATION_STATE__) {
    globalThis.__AURA_CONVERSATION_STATE__ = new Map();
  }
  return globalThis.__AURA_CONVERSATION_STATE__;
}

export function createEmptyConversationState(): ConversationState {
  return {
    conversations: [],
    messages: [],
    drafts: [],
    pendingActions: [],
    audits: [],
  };
}

export function clearConversationState(): void {
  bucket().clear();
}

export function getConversationState(userId: string): ConversationState {
  const b = bucket();
  if (!b.has(userId)) b.set(userId, createEmptyConversationState());
  return cloneState(b.get(userId)!);
}

export function setConversationState(
  userId: string,
  state: ConversationState
): void {
  bucket().set(userId, cloneState(state));
}

export function cloneState(state: ConversationState): ConversationState {
  return {
    conversations: state.conversations.map((c) => ({
      ...c,
      focus: { ...c.focus },
      messageIds: [...c.messageIds],
      draftIds: [...c.draftIds],
      pendingActionIds: [...c.pendingActionIds],
    })),
    messages: state.messages.map((m) => ({
      ...m,
      citations: m.citations.map((c) => ({ ...c })),
      draftIds: [...m.draftIds],
      pendingActionIds: [...m.pendingActionIds],
      explanation: m.explanation
        ? {
            ...m.explanation,
            evidence: [...m.explanation.evidence],
            rules: [...m.explanation.rules],
            sources: m.explanation.sources.map((s) => ({ ...s })),
            premises: [...m.explanation.premises],
            limitations: [...m.explanation.limitations],
            missing: [...m.explanation.missing],
            alternativeInterpretations: [
              ...m.explanation.alternativeInterpretations,
            ],
          }
        : null,
    })),
    drafts: state.drafts.map((d) => ({ ...d, payload: { ...d.payload } })),
    pendingActions: state.pendingActions.map((p) => ({
      ...p,
      payload: { ...p.payload },
    })),
    audits: state.audits.map((a) => ({ ...a, metadata: { ...a.metadata } })),
  };
}

export function hashPayload(input: Record<string, unknown>): string {
  const raw = JSON.stringify(sortKeys(input));
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sortKeys(v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out;
}

export function findConversation(
  state: ConversationState,
  id: string
): ConversationRecord | null {
  return state.conversations.find((c) => c.id === id && !c.softDeleted) ?? null;
}

export function findMessage(
  state: ConversationState,
  id: string
): ConversationMessage | null {
  return state.messages.find((m) => m.id === id && !m.softDeleted) ?? null;
}

export function findDraft(
  state: ConversationState,
  id: string
): ConversationDraft | null {
  return state.drafts.find((d) => d.id === id) ?? null;
}

export function findPending(
  state: ConversationState,
  id: string
): ConversationPendingAction | null {
  return state.pendingActions.find((p) => p.id === id) ?? null;
}

export function pushAudit(
  state: ConversationState,
  entry: ConversationAuditEntry
): ConversationState {
  return {
    ...state,
    audits: [entry, ...state.audits].slice(0, 500),
  };
}

void globalKey;
