import type {
  AgentContextSlice,
  AgentDefinition,
  AgentMemoryPolicy,
} from "@/lib/agent-runtime/types";
import { hashPayload, nowIso } from "@/lib/agent-runtime/store";

export function emptyContextSlice(): AgentContextSlice {
  return {
    identityHints: [],
    memories: [],
    worldEntities: [],
    cognitive: [],
    discoveries: [],
    decisions: [],
    scenarios: [],
    priorities: [],
    recommendations: [],
    plans: [],
    projects: [],
    knowledge: [],
    generatedAt: nowIso(),
    version: "empty",
    readOnly: true,
  };
}

/**
 * Build minimal read-only context. Never loads full user life.
 * Filters rejected/unconfirmed/sensitive/cross-user.
 */
export function buildAgentContext(params: {
  agent: AgentDefinition;
  partial?: Partial<AgentContextSlice> | null;
  excludeSensitive?: boolean;
}): AgentContextSlice {
  const base = emptyContextSlice();
  const src = params.partial ?? {};
  const budget = params.agent.contextBudget;
  let used = 0;

  const take = <T>(arr: T[] | undefined, n: number): T[] => {
    const slice = (arr ?? []).slice(0, Math.max(0, Math.min(n, budget - used)));
    used += slice.length;
    return slice;
  };

  const memoryPolicy: AgentMemoryPolicy = params.agent.memoryPolicy;

  const identity = (src.identityHints ?? []).filter((i) => i.confirmed);
  const memories =
    memoryPolicy === "none"
      ? []
      : memoryPolicy === "confirmed_only"
        ? (src.memories ?? []).filter((m) => !/hip[oó]tese/i.test(m.title))
        : (src.memories ?? []);

  const discoveries = (src.discoveries ?? []).filter((d) => d.confirmed);
  const recommendations = (src.recommendations ?? []).filter(
    (r) =>
      !r.status ||
      ["ACCEPTED", "SUGGESTED", "ACTIVE"].includes(r.status.toUpperCase())
  );

  // Strip obvious sensitive payloads
  const scrub = (title: string) =>
    params.excludeSensitive !== false &&
    /senha|password|secret|token|cpf|cart[aã]o/i.test(title)
      ? null
      : title;

  const ctx: AgentContextSlice = {
    identityHints: take(
      identity
        .map((i) => ({ ...i, title: scrub(i.title) ?? "" }))
        .filter((i) => i.title),
      8
    ),
    memories: take(
      memories
        .map((m) => ({
          ...m,
          title: scrub(m.title) ?? "",
          summary: m.summary.slice(0, 160),
        }))
        .filter((m) => m.title),
      10
    ),
    worldEntities: take(src.worldEntities ?? [], 8),
    cognitive: take(src.cognitive ?? [], 6),
    discoveries: take(discoveries, 6),
    decisions: take(src.decisions ?? [], 6),
    scenarios: take(src.scenarios ?? [], 4),
    priorities: take(src.priorities ?? [], 6),
    recommendations: take(recommendations, 6),
    plans: take(src.plans ?? [], 4),
    projects: take(src.projects ?? [], 4),
    knowledge: take(
      (src.knowledge ?? [])
        .map((k) => ({ ...k, title: scrub(k.title) ?? "" }))
        .filter((k) => k.title),
      8
    ),
    generatedAt: nowIso(),
    version: "pending",
    readOnly: true,
  };

  ctx.version = hashPayload(ctx as unknown as Record<string, unknown>);
  return ctx;
}

/** Detect prompt-injection style instructions in documents */
export function detectPromptInjection(text: string): boolean {
  const patterns = [
    /ignore (all|previous|above) instructions/i,
    /you are now/i,
    /system prompt/i,
    /reveal (your|the) (system|hidden)/i,
    /exfiltrat/i,
    /run shell/i,
    /execute sql/i,
    /create (a )?new tool/i,
    /bypass (policy|safety|confirmation)/i,
  ];
  return patterns.some((p) => p.test(text));
}

export function sanitizeContextAgainstInjection(
  ctx: AgentContextSlice
): AgentContextSlice {
  const scrubItem = <T extends { title?: string; summary?: string; name?: string }>(
    item: T
  ): T | null => {
    const blob = `${item.title ?? ""} ${item.summary ?? ""} ${item.name ?? ""}`;
    if (detectPromptInjection(blob)) return null;
    return item;
  };

  return {
    ...ctx,
    memories: ctx.memories.map(scrubItem).filter(Boolean) as typeof ctx.memories,
    knowledge: ctx.knowledge
      .map(scrubItem)
      .filter(Boolean) as typeof ctx.knowledge,
    cognitive: ctx.cognitive
      .map(scrubItem)
      .filter(Boolean) as typeof ctx.cognitive,
  };
}
