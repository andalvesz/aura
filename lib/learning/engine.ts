/**
 * runLearningCycle — AUTO_OBSERVE: signals → patterns → proposals. Never applies.
 */

import { aggregateLearningPatterns } from "@/lib/learning/pattern-aggregator";
import { generateLearningProposals } from "@/lib/learning/proposal-generator";
import { ensureBuiltinLearningAdapters } from "@/lib/learning/registry";
import {
  pushLearningAudit,
  sanitizeLearningMeta,
} from "@/lib/learning/store";
import type {
  LearningAuditEntry,
  LearningState,
  RunLearningCycleInput,
  RunLearningCycleResult,
} from "@/lib/learning/types";
import { MIN_SAMPLE_SIZE } from "@/lib/learning/types";

function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function audit(
  partial: Omit<LearningAuditEntry, "id" | "createdAt"> & { createdAt?: string }
): LearningAuditEntry {
  return {
    id: nid("laud"),
    createdAt: partial.createdAt ?? new Date().toISOString(),
    userId: partial.userId,
    workspaceId: partial.workspaceId,
    proposalId: partial.proposalId,
    event: partial.event,
    summary: partial.summary,
    metadata: sanitizeLearningMeta(partial.metadata),
  };
}

export function runLearningCyclePure(
  state: LearningState,
  input: RunLearningCycleInput
): { state: LearningState; result: RunLearningCycleResult } {
  ensureBuiltinLearningAdapters();
  const now = input.now ?? new Date().toISOString();
  const min = input.minSampleSize ?? MIN_SAMPLE_SIZE;

  let next = pushLearningAudit(
    state,
    audit({
      userId: input.viewer.userId,
      workspaceId: input.viewer.workspaceId,
      proposalId: null,
      event: "provider_invoked",
      summary: "deterministic_cycle",
      metadata: { mode: "AUTO_OBSERVE" },
      createdAt: now,
    })
  );

  const aggregated = aggregateLearningPatterns(next, {
    userId: input.viewer.userId,
    minSampleSize: min,
    now,
  });
  next = aggregated.state;

  for (const p of aggregated.patterns) {
    next = pushLearningAudit(
      next,
      audit({
        userId: input.viewer.userId,
        workspaceId: input.viewer.workspaceId,
        proposalId: null,
        event: "learning_pattern_detected",
        summary: p.patternKey,
        metadata: {
          sampleSize: p.sampleSize,
          duplicatesRemoved: aggregated.duplicatesRemoved,
        },
        createdAt: now,
      })
    );
  }

  const generated = generateLearningProposals(next, {
    userId: input.viewer.userId,
    minSampleSize: min,
    now,
  });
  next = generated.state;

  for (const prop of generated.proposals) {
    next = pushLearningAudit(
      next,
      audit({
        userId: input.viewer.userId,
        workspaceId: prop.workspaceId,
        proposalId: prop.id,
        event: "learning_proposal_generated",
        summary: prop.title,
        metadata: { type: prop.proposalType, confidence: prop.confidence },
        createdAt: now,
      })
    );
  }

  return {
    state: next,
    result: {
      ok: true,
      error: null,
      patternsDetected: aggregated.patterns.length,
      proposalsGenerated: generated.proposals.length,
      proposalIds: generated.proposals.map((p) => p.id),
    },
  };
}

export function getLearningHomeWidgetPure(
  state: LearningState,
  userId: string
): import("@/lib/learning/types").LearningHomeWidget {
  const mine = state.proposals.filter(
    (p) => p.userId === userId && !p.softDeleted
  );
  const patterns = state.patterns
    .filter((p) => p.userId === userId)
    .slice(0, 5)
    .map((p) => ({ id: p.id, title: p.title }));

  return {
    observedPatterns: patterns,
    pendingReview: mine
      .filter((p) => p.status === "PENDING_REVIEW" || p.status === "GENERATED")
      .slice(0, 5)
      .map((p) => ({ id: p.id, title: p.title })),
    applied: mine
      .filter((p) =>
        ["APPLIED", "EVALUATING", "SUCCESSFUL", "UNSUCCESSFUL"].includes(p.status)
      )
      .slice(0, 5)
      .map((p) => ({ id: p.id, title: p.title })),
    evaluating: mine
      .filter((p) => p.status === "EVALUATING")
      .slice(0, 5)
      .map((p) => ({ id: p.id, title: p.title })),
    needsMoreData: state.patterns
      .filter((p) => p.userId === userId && p.sampleSize < MIN_SAMPLE_SIZE)
      .slice(0, 5)
      .map((p) => ({ id: p.id, title: `${p.title} (amostra baixa)` })),
  };
}

export function listLearningProposalsPure(
  state: LearningState,
  userId: string,
  opts?: {
    status?: string | string[];
    proposalType?: string;
    query?: string;
    limit?: number;
  }
) {
  let items = state.proposals.filter((p) => p.userId === userId && !p.softDeleted);
  if (opts?.status) {
    const st = Array.isArray(opts.status) ? opts.status : [opts.status];
    items = items.filter((p) => st.includes(p.status));
  }
  if (opts?.proposalType) {
    items = items.filter((p) => p.proposalType === opts.proposalType);
  }
  if (opts?.query) {
    const q = opts.query.toLowerCase();
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q)
    );
  }
  return items
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, opts?.limit ?? 50);
}
