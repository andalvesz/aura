/**
 * History helpers — searchable conversation list / export (sanitized).
 */

import type {
  ConversationMessage,
  ConversationRecord,
  ConversationState,
} from "@/lib/conversation/types";

export function listConversationsPure(
  state: ConversationState,
  opts?: { includeArchived?: boolean; query?: string; limit?: number }
): ConversationRecord[] {
  let items = state.conversations.filter((c) => !c.softDeleted);
  if (!opts?.includeArchived) {
    items = items.filter((c) => c.status !== "ARCHIVED" && c.status !== "DELETED");
  }
  const q = opts?.query?.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.focus.label.toLowerCase().includes(q)
    );
  }
  return items
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, opts?.limit ?? 50);
}

export function conversationMessagesPure(
  state: ConversationState,
  conversationId: string
): ConversationMessage[] {
  const conv = state.conversations.find((c) => c.id === conversationId);
  if (!conv) return [];
  return conv.messageIds
    .map((id) => state.messages.find((m) => m.id === id && !m.softDeleted))
    .filter(Boolean) as ConversationMessage[];
}

export function exportConversationPure(
  state: ConversationState,
  conversationId: string
): {
  conversation: ConversationRecord | null;
  messages: Array<{
    role: string;
    content: string;
    createdAt: string;
    citations: Array<{ label: string; href: string; kind: string }>;
  }>;
} {
  const conv =
    state.conversations.find((c) => c.id === conversationId && !c.softDeleted) ??
    null;
  if (!conv) return { conversation: null, messages: [] };
  const messages = conversationMessagesPure(state, conversationId).map((m) => ({
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    citations: m.citations.map((c) => ({
      label: c.label,
      href: c.href,
      kind: c.kind,
    })),
  }));
  return { conversation: conv, messages };
}

export function sanitizeAuditMetadata(
  meta: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/prompt|token|secret|password|cot|chain/i.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (v === null) out[k] = null;
  }
  return out;
}
