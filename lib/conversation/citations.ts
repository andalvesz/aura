/**
 * Citations — never invent sources.
 */

import type {
  ConversationCitation,
  ConversationSourceRef,
} from "@/lib/conversation/types";

export function toCitations(
  sources: ConversationSourceRef[]
): ConversationCitation[] {
  return sources.map((s) => ({
    id: s.id,
    label: s.title,
    href: s.href,
    kind: s.kind,
    confirmedByUser: Boolean(s.confirmedByUser),
  }));
}

export function formatSourcesBlock(citations: ConversationCitation[]): string {
  if (!citations.length) {
    return "Não encontrei dados suficientes.";
  }
  const lines = citations
    .slice(0, 8)
    .map((c) => `- ${c.label} (${c.kind})`);
  return `Encontrei evidências em:\n${lines.join("\n")}`;
}

export function assertNoInventedSources(
  citedIds: string[],
  available: ConversationSourceRef[]
): { ok: boolean; invented: string[] } {
  const allowed = new Set(available.map((s) => s.id));
  const invented = citedIds.filter((id) => !allowed.has(id));
  return { ok: invented.length === 0, invented };
}
