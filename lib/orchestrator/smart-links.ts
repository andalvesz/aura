/**
 * Smart Links — related items across modules for any opened entity.
 */

import type { SmartLink, SmartLinksBundle } from "@/lib/orchestrator/types";

export function emptySmartLinksBundle(): SmartLinksBundle {
  return {
    memories: [],
    documents: [],
    plans: [],
    discovery: [],
    knowledge: [],
    decisions: [],
    recommendations: [],
    agents: [],
    automations: [],
  };
}

export type SmartLinkCandidate = {
  id: string;
  kind: SmartLink["kind"];
  title: string;
  href: string;
  reason?: string;
  score?: number;
  tags?: string[];
};

function toLink(c: SmartLinkCandidate): SmartLink {
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    href: c.href,
    reason: c.reason ?? "relacionado",
  };
}

function bucketFor(kind: SmartLink["kind"]): keyof SmartLinksBundle | null {
  switch (kind) {
    case "memory":
      return "memories";
    case "knowledge":
      return "documents";
    case "plan":
      return "plans";
    case "discovery":
      return "discovery";
    case "decision":
      return "decisions";
    case "recommendation":
      return "recommendations";
    case "agent":
      return "agents";
    case "automation":
      return "automations";
    default:
      return null;
  }
}

/**
 * Build smart links for an opened item.
 * Matching is tag/keyword based — callers supply candidates from existing modules.
 */
export function buildSmartLinks(input: {
  focusTags?: string[];
  focusTitle?: string;
  candidates?: SmartLinkCandidate[];
  limitPerBucket?: number;
}): SmartLinksBundle {
  const bundle = emptySmartLinksBundle();
  const limit = input.limitPerBucket ?? 5;
  const focus = [
    ...(input.focusTags ?? []),
    ...(input.focusTitle ? input.focusTitle.toLowerCase().split(/\s+/) : []),
  ]
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);

  const scored = (input.candidates ?? [])
    .map((c) => {
      const hay = `${c.title} ${(c.tags ?? []).join(" ")}`.toLowerCase();
      let score = c.score ?? 0;
      for (const t of focus) {
        if (t.length > 1 && hay.includes(t)) score += 2;
      }
      return { c, score };
    })
    .filter((x) => x.score > 0 || !focus.length)
    .sort((a, b) => b.score - a.score);

  for (const { c } of scored) {
    const bucket = bucketFor(c.kind);
    if (!bucket) continue;
    // knowledge kind also fills knowledge bucket
    if (bundle[bucket].length >= limit) continue;
    bundle[bucket].push(toLink(c));
    if (c.kind === "knowledge" && bundle.knowledge.length < limit) {
      if (!bundle.knowledge.some((l) => l.id === c.id)) {
        bundle.knowledge.push(toLink({ ...c, reason: c.reason ?? "conhecimento" }));
      }
    }
  }

  return bundle;
}

export function flattenSmartLinks(bundle: SmartLinksBundle): SmartLink[] {
  return [
    ...bundle.memories,
    ...bundle.documents,
    ...bundle.knowledge,
    ...bundle.plans,
    ...bundle.discovery,
    ...bundle.decisions,
    ...bundle.recommendations,
    ...bundle.agents,
    ...bundle.automations,
  ];
}
