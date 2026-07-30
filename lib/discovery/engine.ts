/**
 * Discovery Engine — pure orchestration.
 * ADR-006 · read-only · executionInfluence: none
 */

import { canViewerAccess, resolveVisibilityScope } from "@/lib/aura-brain/visibility";
import { confidenceBand } from "@/lib/discovery/confidence";
import { buildDiscoveryContext } from "@/lib/discovery/context";
import { explainDiscovery } from "@/lib/discovery/explain";
import {
  createDiscoveryFeedback,
  createDiscoverySuppression,
  matchesSuppression,
  recalculateConfidenceAfterFeedback,
  statusAfterDiscoveryFeedback,
} from "@/lib/discovery/feedback";
import {
  ensureBuiltinDiscoveryDetectors,
  runDiscoveryRegistry,
} from "@/lib/discovery/registry";
import type {
  DetectorCandidate,
  DiscoveryArtifact,
  DiscoveryAuditEvent,
  DiscoveryBootstrapInput,
  DiscoveryBootstrapReport,
  DiscoveryBrainContext,
  DiscoveryContext,
  DiscoveryExplanation,
  DiscoveryFeedback,
  DiscoveryFeedbackKind,
  DiscoveryFilters,
  DiscoveryRun,
  DiscoverySuppression,
  DiscoveryType,
} from "@/lib/discovery/types";
import { METHOD_VERSION } from "@/lib/discovery/types";

export type DiscoveryEngineState = {
  artifacts: DiscoveryArtifact[];
  feedbacks: DiscoveryFeedback[];
  suppressions: DiscoverySuppression[];
  runs: DiscoveryRun[];
  audits: DiscoveryAuditEvent[];
};

export type EngineResult<T> = {
  ok: boolean;
  error: string | null;
  state: DiscoveryEngineState;
  data: T | null;
};

export type FeedbackResult = {
  artifact: DiscoveryArtifact;
  conflict?: boolean;
};

function viewerCanSeeArtifact(
  artifact: DiscoveryArtifact,
  viewerUserId: string,
  viewerWorkspaceId?: string | null
): boolean {
  const scope = resolveVisibilityScope(
    artifact.visibilityScope,
    artifact.workspaceId ? "WORKSPACE" : "PRIVATE"
  );
  const isMember =
    viewerWorkspaceId != null &&
    artifact.workspaceId != null &&
    viewerWorkspaceId === artifact.workspaceId;
  return canViewerAccess({
    viewerUserId,
    ownerUserId: artifact.userId,
    visibilityScope: scope,
    workspaceId: artifact.workspaceId,
    viewerWorkspaceId: viewerWorkspaceId ?? null,
    isWorkspaceMember: isMember,
  });
}

export function createEmptyDiscoveryState(): DiscoveryEngineState {
  return {
    artifacts: [],
    feedbacks: [],
    suppressions: [],
    runs: [],
    audits: [],
  };
}

