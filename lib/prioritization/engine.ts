/**
 * Prioritization orchestrator — generate / list / get / home.
 * Reads upstream via context only. Never writes to kernel layers.
 * executionInfluence: none
 */

import { buildPriorityContext } from "@/lib/prioritization/context/context";
import { runPriorityRegistry } from "@/lib/prioritization/registry/registry";
import { rankPriorityItems } from "@/lib/prioritization/ranking";
import { filterValidPriorityCandidates } from "@/lib/prioritization/validators/validate";
import {
  canViewPriority,
  newPriorityId,
  type ImpactLevel,
  type PriorityContext,
  type PriorityHomeWidget,
  type PriorityItem,
  type PriorityKind,
  type PrioritySourceSlice,
  type PriorityState,
  type PriorityStatus,
  type UrgencyLevel,
} from "@/lib/prioritization/types/types";

function nowIso(): string {
  return new Date().toISOString();
}

export function generatePrioritiesPure(
  state: PriorityState,
  input: {
    userId: string;
    workspaceId?: string | null;
    sources?: Partial<PrioritySourceSlice>;
    maxPerEngine?: number;
  }
): {
  state: PriorityState;
  items: PriorityItem[];
  context: PriorityContext;
  rejectedCount: number;
} {
  const context = buildPriorityContext({
    sources: input.sources,
    correlationId: `prio_run_${Date.now()}`,
  });

  const { candidates } = runPriorityRegistry(context, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    maxPerEngine: input.maxPerEngine ?? 4,
  });

  const { valid, rejected } = filterValidPriorityCandidates(candidates);
  const ts = nowIso();
  const existingFingerprints = new Set(
    state.items
      .filter((c) => !["IGNORED", "ARCHIVED"].includes(c.status))
      .map((c) => c.fingerprint)
  );

  const fresh: PriorityItem[] = [];
  for (const c of valid) {
    if (existingFingerprints.has(c.fingerprint)) continue;
    const item: PriorityItem = {
      ...c,
      id: newPriorityId("prio"),
      status: "SUGGESTED",
      visibilityScope: c.visibilityScope ?? "PRIVATE",
      executionInfluence: "none",
      ranking: null,
      createdAt: ts,
      updatedAt: ts,
      lastReviewedAt: null,
    };
    fresh.push(item);
    existingFingerprints.add(c.fingerprint);
  }

  const next: PriorityState = {
    ...state,
    items: [...fresh, ...state.items].slice(0, 400),
    lastGeneratedAt: ts,
    audit: [
      {
        id: newPriorityId("pau"),
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        priorityId: null,
        action: "generate",
        summary: `Geradas ${fresh.length} · rejeitadas pelo validator ${rejected.length}`,
        metadata: {
          executionInfluence: "none",
          readOnly: true,
          rejectedCount: rejected.length,
        },
        createdAt: ts,
      },
      ...state.audit,
    ].slice(0, 500),
  };

  return {
    state: next,
    items: fresh,
    context,
    rejectedCount: rejected.length,
  };
}

export type PriorityListFilters = {
  status?: PriorityStatus | PriorityStatus[];
  kind?: PriorityKind;
  impact?: ImpactLevel;
  urgency?: UrgencyLevel;
  confidenceMin?: number;
  projectId?: string;
  businessId?: string;
  workspaceId?: string | null;
  limit?: number;
  offset?: number;
  ranked?: boolean;
};

export function listPrioritiesPure(
  state: PriorityState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  opts?: PriorityListFilters
): PriorityItem[] {
  let rows = state.items.filter((c) => canViewPriority(c, viewer));

  if (opts?.workspaceId !== undefined) {
    rows = rows.filter((c) => c.workspaceId === opts.workspaceId);
  }
  if (opts?.status) {
    const set = new Set(
      Array.isArray(opts.status) ? opts.status : [opts.status]
    );
    rows = rows.filter((c) => set.has(c.status));
  }
  if (opts?.kind) rows = rows.filter((c) => c.kind === opts.kind);
  if (opts?.impact) rows = rows.filter((c) => c.impact === opts.impact);
  if (opts?.urgency) rows = rows.filter((c) => c.urgency === opts.urgency);
  if (typeof opts?.confidenceMin === "number") {
    rows = rows.filter((c) => c.confidence >= opts.confidenceMin!);
  }
  if (opts?.projectId) {
    rows = rows.filter((c) => c.relatedProject === opts.projectId);
  }
  if (opts?.businessId) {
    rows = rows.filter((c) => c.relatedBusinessIds.includes(opts.businessId!));
  }

  if (opts?.ranked !== false) rows = rankPriorityItems(rows);
  const offset = opts?.offset ?? 0;
  return rows.slice(offset, offset + (opts?.limit ?? 50));
}

export function getPriorityPure(
  state: PriorityState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  priorityId: string
): PriorityItem | null {
  const item = state.items.find((c) => c.id === priorityId);
  if (!item || !canViewPriority(item, viewer)) return null;
  return item;
}

/** Home widget: priorities of the week (top ranked, active statuses). */
export function getHomePriorityWidgetPure(
  state: PriorityState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): PriorityHomeWidget {
  const weekPriorities = listPrioritiesPure(state, viewer, {
    status: ["SUGGESTED", "CONFIRMED", "NEEDS_REVIEW"],
    limit: 7,
    ranked: true,
  });
  return { weekPriorities };
}
