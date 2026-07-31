/**
 * Global Timeline — merges events from existing modules into one feed.
 */

import type {
  OrchestratorModuleId,
  TimelineEntry,
  TimelineSourceKind,
} from "@/lib/orchestrator/types";

const SOURCE_MODULE: Record<TimelineSourceKind, OrchestratorModuleId> = {
  memory: "memory",
  knowledge: "knowledge",
  discovery: "discovery",
  decision: "decision",
  recommendation: "recommendation",
  plan: "planner",
  automation: "automation",
  agent: "agent-runtime",
  priority: "prioritization",
  scenario: "scenario",
  project: "projects",
  world: "world",
  insight: "cognitive",
};

export type TimelineInputEvent = {
  id: string;
  source: TimelineSourceKind;
  title: string;
  summary?: string;
  at: string;
  href?: string;
  sourceId?: string;
};

const DEFAULT_HREF: Record<TimelineSourceKind, string> = {
  memory: "/dashboard/settings/memory",
  knowledge: "/dashboard/knowledge",
  discovery: "/dashboard/discovery",
  decision: "/dashboard/decisions",
  recommendation: "/dashboard/recommendations",
  plan: "/dashboard/plans",
  automation: "/dashboard/automations",
  agent: "/dashboard/agents",
  priority: "/dashboard/priorities",
  scenario: "/dashboard/scenarios",
  project: "/dashboard/projects",
  world: "/dashboard/settings/world-model",
  insight: "/dashboard/settings/insights",
};

export function normalizeTimelineEvent(e: TimelineInputEvent): TimelineEntry {
  return {
    id: e.id,
    source: e.source,
    title: e.title.trim() || e.source,
    summary: (e.summary ?? "").trim(),
    at: e.at,
    href: e.href?.trim() || DEFAULT_HREF[e.source],
    moduleId: SOURCE_MODULE[e.source],
    sourceId: e.sourceId,
  };
}

/** Map legacy discovery timeline kinds → orchestrator sources. */
export function mapLegacyTimelineKind(
  kind: string
): TimelineSourceKind {
  switch (kind) {
    case "memory":
      return "memory";
    case "world":
      return "world";
    case "insight":
      return "insight";
    case "discovery":
    case "promotion":
      return "discovery";
    default:
      return "discovery";
  }
}

export function buildGlobalTimeline(
  events: TimelineInputEvent[],
  limit = 40
): TimelineEntry[] {
  return events
    .map(normalizeTimelineEvent)
    .filter((e) => Boolean(e.at) && Boolean(e.title))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, Math.max(1, limit));
}

export function mergeTimelineSources(parts: {
  discovery?: TimelineInputEvent[];
  decisions?: TimelineInputEvent[];
  recommendations?: TimelineInputEvent[];
  plans?: TimelineInputEvent[];
  automations?: TimelineInputEvent[];
  agents?: TimelineInputEvent[];
  knowledge?: TimelineInputEvent[];
  memories?: TimelineInputEvent[];
  limit?: number;
}): TimelineEntry[] {
  const all: TimelineInputEvent[] = [
    ...(parts.discovery ?? []),
    ...(parts.decisions ?? []),
    ...(parts.recommendations ?? []),
    ...(parts.plans ?? []),
    ...(parts.automations ?? []),
    ...(parts.agents ?? []),
    ...(parts.knowledge ?? []),
    ...(parts.memories ?? []),
  ];
  return buildGlobalTimeline(all, parts.limit ?? 40);
}
