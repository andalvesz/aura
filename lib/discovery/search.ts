/**
 * Cross-layer Aura Brain search (Memory / World / Insight / Discovery).
 */

import type { AuraBrainSearchResult, TimelineEventKind } from "@/lib/discovery/types";

export type AuraBrainSearchSources = {
  memories?: Array<{ id: string; title: string; summary?: string }>;
  entities?: Array<{ id: string; displayName: string; entityType?: string }>;
  worldEntities?: Array<{
    id: string;
    displayName: string;
    entityType?: string;
  }>;
  insights?: Array<{ id: string; title: string; summary?: string }>;
  discoveries?: Array<{ id: string; title: string; summary?: string }>;
};

function scoreMatch(query: string, ...parts: Array<string | undefined>): number {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return 0;
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  if (!hay.includes(q)) {
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);
    if (!tokens.length) return 0;
    const hits = tokens.filter((t) => hay.includes(t)).length;
    if (!hits) return 0;
    return hits / tokens.length;
  }
  return hay.startsWith(q) ? 1 : 0.75;
}

function pushResult(
  out: AuraBrainSearchResult[],
  kind: TimelineEventKind,
  id: string,
  title: string,
  summary: string,
  href: string,
  score: number
): void {
  if (score <= 0) return;
  out.push({ id, kind, title, summary, href, score });
}

export function searchAuraBrainSources(
  query: string,
  sources: AuraBrainSearchSources,
  limit = 30
): AuraBrainSearchResult[] {
  const out: AuraBrainSearchResult[] = [];

  for (const m of sources.memories ?? []) {
    pushResult(
      out,
      "memory",
      m.id,
      m.title,
      m.summary ?? "",
      "/dashboard/settings/memory",
      scoreMatch(query, m.title, m.summary)
    );
  }

  const entities = sources.worldEntities ?? sources.entities ?? [];
  for (const e of entities) {
    pushResult(
      out,
      "world",
      e.id,
      e.displayName,
      e.entityType ?? "",
      "/dashboard/settings/world-model",
      scoreMatch(query, e.displayName, e.entityType)
    );
  }

  for (const i of sources.insights ?? []) {
    pushResult(
      out,
      "insight",
      i.id,
      i.title,
      i.summary ?? "",
      "/dashboard/settings/insights",
      scoreMatch(query, i.title, i.summary)
    );
  }

  for (const d of sources.discoveries ?? []) {
    pushResult(
      out,
      "discovery",
      d.id,
      d.title,
      d.summary ?? "",
      `/dashboard/discovery?id=${d.id}`,
      scoreMatch(query, d.title, d.summary)
    );
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
