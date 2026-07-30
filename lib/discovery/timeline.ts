/**
 * Unified Aura timeline — Memory → Promotion → World → Insight → Discovery
 */

import type {
  DiscoveryTimelineEntry,
  TimelineEvent,
} from "@/lib/discovery/types";

export type TimelineSourceItem = {
  id: string;
  kind: TimelineEvent["kind"];
  title: string;
  summary?: string;
  occurredAt: string;
  href?: string;
  meta?: TimelineEvent["meta"];
};

const DEFAULT_HREF: Record<TimelineEvent["kind"], string> = {
  memory: "/dashboard/settings/memory",
  promotion: "/dashboard/settings/memory",
  world: "/dashboard/settings/world-model",
  insight: "/dashboard/settings/insights",
  discovery: "/dashboard/discovery",
};

export function buildAuraTimeline(
  items: TimelineSourceItem[],
  options?: { limit?: number }
): TimelineEvent[] {
  const limit = options?.limit ?? 40;
  return items
    .map((item) => ({
      id: `tl_${item.kind}_${item.id}`,
      kind: item.kind,
      title: item.title,
      summary: item.summary ?? "",
      occurredAt: item.occurredAt,
      href:
        item.href ??
        (item.kind === "discovery"
          ? `/dashboard/discovery?id=${item.id}`
          : DEFAULT_HREF[item.kind]),
      sourceId: item.id,
      meta: item.meta,
    }))
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    )
    .slice(0, limit);
}

export function mergeTimelineSources(input: {
  memories?: Array<{
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
    userId?: string;
    workspaceId?: string | null;
  }>;
  promotions?: Array<{
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
  }>;
  worldEntities?: Array<{
    id: string;
    displayName: string;
    createdAt: string;
  }>;
  insights?: Array<{
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
  }>;
  discoveries?: Array<{
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
    type?: string;
    actorUserId?: string;
    workspaceId?: string | null;
  }>;
  limit?: number;
  workspaceId?: string | null;
}): TimelineEvent[] {
  const items: TimelineSourceItem[] = [];

  for (const m of input.memories ?? []) {
    items.push({
      id: m.id,
      kind: "memory",
      title: m.title,
      summary: m.summary,
      occurredAt: m.createdAt,
      href: `/dashboard/settings/memory`,
      meta: {
        actorUserId: m.userId ?? null,
        workspaceId: m.workspaceId ?? null,
        layer: "memory",
        origin: "memory_engine",
      },
    });
  }
  for (const p of input.promotions ?? []) {
    items.push({
      id: p.id,
      kind: "promotion",
      title: p.title,
      summary: p.summary,
      occurredAt: p.createdAt,
      meta: { layer: "promotion", origin: "promotion" },
    });
  }
  for (const e of input.worldEntities ?? []) {
    items.push({
      id: e.id,
      kind: "world",
      title: e.displayName,
      occurredAt: e.createdAt,
      href: `/dashboard/settings/world-model`,
      meta: { layer: "world", origin: "world_model" },
    });
  }
  for (const i of input.insights ?? []) {
    items.push({
      id: i.id,
      kind: "insight",
      title: i.title,
      summary: i.summary,
      occurredAt: i.createdAt,
      href: `/dashboard/settings/insights`,
      meta: { layer: "insight", origin: "cognitive_engine" },
    });
  }
  for (const d of input.discoveries ?? []) {
    items.push({
      id: d.id,
      kind: "discovery",
      title: d.title,
      summary: d.summary,
      occurredAt: d.createdAt,
      href: `/dashboard/discovery?id=${d.id}`,
      meta: {
        type: d.type ?? null,
        actorUserId: d.actorUserId ?? null,
        workspaceId: d.workspaceId ?? null,
        layer: "discovery",
        origin: "discovery_engine",
      },
    });
  }

  return buildAuraTimeline(items, { limit: input.limit }).map((ev) => ({
    ...ev,
    actorUserId:
      typeof ev.meta?.actorUserId === "string" ? ev.meta.actorUserId : null,
    layer: ev.kind,
    origin:
      typeof ev.meta?.origin === "string" ? ev.meta.origin : null,
    workspaceId:
      typeof ev.meta?.workspaceId === "string"
        ? ev.meta.workspaceId
        : input.workspaceId ?? null,
  }));
}

function toTimelineEntry(event: TimelineEvent): DiscoveryTimelineEntry {
  return {
    id: event.id,
    kind: event.kind,
    title: event.title,
    summary: event.summary,
    at: event.occurredAt,
    href: event.href,
    sourceId: event.sourceId,
    meta: event.meta,
  };
}

/**
 * Service/UI facade — accepts mixed source shapes and returns entries with `at`.
 */
export function buildAuraBrainTimeline(
  input: {
    memories?: Array<{
      id: string;
      title: string;
      summary?: string;
      createdAt: string;
      status?: string;
    }>;
    promotions?: Array<{
      id: string;
      title: string;
      summary?: string;
      at?: string;
      createdAt?: string;
    }>;
    worldEvents?: Array<{
      id: string;
      title: string;
      summary?: string;
      at: string;
    }>;
    worldEntities?: Array<{
      id: string;
      displayName: string;
      createdAt: string;
    }>;
    insights?: Array<{
      id: string;
      title: string;
      summary?: string;
      createdAt: string;
    }>;
    discoveries?: Array<{
      id: string;
      title: string;
      summary?: string;
      createdAt: string;
      type?: string;
    }>;
  },
  limit = 40
): DiscoveryTimelineEntry[] {
  const items: TimelineSourceItem[] = [];

  for (const m of input.memories ?? []) {
    items.push({
      id: m.id,
      kind: "memory",
      title: m.title,
      summary: m.summary,
      occurredAt: m.createdAt,
    });
  }
  for (const p of input.promotions ?? []) {
    items.push({
      id: p.id,
      kind: "promotion",
      title: p.title,
      summary: p.summary,
      occurredAt: p.at ?? p.createdAt ?? new Date().toISOString(),
    });
  }
  for (const w of input.worldEvents ?? []) {
    items.push({
      id: w.id,
      kind: "world",
      title: w.title,
      summary: w.summary,
      occurredAt: w.at,
    });
  }
  for (const e of input.worldEntities ?? []) {
    items.push({
      id: e.id,
      kind: "world",
      title: e.displayName,
      occurredAt: e.createdAt,
    });
  }
  for (const i of input.insights ?? []) {
    items.push({
      id: i.id,
      kind: "insight",
      title: i.title,
      summary: i.summary,
      occurredAt: i.createdAt,
    });
  }
  for (const d of input.discoveries ?? []) {
    items.push({
      id: d.id,
      kind: "discovery",
      title: d.title,
      summary: d.summary,
      occurredAt: d.createdAt,
      meta: d.type ? { type: d.type } : undefined,
    });
  }

  return buildAuraTimeline(items, { limit }).map(toTimelineEntry);
}