function audit(
  state: DiscoveryEngineState,
  event: Omit<DiscoveryAuditEvent, "id" | "createdAt">
): DiscoveryEngineState {
  const entry: DiscoveryAuditEvent = {
    ...event,
    id: `dga_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  return { ...state, audits: [entry, ...state.audits].slice(0, 500) };
}

function materialize(
  candidate: DetectorCandidate,
  status: DiscoveryArtifact["status"] = "GENERATED",
  visibilityScope: DiscoveryArtifact["visibilityScope"] = "PRIVATE"
): DiscoveryArtifact {
  const now = new Date().toISOString();
  const needsConfirm =
    candidate.type === "UNKNOWN" || candidate.confidence < 45;
  return {
    ...candidate,
    id: `dsc_${candidate.fingerprint.slice(0, 16)}`,
    status:
      needsConfirm && status === "GENERATED"
        ? "PENDING_CONFIRMATION"
        : status,
    confidenceBand:
      candidate.confidenceBand ?? confidenceBand(candidate.confidence),
    executionInfluence: "none",
    visibilityScope: candidate.visibilityScope ?? visibilityScope,
    rowVersion: 1,
    evidenceSetHash: candidate.evidenceSetHash,
    firstGeneratedAt: now,
    lastValidatedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
  };
}

function findByFingerprint(
  state: DiscoveryEngineState,
  fp: string
): DiscoveryArtifact | undefined {
  return state.artifacts.find(
    (a) =>
      a.fingerprint === fp &&
      a.deletedAt == null &&
      a.status !== "DELETED"
  );
}

function isRejectedRecently(
  state: DiscoveryEngineState,
  suppressionKey: string,
  days = 14
): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return state.artifacts.some(
    (a) =>
      a.suppressionKey === suppressionKey &&
      (a.status === "REJECTED" || a.status === "SUPPRESSED") &&
      new Date(a.updatedAt).getTime() >= cutoff
  );
}

export function generateDiscoveriesPure(
  state: DiscoveryEngineState,
  context: DiscoveryContext,
  options: {
    userId: string;
    workspaceId?: string | null;
    dryRun?: boolean;
    maxArtifacts?: number;
    correlationId?: string;
    detectorIds?: string[];
  }
): EngineResult<{
  artifacts: DiscoveryArtifact[];
  run: DiscoveryRun;
  dispositions: string[];
}> {
  ensureBuiltinDiscoveryDetectors();
  const started = Date.now();
  const dryRun = Boolean(options.dryRun);
  const max = options.maxArtifacts ?? 24;

  const { candidates, detectorsRun, byDetector } = runDiscoveryRegistry(
    context,
    {
      userId: options.userId,
      workspaceId: options.workspaceId,
      maxPerDetector: 4,
      detectorIds: options.detectorIds,
    }
  );

  let next = state;
  const accepted: DiscoveryArtifact[] = [];
  const dispositions: string[] = [];
  let suppressedCount = 0;
  let reusedCount = 0;

  for (const candidate of candidates) {
    if (accepted.length >= max) break;

    if (
      next.suppressions.some((s) => matchesSuppression(candidate, s)) ||
      isRejectedRecently(next, candidate.suppressionKey)
    ) {
      suppressedCount += 1;
      dispositions.push("SUPPRESSED");
      continue;
    }

    const existing = findByFingerprint(next, candidate.fingerprint);
    if (existing) {
      reusedCount += 1;
      const updated: DiscoveryArtifact = {
        ...existing,
        lastValidatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        confidence: candidate.confidence,
        confidenceBand: confidenceBand(candidate.confidence),
        evidence: candidate.evidence,
        evidenceSetHash: candidate.evidenceSetHash,
        summary: candidate.summary,
        executionInfluence: "none",
      };
      if (!dryRun) {
        next = {
          ...next,
          artifacts: next.artifacts.map((a) =>
            a.id === existing.id ? updated : a
          ),
        };
      }
      accepted.push(updated);
      dispositions.push("REUSED");
      continue;
    }

    const artifact = materialize(
      candidate,
      "GENERATED",
      options.workspaceId ? "WORKSPACE" : "PRIVATE"
    );
    if (artifact.executionInfluence !== "none") {
      dispositions.push("BLOCKED");
      continue;
    }

    if (!dryRun) {
      next = {
        ...next,
        artifacts: [artifact, ...next.artifacts],
      };
      next = audit(next, {
        userId: options.userId,
        workspaceId: options.workspaceId ?? null,
        action: "discovery_generated",
        discoveryId: artifact.id,
        actor: "system",
        previousStatus: null,
        newStatus: artifact.status,
        justification: `Detector ${artifact.detectorId} · ${artifact.type}`,
        correlationId: options.correlationId ?? context.correlationId,
        sourceReferences: artifact.relatedArtifacts,
        metadata: { fingerprint: artifact.fingerprint },
      });
    }
    accepted.push(artifact);
    dispositions.push("ACCEPT");
  }

  const run: DiscoveryRun = {
    id: `drun_${Date.now().toString(36)}`,
    userId: options.userId,
    workspaceId: options.workspaceId ?? null,
    correlationId: options.correlationId ?? context.correlationId,
    status: dryRun ? "dry_run" : "completed",
    detectorsRun,
    artifactsGenerated: accepted.filter((_, i) => dispositions[i] === "ACCEPT")
      .length,
    suppressedCount,
    reusedCount,
    durationMs: Date.now() - started,
    dryRun,
    metrics: {
      recordsAnalyzed:
        context.memories.length +
        context.worldEntities.length +
        context.cognitiveArtifacts.length +
        context.missions.length,
      artifactsDeduplicated: reusedCount,
      artifactsSuppressed: suppressedCount,
      feedbacks: 0,
      failures: 0,
      timeouts: 0,
      cacheHit: false,
      detectorsExecuted: Object.keys(byDetector),
    },
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    report: { byDetector, reusedCount, methodVersion: METHOD_VERSION },
  };

  if (!dryRun) {
    next = { ...next, runs: [run, ...next.runs].slice(0, 100) };
  }

  return {
    ok: true,
    error: null,
    state: next,
    data: { artifacts: accepted, run, dispositions },
  };
}

export function listDiscoveriesPure(
  state: DiscoveryEngineState,
  userId: string,
  filters?: DiscoveryFilters
): DiscoveryArtifact[] {
  let items = state.artifacts.filter(
    (a) =>
      a.deletedAt == null &&
      a.status !== "DELETED" &&
      viewerCanSeeArtifact(a, userId, filters?.workspaceId)
  );

  if (filters?.workspaceId !== undefined) {
    items = items.filter((a) => {
      if (filters.workspaceId === null) {
        return (
          a.userId === userId &&
          (a.workspaceId == null ||
            resolveVisibilityScope(a.visibilityScope) === "PRIVATE")
        );
      }
      return a.workspaceId === filters.workspaceId;
    });
  }
  if (filters?.types?.length) {
    items = items.filter((a) => filters.types!.includes(a.type));
  }
  if (filters?.statuses?.length) {
    items = items.filter((a) => filters.statuses!.includes(a.status));
  } else if (!filters?.includeArchived) {
    items = items.filter(
      (a) => !["ARCHIVED", "SUPPRESSED", "OUTDATED"].includes(a.status)
    );
  }
  if (filters?.minConfidence != null) {
    items = items.filter((a) => a.confidence >= filters.minConfidence!);
  }
  if (filters?.maxConfidence != null) {
    items = items.filter((a) => a.confidence <= filters.maxConfidence!);
  }
  if (filters?.periodFrom) {
    const from = new Date(filters.periodFrom).getTime();
    items = items.filter((a) => new Date(a.createdAt).getTime() >= from);
  }
  if (filters?.periodTo) {
    const to = new Date(filters.periodTo).getTime();
    items = items.filter((a) => new Date(a.createdAt).getTime() <= to);
  }

  items.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return items.slice(0, filters?.limit ?? 100);
}

export function getDiscoveryPure(
  state: DiscoveryEngineState,
  userId: string,
  id: string,
  viewerWorkspaceId?: string | null
): DiscoveryArtifact | null {
  const art =
    state.artifacts.find((a) => a.id === id && a.deletedAt == null) ?? null;
  if (!art) return null;
  if (
    !viewerCanSeeArtifact(art, userId, viewerWorkspaceId ?? art.workspaceId)
  ) {
    return null;
  }
  return art;
}

export function searchDiscoveriesPure(
  state: DiscoveryEngineState,
  userId: string,
  query: string,
  limit = 20
): DiscoveryArtifact[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return listDiscoveriesPure(state, userId, {
    limit: 100,
    includeArchived: true,
  })
    .filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export function explainDiscoveryPure(
  state: DiscoveryEngineState,
  userId: string,
  id: string
): DiscoveryExplanation | null {
  const art = getDiscoveryPure(state, userId, id);
  if (!art) return null;
  const history = state.audits
    .filter((a) => a.discoveryId === id)
    .slice(0, 20)
    .map((a) => ({
      action: a.action,
      at: a.createdAt,
      justification: a.justification,
    }));
  return explainDiscovery(art, history);
}

export function submitDiscoveryFeedbackPure(
  state: DiscoveryEngineState,
  input: {
    userId: string;
    workspaceId?: string | null;
    discoveryId: string;
    kind: DiscoveryFeedbackKind;
    note?: string | null;
    /** Optimistic concurrency — reject if stale */
    expectedVersion?: number;
  }
): EngineResult<FeedbackResult> {
  const artifact = getDiscoveryPure(
    state,
    input.userId,
    input.discoveryId,
    input.workspaceId
  );
  if (!artifact) {
    return { ok: false, error: "Discovery não encontrada", state, data: null };
  }

  if (
    input.expectedVersion != null &&
    artifact.rowVersion !== input.expectedVersion
  ) {
    return {
      ok: false,
      error: "Conflito de versão — outro membro atualizou esta descoberta",
      state,
      data: { artifact, conflict: true },
    };
  }

  const feedbackVisibility =
    resolveVisibilityScope(artifact.visibilityScope) === "WORKSPACE"
      ? ("WORKSPACE" as const)
      : ("PRIVATE" as const);

  const feedback = createDiscoveryFeedback({
    userId: input.userId,
    workspaceId: input.workspaceId ?? artifact.workspaceId,
    discoveryId: artifact.id,
    kind: input.kind,
    note: input.note,
    visibilityScope: feedbackVisibility,
  });

  const nextStatus = statusAfterDiscoveryFeedback(input.kind, artifact.status);
  const nextConfidence = recalculateConfidenceAfterFeedback(
    artifact.confidence,
    input.kind
  );

  // Confirmation raises confidence but never becomes operational fact.
  let updated: DiscoveryArtifact = {
    ...artifact,
    status: nextStatus,
    confidence: nextConfidence,
    confidenceBand: confidenceBand(nextConfidence),
    executionInfluence: "none",
    rowVersion: artifact.rowVersion + 1,
    updatedAt: new Date().toISOString(),
    lastValidatedAt: new Date().toISOString(),
    archivedAt:
      nextStatus === "ARCHIVED"
        ? new Date().toISOString()
        : artifact.archivedAt,
    metadata: {
      ...artifact.metadata,
      lastFeedbackBy: input.userId,
      lastFeedbackKind: input.kind,
      confirmationIsNotFact: input.kind === "confirm" ? true : undefined,
    },
  };

  let next: DiscoveryEngineState = {
    ...state,
    artifacts: state.artifacts.map((a) => (a.id === artifact.id ? updated : a)),
    feedbacks: [feedback, ...state.feedbacks].slice(0, 500),
  };

  if (input.kind === "suppress_similar" || input.kind === "reject") {
    const suppression = createDiscoverySuppression({
      userId: input.userId,
      workspaceId: input.workspaceId ?? artifact.workspaceId,
      discovery: updated,
      reason: input.note ?? `feedback:${input.kind}`,
      visibilityScope: feedbackVisibility,
    });
    next = {
      ...next,
      suppressions: [suppression, ...next.suppressions],
    };
    if (input.kind === "suppress_similar") {
      updated = { ...updated, status: "SUPPRESSED" };
      next = {
        ...next,
        artifacts: next.artifacts.map((a) =>
          a.id === artifact.id ? updated : a
        ),
      };
    }
  }

  next = audit(next, {
    userId: input.userId,
    workspaceId: input.workspaceId ?? artifact.workspaceId,
    action: `feedback_${input.kind}`,
    discoveryId: artifact.id,
    actor: "user",
    previousStatus: artifact.status,
    newStatus: updated.status,
    justification: input.note ?? input.kind,
    correlationId: null,
    sourceReferences: [],
    metadata: {
      confidenceBefore: artifact.confidence,
      confidenceAfter: nextConfidence,
      actorUserId: input.userId,
      rowVersionBefore: artifact.rowVersion,
      rowVersionAfter: updated.rowVersion,
      confirmationIsNotOperationalFact: true,
    },
  });

  return { ok: true, error: null, state: next, data: { artifact: updated } };
}

export function confirmDiscoveryPure(
  state: DiscoveryEngineState,
  userId: string,
  discoveryId: string,
  note?: string | null
): EngineResult<FeedbackResult> {
  return submitDiscoveryFeedbackPure(state, {
    userId,
    discoveryId,
    kind: "confirm",
    note: note ?? "confirmed",
  });
}

export function rejectDiscoveryPure(
  state: DiscoveryEngineState,
  userId: string,
  discoveryId: string,
  reason?: string
): EngineResult<FeedbackResult> {
  return submitDiscoveryFeedbackPure(state, {
    userId,
    discoveryId,
    kind: "reject",
    note: reason ?? "rejected",
  });
}

export function archiveDiscoveryPure(
  state: DiscoveryEngineState,
  userId: string,
  discoveryId: string,
  reason?: string
): EngineResult<FeedbackResult> {
  return submitDiscoveryFeedbackPure(state, {
    userId,
    discoveryId,
    kind: "archive",
    note: reason ?? "archived",
  });
}

export function suppressSimilarDiscoveriesPure(
  state: DiscoveryEngineState,
  userId: string,
  discoveryId: string,
  reason?: string
): EngineResult<FeedbackResult> {
  return submitDiscoveryFeedbackPure(state, {
    userId,
    discoveryId,
    kind: "suppress_similar",
    note: reason ?? "suppress_similar",
  });
}

export function getDiscoveryContextForBrainPure(
  state: DiscoveryEngineState,
  userId: string,
  input?: {
    limit?: number;
    minConfidence?: number;
    workspaceId?: string | null;
  }
): DiscoveryBrainContext {
  const limit = input?.limit ?? 6;
  const minConfidence = input?.minConfidence ?? 30;
  const items = listDiscoveriesPure(state, userId, {
    limit: 100,
    workspaceId: input?.workspaceId,
    minConfidence,
    includeArchived: false,
  }).filter(
    (a) =>
      !["REJECTED", "DELETED", "SUPPRESSED", "OUTDATED"].includes(a.status) &&
      a.executionInfluence === "none"
  );

  const pick = (type: DiscoveryType) =>
    items
      .filter((a) => a.type === type)
      .slice(0, limit)
      .map((a) => ({ id: a.id, title: a.title, confidence: a.confidence }));

  const opportunities = pick("OPPORTUNITY");
  const risks = pick("RISK");
  const recent = items.slice(0, limit).map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    confidence: a.confidence,
  }));

  return {
    opportunities,
    risks,
    gaps: pick("GAP"),
    pendingConfirmation: items
      .filter(
        (a) => a.status === "PENDING_CONFIRMATION" || a.type === "UNKNOWN"
      )
      .slice(0, limit)
      .map((a) => ({ id: a.id, title: a.title, confidence: a.confidence })),
    recent,
    topOpportunity: opportunities[0] ?? null,
    topRisk: risks[0] ?? null,
    recentTitles: recent.map((r) => r.title),
    status: items.length ? "available" : "empty",
    limitations: [
      "read_only",
      "executionInfluence:none",
      "no_decision_support",
      "no_execution",
      "no_mission_creation",
    ],
    executionInfluence: "none",
  };
}

export function bootstrapDiscoveryEnginePure(
  state: DiscoveryEngineState,
  input: DiscoveryBootstrapInput
): EngineResult<{
  report: DiscoveryBootstrapReport;
  artifacts: DiscoveryArtifact[];
}> {
  const context =
    input.context ??
    buildDiscoveryContext({
      userId: input.userId,
      workspaceId: input.workspaceId,
      maxItems: input.maxItems ?? 40,
      correlationId: input.correlationId,
    });

  const gen = generateDiscoveriesPure(state, context, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    dryRun: input.dryRun,
    maxArtifacts: input.maxItems ?? 24,
    correlationId: context.correlationId,
  });

  const artifacts = gen.data?.artifacts ?? [];
  const generated = gen.data?.run.artifactsGenerated ?? 0;
  const reused = Number(gen.data?.run.reusedCount ?? 0);
  const suppressed = gen.data?.run.suppressedCount ?? 0;
  const records =
    context.memories.length +
    context.worldEntities.length +
    context.cognitiveArtifacts.length;
  const correlationId = context.correlationId;
  const metrics = gen.data?.run.metrics ?? {
    recordsAnalyzed: records,
    artifactsDeduplicated: reused,
    artifactsSuppressed: suppressed,
    feedbacks: 0,
    failures: 0,
    timeouts: 0,
    cacheHit: false,
    detectorsExecuted: [],
  };

  let outcome: DiscoveryBootstrapReport["outcome"] = "none_new";
  let message = "Nenhuma nova descoberta — evidências já analisadas.";
  if (records === 0) {
    outcome = "insufficient_evidence";
    message =
      "Evidência insuficiente — registre memórias compartilhadas e tente de novo.";
  } else if (generated > 0) {
    outcome = "generated";
    message = `${generated} nova(s) descoberta(s) gerada(s).`;
  } else if (reused > 0) {
    outcome = "none_new";
    message = `Nenhuma nova descoberta (${reused} sinal(is) já conhecidos revalidado(s)).`;
  }

  const report: DiscoveryBootstrapReport = {
    dryRun: Boolean(input.dryRun),
    artifactsGenerated: generated,
    suppressedCount: suppressed,
    reusedCount: reused,
    correlationId,
    outcome,
    message,
    durationMs: gen.data?.run.durationMs ?? 0,
    metrics,
    items: artifacts.map((a) => ({
      type: a.type,
      title: a.title,
      discoveryId: a.id,
      detectorId: a.detectorId,
    })),
  };

  return {
    ok: true,
    error: null,
    state: gen.state,
    data: { report, artifacts },
  };
}

export function listDiscoveryAuditsPure(
  state: DiscoveryEngineState,
  userId: string,
  limit = 50,
  workspaceId?: string | null
): DiscoveryAuditEvent[] {
  return state.audits
    .filter((a) => {
      if (a.userId === userId) return true;
      if (
        workspaceId &&
        a.workspaceId === workspaceId &&
        resolveVisibilityScope(
          (a.metadata?.visibilityScope as string) ?? "WORKSPACE"
        ) !== "PRIVATE"
      ) {
        return true;
      }
      return Boolean(workspaceId && a.workspaceId === workspaceId);
    })
    .slice(0, limit);
}
