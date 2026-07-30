/**
 * Decision Support orchestrator — generate / list / get.
 * Reads upstream via context only. Never writes to kernel layers.
 * executionInfluence: none
 */

import { buildDecisionContext } from "@/lib/decision-support/context/context";
import { runDecisionRegistry } from "@/lib/decision-support/registry/registry";
import { rankDecisionCards } from "@/lib/decision-support/ranking";
import { filterValidCandidates } from "@/lib/decision-support/validators/validate";
import {
  canViewDecision,
  newDecisionId,
  type DecisionCard,
  type DecisionContext,
  type DecisionHomeWidget,
  type DecisionSourceSlice,
  type DecisionState,
  type DecisionStatus,
} from "@/lib/decision-support/types/types";

function nowIso(): string {
  return new Date().toISOString();
}

export function generateDecisionsPure(
  state: DecisionState,
  input: {
    userId: string;
    workspaceId?: string | null;
    sources?: Partial<DecisionSourceSlice>;
    maxPerEngine?: number;
  }
): {
  state: DecisionState;
  cards: DecisionCard[];
  context: DecisionContext;
  rejectedCount: number;
} {
  const context = buildDecisionContext({
    sources: input.sources,
    correlationId: `dec_run_${Date.now()}`,
  });

  const { candidates } = runDecisionRegistry(context, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    maxPerEngine: input.maxPerEngine ?? 4,
  });

  const { valid, rejected } = filterValidCandidates(candidates);
  const ts = nowIso();
  const existingFingerprints = new Set(
    state.cards
      .filter((c) => !["IGNORED", "ARCHIVED"].includes(c.status))
      .map((c) => c.fingerprint)
  );

  const fresh: DecisionCard[] = [];
  for (const c of valid) {
    if (existingFingerprints.has(c.fingerprint)) continue;
    const card: DecisionCard = {
      ...c,
      id: newDecisionId("dec"),
      status: "SUGGESTED",
      visibilityScope: c.visibilityScope ?? "PRIVATE",
      executionInfluence: "none",
      createdAt: ts,
      updatedAt: ts,
      lastReviewedAt: null,
    };
    fresh.push(card);
    existingFingerprints.add(c.fingerprint);
  }

  const next: DecisionState = {
    ...state,
    cards: [...fresh, ...state.cards].slice(0, 400),
    lastGeneratedAt: ts,
    audit: [
      {
        id: newDecisionId("dau"),
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        decisionId: null,
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
    cards: fresh,
    context,
    rejectedCount: rejected.length,
  };
}

export function listDecisionsPure(
  state: DecisionState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  opts?: {
    status?: DecisionStatus | DecisionStatus[];
    kind?: DecisionCard["kind"];
    limit?: number;
    ranked?: boolean;
  }
): DecisionCard[] {
  let rows = state.cards.filter((c) => canViewDecision(c, viewer));
  if (opts?.status) {
    const set = new Set(
      Array.isArray(opts.status) ? opts.status : [opts.status]
    );
    rows = rows.filter((c) => set.has(c.status));
  }
  if (opts?.kind) rows = rows.filter((c) => c.kind === opts.kind);
  if (opts?.ranked !== false) rows = rankDecisionCards(rows);
  return rows.slice(0, opts?.limit ?? 50);
}

export function getDecisionPure(
  state: DecisionState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  decisionId: string
): DecisionCard | null {
  const card = state.cards.find((c) => c.id === decisionId);
  if (!card || !canViewDecision(card, viewer)) return null;
  return card;
}

export function getHomeDecisionWidgetPure(
  state: DecisionState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): DecisionHomeWidget {
  const visible = listDecisionsPure(state, viewer, {
    status: ["SUGGESTED", "NEEDS_REVIEW", "ACCEPTED"],
    limit: 40,
    ranked: true,
  });
  return {
    priorities: visible.filter((c) => c.kind === "PRIORITY").slice(0, 5),
    inReview: visible
      .filter((c) => c.kind === "REVIEW" || c.status === "NEEDS_REVIEW")
      .slice(0, 5),
    insufficientData: visible
      .filter((c) => c.kind === "MISSING_INFO")
      .slice(0, 5),
  };
}
