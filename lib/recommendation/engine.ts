/**
 * Recommendation orchestrator — generate / list / get / home.
 * Reads upstream via context only. Never writes to kernel layers.
 * executionInfluence: none
 */

import { annotateRecommendationConflicts } from "@/lib/recommendation/contradictions";
import { buildRecommendationContext } from "@/lib/recommendation/context/context";
import { runRecommendationRegistry } from "@/lib/recommendation/registry/registry";
import { rankRecommendationItems } from "@/lib/recommendation/ranking";
import { filterValidRecommendationCandidates } from "@/lib/recommendation/validators/validate";
import {
  canViewRecommendation,
  newRecommendationId,
  type ImpactLevel,
  type RecommendationCard,
  type RecommendationContext,
  type RecommendationHomeWidget,
  type RecommendationSourceSlice,
  type RecommendationState,
  type RecommendationStatus,
  type RecommendationType,
  type UrgencyLevel,
} from "@/lib/recommendation/types/types";

function nowIso(): string {
  return new Date().toISOString();
}

export function generateRecommendationsPure(
  state: RecommendationState,
  input: {
    userId: string;
    workspaceId?: string | null;
    sources?: Partial<RecommendationSourceSlice>;
    maxPerEngine?: number;
  }
): {
  state: RecommendationState;
  items: RecommendationCard[];
  context: RecommendationContext;
  rejectedCount: number;
} {
  const context = buildRecommendationContext({
    sources: input.sources,
    correlationId: `rec_run_${Date.now()}`,
  });

  const { candidates } = runRecommendationRegistry(context, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    maxPerEngine: input.maxPerEngine ?? 4,
  });

  const { valid, rejected } = filterValidRecommendationCandidates(candidates);
  const withConflicts = annotateRecommendationConflicts(valid);
  const ts = nowIso();
  const existingFingerprints = new Set(
    state.items
      .filter((c) => !["IGNORED", "ARCHIVED"].includes(c.status))
      .map((c) => c.fingerprint)
  );

  const fresh: RecommendationCard[] = [];
  for (const c of withConflicts) {
    if (existingFingerprints.has(c.fingerprint)) continue;
    const item: RecommendationCard = {
      ...c,
      id: newRecommendationId("rec"),
      status: "SUGGESTED",
      visibilityScope: c.visibilityScope ?? "PRIVATE",
      executionInfluence: "none",
      ranking: null,
      conflicts: c.conflicts ?? [],
      createdAt: ts,
      updatedAt: ts,
      lastReviewedAt: null,
    };
    fresh.push(item);
    existingFingerprints.add(c.fingerprint);
  }

  const next: RecommendationState = {
    ...state,
    items: [...fresh, ...state.items].slice(0, 400),
    lastGeneratedAt: ts,
    audit: [
      {
        id: newRecommendationId("rau"),
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        recommendationId: null,
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

export type RecommendationListFilters = {
  status?: RecommendationStatus | RecommendationStatus[];
  recommendationType?: RecommendationType;
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

export function listRecommendationsPure(
  state: RecommendationState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  opts?: RecommendationListFilters
): RecommendationCard[] {
  let rows = state.items.filter((c) => canViewRecommendation(c, viewer));

  if (opts?.workspaceId !== undefined) {
    rows = rows.filter((c) => c.workspaceId === opts.workspaceId);
  }
  if (opts?.status) {
    const set = new Set(
      Array.isArray(opts.status) ? opts.status : [opts.status]
    );
    rows = rows.filter((c) => set.has(c.status));
  }
  if (opts?.recommendationType) {
    rows = rows.filter(
      (c) => c.recommendationType === opts.recommendationType
    );
  }
  if (opts?.impact) rows = rows.filter((c) => c.impact === opts.impact);
  if (opts?.urgency) rows = rows.filter((c) => c.urgency === opts.urgency);
  if (typeof opts?.confidenceMin === "number") {
    rows = rows.filter((c) => c.confidence >= opts.confidenceMin!);
  }
  if (opts?.projectId) {
    rows = rows.filter((c) => c.relatedProject === opts.projectId);
  }
  if (opts?.businessId) {
    rows = rows.filter((c) =>
      c.relatedBusinessIds.includes(opts.businessId!)
    );
  }

  if (opts?.ranked !== false) rows = rankRecommendationItems(rows);
  const offset = opts?.offset ?? 0;
  return rows.slice(offset, offset + (opts?.limit ?? 50));
}

export function getRecommendationPure(
  state: RecommendationState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  recommendationId: string
): RecommendationCard | null {
  const item = state.items.find((c) => c.id === recommendationId);
  if (!item || !canViewRecommendation(item, viewer)) return null;
  return item;
}

/** Home widget: recommendations of the week (top ranked, active statuses). */
export function getHomeRecommendationWidgetPure(
  state: RecommendationState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): RecommendationHomeWidget {
  const weekRecommendations = listRecommendationsPure(state, viewer, {
    status: ["SUGGESTED", "ACCEPTED", "NEEDS_REVIEW"],
    limit: 7,
    ranked: true,
  });
  return { weekRecommendations };
}
