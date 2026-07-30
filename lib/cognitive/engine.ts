/**
 * Cognitive Engine — pure orchestration.
 * ADR-008 · RFC-005
 */

import { buildCognitiveContext } from "@/lib/cognitive/context";
import type { ContextSourcePayload } from "@/lib/cognitive/context";
import { detectConflicts } from "@/lib/cognitive/conflicts";
import {
  applyValidatorConfidence,
  validateCognitiveArtifact,
} from "@/lib/cognitive/validation";
import { explainCognitiveArtifact } from "@/lib/cognitive/explain";
import {
  createFeedback,
  createSuppression,
  isSuppressionActive,
  statusAfterFeedback,
} from "@/lib/cognitive/feedback";
import { generateHypotheses } from "@/lib/cognitive/hypotheses";
import { generateInsights } from "@/lib/cognitive/insights";
import { detectPatterns, fingerprint } from "@/lib/cognitive/patterns";
import { analyzeProgress } from "@/lib/cognitive/progress";
import { generateRecommendations } from "@/lib/cognitive/recommendations";
import { confidenceBand } from "@/lib/cognitive/confidence";
import type {
  ArtifactFilters,
  CognitiveArtifact,
  CognitiveAuditEvent,
  CognitiveBrainContext,
  CognitiveBootstrapInput,
  CognitiveBootstrapReport,
  CognitiveContext,
  CognitiveContextInput,
  CognitiveExplanation,
  CognitiveFeedback,
  CognitiveRun,
  CognitiveSuppression,
  FeedbackKind,
  GenerateOptions,
  ValidatorDisposition,
} from "@/lib/cognitive/types";

export type CognitiveEngineState = {
  artifacts: CognitiveArtifact[];
  feedbacks: CognitiveFeedback[];
  suppressions: CognitiveSuppression[];
  runs: CognitiveRun[];
  audits: CognitiveAuditEvent[];
};

export type EngineResult<T> = {
  ok: boolean;
  error: string | null;
  state: CognitiveEngineState;
  data: T | null;
};

export function createEmptyCognitiveState(): CognitiveEngineState {
  return {
    artifacts: [],
    feedbacks: [],
    suppressions: [],
    runs: [],
    audits: [],
  };
}

function audit(
  state: CognitiveEngineState,
  event: Omit<CognitiveAuditEvent, "id" | "createdAt">
): CognitiveEngineState {
  const entry: CognitiveAuditEvent = {
    ...event,
    id: `cga_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  return { ...state, audits: [entry, ...state.audits].slice(0, 500) };
}

function findByFingerprint(
  state: CognitiveEngineState,
  fp: string
): CognitiveArtifact | undefined {
  return state.artifacts.find(
    (a) =>
      a.fingerprint === fp &&
      a.deletedAt == null &&
      a.status !== "DELETED" &&
      a.status !== "SUPERSEDED"
  );
}

function acceptOrRecord(
  state: CognitiveEngineState,
  candidate: CognitiveArtifact,
  context: CognitiveContext,
  dryRun: boolean
): {
  state: CognitiveEngineState;
  artifact: CognitiveArtifact | null;
  disposition: ValidatorDisposition;
} {
  const activeSuppressions = state.suppressions.filter(isSuppressionActive);
  const existing = findByFingerprint(state, candidate.fingerprint);
  if (existing) {
    const updated: CognitiveArtifact = {
      ...existing,
      lastValidatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (dryRun) {
      return { state, artifact: updated, disposition: "ACCEPT" };
    }
    return {
      state: {
        ...state,
        artifacts: state.artifacts.map((a) =>
          a.id === existing.id ? updated : a
        ),
      },
      artifact: updated,
      disposition: "ACCEPT",
    };
  }

  const validation = validateCognitiveArtifact(
    candidate,
    context,
    activeSuppressions
  );
  const adjustedConfidence = applyValidatorConfidence(
    candidate.confidence,
    validation
  );

  if (validation.disposition === "SUPPRESSED" || validation.disposition === "BLOCKED") {
    let next = audit(state, {
      userId: candidate.userId,
      workspaceId: candidate.workspaceId,
      action:
        validation.disposition === "SUPPRESSED"
          ? "artifact_suppressed"
          : "artifact_blocked",
      artifactId: candidate.id,
      actor: "system",
      previousStatus: null,
      newStatus: validation.disposition,
      method: candidate.method,
      methodVersion: candidate.methodVersion,
      provider: null,
      validatorDisposition: validation.disposition,
      justification: validation.explanation,
      correlationId: context.correlationId,
      sourceReferences: candidate.evidence
        .map((e) => e.sourceReference)
        .filter(Boolean) as CognitiveArtifact["subjectReferences"],
      metadata: { issues: validation.issues },
    });
    return { state: next, artifact: null, disposition: validation.disposition };
  }

  if (validation.disposition === "INSUFFICIENT_EVIDENCE") {
    const insuf: CognitiveArtifact = {
      ...candidate,
      artifactType: "INSUFFICIENT_EVIDENCE",
      status: "GENERATED",
      confidence: Math.min(adjustedConfidence, 25),
      confidenceBand: confidenceBand(Math.min(adjustedConfidence, 25)),
      title: "Evidência insuficiente",
      summary:
        "Dados insuficientes para sustentar a afirmação. Ausência de evidência não é evidência de ausência.",
      executionInfluence: "none",
    };
    if (dryRun) {
      return { state, artifact: insuf, disposition: "INSUFFICIENT_EVIDENCE" };
    }
    let next: CognitiveEngineState = {
      ...state,
      artifacts: [insuf, ...state.artifacts],
    };
    next = audit(next, {
      userId: candidate.userId,
      workspaceId: candidate.workspaceId,
      action: "insight_generated",
      artifactId: insuf.id,
      actor: "system",
      previousStatus: null,
      newStatus: insuf.status,
      method: insuf.method,
      methodVersion: insuf.methodVersion,
      provider: null,
      validatorDisposition: "INSUFFICIENT_EVIDENCE",
      justification: validation.explanation,
      correlationId: context.correlationId,
      sourceReferences: [],
      metadata: {},
    });
    return { state: next, artifact: insuf, disposition: "INSUFFICIENT_EVIDENCE" };
  }

  if (validation.disposition === "REVISE") {
    // Auto-revise: strip causal-ish and ensure alternatives
    const revised: CognitiveArtifact = {
      ...candidate,
      confidence: adjustedConfidence,
      confidenceBand: confidenceBand(adjustedConfidence),
      status: "PENDING_REVIEW",
      summary: candidate.summary.replace(
        /\b(causa|causam|causou|causes?|provoca)\b/gi,
        "está associado a"
      ),
      alternativeHypotheses:
        candidate.alternativeHypotheses.length > 0
          ? candidate.alternativeHypotheses
          : [
              {
                statement: "Fator não observado pode explicar o padrão",
                confidence: 40,
                rationale: "Revisão automática",
              },
            ],
      limitations: [
        ...new Set([...candidate.limitations, ...validation.requiredChanges]),
      ],
      executionInfluence: "none",
    };
    const recheck = validateCognitiveArtifact(revised, context, activeSuppressions);
    if (!recheck.valid && recheck.disposition !== "PENDING_REVIEW" && recheck.disposition !== "ACCEPT") {
      return { state, artifact: null, disposition: recheck.disposition };
    }
    const finalArt: CognitiveArtifact = {
      ...revised,
      status:
        recheck.disposition === "PENDING_REVIEW" ? "PENDING_REVIEW" : "VALIDATED",
      lastValidatedAt: new Date().toISOString(),
    };
    if (dryRun) return { state, artifact: finalArt, disposition: recheck.disposition };
    let next: CognitiveEngineState = {
      ...state,
      artifacts: [finalArt, ...state.artifacts],
    };
    next = audit(next, {
      userId: finalArt.userId,
      workspaceId: finalArt.workspaceId,
      action: "artifact_revised",
      artifactId: finalArt.id,
      actor: "system",
      previousStatus: "GENERATED",
      newStatus: finalArt.status,
      method: finalArt.method,
      methodVersion: finalArt.methodVersion,
      provider: null,
      validatorDisposition: recheck.disposition,
      justification: recheck.explanation,
      correlationId: context.correlationId,
      sourceReferences: [],
      metadata: {},
    });
    return { state: next, artifact: finalArt, disposition: recheck.disposition };
  }

  const accepted: CognitiveArtifact = {
    ...candidate,
    confidence: adjustedConfidence,
    confidenceBand: confidenceBand(adjustedConfidence),
    status:
      validation.disposition === "PENDING_REVIEW"
        ? "PENDING_REVIEW"
        : "VALIDATED",
    lastValidatedAt: new Date().toISOString(),
    executionInfluence: "none",
  };

  if (dryRun) {
    return { state, artifact: accepted, disposition: validation.disposition };
  }

  let next: CognitiveEngineState = {
    ...state,
    artifacts: [accepted, ...state.artifacts],
  };
  const actionMap: Record<string, string> = {
    PATTERN: "pattern_generated",
    CONFLICT: "conflict_detected",
    PROGRESS_OBSERVATION: "progress_observed",
    HYPOTHESIS: "hypothesis_generated",
    INSIGHT: "insight_generated",
    RECOMMENDATION: "recommendation_generated",
  };
  next = audit(next, {
    userId: accepted.userId,
    workspaceId: accepted.workspaceId,
    action: actionMap[accepted.artifactType] ?? "artifact_validated",
    artifactId: accepted.id,
    actor: "system",
    previousStatus: null,
    newStatus: accepted.status,
    method: accepted.method,
    methodVersion: accepted.methodVersion,
    provider: accepted.providerMetadata?.provider ?? null,
    validatorDisposition: validation.disposition,
    justification: validation.explanation,
    correlationId: context.correlationId,
    sourceReferences: [],
    metadata: {},
  });
  return { state: next, artifact: accepted, disposition: validation.disposition };
}

export function buildCognitiveContextPure(
  input: CognitiveContextInput,
  sources: ContextSourcePayload
): CognitiveContext {
  return buildCognitiveContext(input, sources);
}

export function generateCognitiveArtifactsPure(
  state: CognitiveEngineState,
  context: CognitiveContext,
  options: GenerateOptions & { userId: string; workspaceId?: string | null }
): EngineResult<{
  artifacts: CognitiveArtifact[];
  run: CognitiveRun;
  dispositions: ValidatorDisposition[];
}> {
  const started = Date.now();
  const dryRun = Boolean(options.dryRun);
  const maxArtifacts = options.maxArtifacts ?? 24;
  const caps = new Set(
    options.capabilities ?? [
      "patterns",
      "conflicts",
      "progress",
      "hypotheses",
      "insights",
      "recommendations",
    ]
  );

  let next = state;
  const generated: CognitiveArtifact[] = [];
  const dispositions: ValidatorDisposition[] = [];
  let insufficientCount = 0;
  let blockedCount = 0;
  let reusedCount = 0;

  const opts = {
    userId: options.userId,
    workspaceId: options.workspaceId ?? null,
  };

  const patterns = caps.has("patterns")
    ? detectPatterns(context, { ...opts, maxPatterns: 6 }).patterns
    : [];
  const conflicts = caps.has("conflicts")
    ? detectConflicts(context, { ...opts, maxConflicts: 4 })
    : [];
  const progress = caps.has("progress") ? analyzeProgress(context, opts) : [];
  const hypotheses = caps.has("hypotheses")
    ? generateHypotheses(context, patterns, conflicts, { ...opts, max: 4 })
    : [];
  const insights = caps.has("insights")
    ? generateInsights(context, patterns, hypotheses, { ...opts, max: 4 })
    : [];
  const recommendations = caps.has("recommendations")
    ? generateRecommendations(context, insights, conflicts, {
        ...opts,
        max: 4,
      })
    : [];

  const candidates = [
    ...patterns,
    ...conflicts,
    ...progress,
    ...hypotheses,
    ...insights,
    ...recommendations,
  ].slice(0, maxArtifacts);

  for (const candidate of candidates) {
    const before = findByFingerprint(next, candidate.fingerprint);
    const result = acceptOrRecord(next, candidate, context, dryRun);
    next = result.state;
    dispositions.push(result.disposition);
    if (result.disposition === "INSUFFICIENT_EVIDENCE") insufficientCount++;
    if (
      result.disposition === "BLOCKED" ||
      result.disposition === "SUPPRESSED"
    ) {
      blockedCount++;
    }
    if (before && result.artifact) reusedCount++;
    if (result.artifact) generated.push(result.artifact);
  }

  const run: CognitiveRun = {
    id: `run_${fingerprint([options.correlationId ?? "", String(started)]).slice(0, 12)}`,
    userId: options.userId,
    workspaceId: options.workspaceId ?? null,
    correlationId: options.correlationId ?? context.correlationId,
    status: dryRun ? "dry_run" : "completed",
    contextType: "generate",
    artifactsGenerated: generated.length,
    insufficientCount,
    blockedCount,
    durationMs: Date.now() - started,
    dryRun,
    createdAt: new Date(started).toISOString(),
    completedAt: new Date().toISOString(),
    report: {
      reusedCount,
      patternCount: patterns.length,
      insightCount: insights.length,
      executionInfluence: "none",
    },
  };

  if (!dryRun) {
    next = {
      ...next,
      runs: [run, ...next.runs].slice(0, 100),
    };
    next = audit(next, {
      userId: options.userId,
      workspaceId: options.workspaceId ?? null,
      action: "cognitive_context_built",
      artifactId: null,
      actor: "system",
      previousStatus: null,
      newStatus: null,
      method: "generateCognitiveArtifactsPure",
      methodVersion: "cognitive-engine-v1",
      provider: null,
      validatorDisposition: null,
      justification: `Generated ${generated.length} artifacts`,
      correlationId: run.correlationId,
      sourceReferences: [],
      metadata: run.report,
    });
  }

  return {
    ok: true,
    error: null,
    state: next,
    data: { artifacts: generated, run, dispositions },
  };
}

export function listCognitiveArtifactsPure(
  state: CognitiveEngineState,
  userId: string,
  filters: ArtifactFilters = {}
): CognitiveArtifact[] {
  let items = state.artifacts.filter(
    (a) => a.userId === userId && a.deletedAt == null && a.status !== "DELETED"
  );
  if (!filters.includeArchived) {
    items = items.filter((a) => a.status !== "ARCHIVED" && a.archivedAt == null);
  }
  if (filters.artifactTypes?.length) {
    items = items.filter((a) => filters.artifactTypes!.includes(a.artifactType));
  }
  if (filters.statuses?.length) {
    items = items.filter((a) => filters.statuses!.includes(a.status));
  }
  if (filters.category) {
    items = items.filter((a) => a.category === filters.category);
  }
  if (typeof filters.minConfidence === "number") {
    items = items.filter((a) => a.confidence >= filters.minConfidence!);
  }
  if (filters.workspaceId !== undefined) {
    items = items.filter((a) => a.workspaceId === filters.workspaceId);
  }
  if (filters.subjectId) {
    items = items.filter((a) =>
      a.subjectReferences.some((s) => s.entityId === filters.subjectId)
    );
  }
  if (filters.cursor) {
    const idx = items.findIndex((a) => a.id === filters.cursor);
    if (idx >= 0) items = items.slice(idx + 1);
  }
  const limit = filters.limit ?? 50;
  return items.slice(0, limit);
}

export function getCognitiveArtifactPure(
  state: CognitiveEngineState,
  userId: string,
  artifactId: string
): CognitiveArtifact | null {
  const a = state.artifacts.find((x) => x.id === artifactId);
  if (!a || a.userId !== userId || a.deletedAt) return null;
  return a;
}

export function searchCognitiveArtifactsPure(
  state: CognitiveEngineState,
  userId: string,
  query: string,
  limit = 20
): CognitiveArtifact[] {
  const q = query.toLowerCase().trim();
  if (!q) return listCognitiveArtifactsPure(state, userId, { limit });
  return listCognitiveArtifactsPure(state, userId, { limit: 200 })
    .filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export function explainCognitiveArtifactPure(
  state: CognitiveEngineState,
  userId: string,
  artifactId: string
): CognitiveExplanation | null {
  const a = getCognitiveArtifactPure(state, userId, artifactId);
  if (!a) return null;
  return explainCognitiveArtifact(a);
}

export function submitCognitiveFeedbackPure(
  state: CognitiveEngineState,
  userId: string,
  artifactId: string,
  kind: FeedbackKind,
  note?: string | null,
  correctionPayload?: Record<string, unknown> | null
): EngineResult<{ artifact: CognitiveArtifact; feedback: CognitiveFeedback }> {
  const artifact = getCognitiveArtifactPure(state, userId, artifactId);
  if (!artifact) {
    return { ok: false, error: "artifact_not_found", state, data: null };
  }
  const feedback = createFeedback({
    userId,
    workspaceId: artifact.workspaceId,
    artifactId,
    kind,
    note,
    correctionPayload,
  });
  const newStatus = statusAfterFeedback(kind, artifact.status);
  let updated: CognitiveArtifact = {
    ...artifact,
    status: newStatus,
    updatedAt: new Date().toISOString(),
    ...(kind === "correct" && correctionPayload
      ? {
          summary: String(correctionPayload.summary ?? artifact.summary),
          title: String(correctionPayload.title ?? artifact.title),
        }
      : {}),
    ...(kind === "confirm" || kind === "accurate"
      ? { confidence: Math.max(artifact.confidence, 80), confidenceBand: "HIGH" as const }
      : {}),
    ...(kind === "reject" || kind === "inaccurate"
      ? { confidence: 0, confidenceBand: "LOW" as const }
      : {}),
  };

  let next: CognitiveEngineState = {
    ...state,
    artifacts: state.artifacts.map((a) => (a.id === artifactId ? updated : a)),
    feedbacks: [feedback, ...state.feedbacks],
  };

  if (kind === "suppress_similar") {
    const suppression = createSuppression({
      userId,
      workspaceId: artifact.workspaceId,
      artifact: updated,
      reason: note ?? "suppress_similar",
    });
    next = {
      ...next,
      suppressions: [suppression, ...next.suppressions],
    };
    next = audit(next, {
      userId,
      workspaceId: artifact.workspaceId,
      action: "artifact_suppressed",
      artifactId,
      actor: "user",
      previousStatus: artifact.status,
      newStatus,
      method: null,
      methodVersion: null,
      provider: null,
      validatorDisposition: "SUPPRESSED",
      justification: suppression.reason,
      correlationId: null,
      sourceReferences: [],
      metadata: {},
    });
  }

  const action =
    kind === "confirm" || kind === "accurate"
      ? "artifact_confirmed"
      : kind === "reject" || kind === "inaccurate"
        ? "artifact_rejected"
        : kind === "correct"
          ? "artifact_corrected"
          : "feedback_submitted";

  next = audit(next, {
    userId,
    workspaceId: artifact.workspaceId,
    action,
    artifactId,
    actor: "user",
    previousStatus: artifact.status,
    newStatus,
    method: null,
    methodVersion: null,
    provider: null,
    validatorDisposition: null,
    justification: kind,
    correlationId: null,
    sourceReferences: [],
    metadata: { note: note ?? null },
  });

  return {
    ok: true,
    error: null,
    state: next,
    data: { artifact: updated, feedback },
  };
}

export function archiveCognitiveArtifactPure(
  state: CognitiveEngineState,
  userId: string,
  artifactId: string
): EngineResult<CognitiveArtifact> {
  const artifact = getCognitiveArtifactPure(state, userId, artifactId);
  if (!artifact) {
    return { ok: false, error: "artifact_not_found", state, data: null };
  }
  const updated: CognitiveArtifact = {
    ...artifact,
    status: "ARCHIVED",
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let next: CognitiveEngineState = {
    ...state,
    artifacts: state.artifacts.map((a) => (a.id === artifactId ? updated : a)),
  };
  next = audit(next, {
    userId,
    workspaceId: artifact.workspaceId,
    action: "artifact_archived",
    artifactId,
    actor: "user",
    previousStatus: artifact.status,
    newStatus: "ARCHIVED",
    method: null,
    methodVersion: null,
    provider: null,
    validatorDisposition: null,
    justification: "user_archive",
    correlationId: null,
    sourceReferences: [],
    metadata: {},
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function deleteCognitiveArtifactPure(
  state: CognitiveEngineState,
  userId: string,
  artifactId: string
): EngineResult<CognitiveArtifact> {
  const artifact = getCognitiveArtifactPure(state, userId, artifactId);
  if (!artifact) {
    return { ok: false, error: "artifact_not_found", state, data: null };
  }
  const updated: CognitiveArtifact = {
    ...artifact,
    status: "DELETED",
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let next: CognitiveEngineState = {
    ...state,
    artifacts: state.artifacts.map((a) => (a.id === artifactId ? updated : a)),
  };
  next = audit(next, {
    userId,
    workspaceId: artifact.workspaceId,
    action: "artifact_deleted",
    artifactId,
    actor: "user",
    previousStatus: artifact.status,
    newStatus: "DELETED",
    method: null,
    methodVersion: null,
    provider: null,
    validatorDisposition: null,
    justification: "user_delete",
    correlationId: null,
    sourceReferences: [],
    metadata: {},
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function revalidateCognitiveArtifactPure(
  state: CognitiveEngineState,
  userId: string,
  artifactId: string,
  context: CognitiveContext
): EngineResult<CognitiveArtifact> {
  const artifact = getCognitiveArtifactPure(state, userId, artifactId);
  if (!artifact) {
    return { ok: false, error: "artifact_not_found", state, data: null };
  }

  // Source rejection / stale
  const evidenceGone = artifact.evidence.every((e) => {
    if (e.sourceLayer === "memory") {
      return !context.memoryContext.memories.some((m) => m.id === e.sourceId);
    }
    if (e.sourceLayer === "identity") {
      return !context.identityContext.claims.some((c) => c.id === e.sourceId);
    }
    return false;
  });

  let updated: CognitiveArtifact = {
    ...artifact,
    lastValidatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (evidenceGone && artifact.evidence.length > 0) {
    updated = { ...updated, status: "OUTDATED" };
  }

  if (
    artifact.validUntil &&
    new Date(artifact.validUntil).getTime() < Date.now()
  ) {
    updated = { ...updated, status: "OUTDATED" };
  }

  const validation = validateCognitiveArtifact(
    updated,
    context,
    state.suppressions.filter(isSuppressionActive)
  );
  if (validation.disposition === "INSUFFICIENT_EVIDENCE") {
    updated = { ...updated, status: "OUTDATED" };
  }

  let next: CognitiveEngineState = {
    ...state,
    artifacts: state.artifacts.map((a) => (a.id === artifactId ? updated : a)),
  };
  next = audit(next, {
    userId,
    workspaceId: artifact.workspaceId,
    action:
      updated.status === "OUTDATED" ? "artifact_outdated" : "revalidation_executed",
    artifactId,
    actor: "system",
    previousStatus: artifact.status,
    newStatus: updated.status,
    method: artifact.method,
    methodVersion: artifact.methodVersion,
    provider: null,
    validatorDisposition: validation.disposition,
    justification: validation.explanation,
    correlationId: context.correlationId,
    sourceReferences: [],
    metadata: {},
  });

  return { ok: true, error: null, state: next, data: updated };
}

export function getCognitiveContextForBrainPure(
  state: CognitiveEngineState,
  userId: string,
  input?: { limit?: number; minConfidence?: number; workspaceId?: string | null }
): CognitiveBrainContext {
  const limit = input?.limit ?? 6;
  const minConfidence = input?.minConfidence ?? 40;
  const items = listCognitiveArtifactsPure(state, userId, {
    limit: 100,
    workspaceId: input?.workspaceId,
    minConfidence,
  }).filter(
    (a) =>
      !["REJECTED", "DELETED", "ARCHIVED", "OUTDATED", "SUPERSEDED", "DISPUTED"].includes(
        a.status
      ) &&
      a.sensitivity !== "RESTRICTED" &&
      a.executionInfluence === "none"
  );

  const pick = (type: CognitiveArtifact["artifactType"]) =>
    items
      .filter((a) => a.artifactType === type)
      .slice(0, limit)
      .map((a) => ({ id: a.id, title: a.title, confidence: a.confidence }));

  return {
    patterns: pick("PATTERN"),
    insights: pick("INSIGHT"),
    conflicts: pick("CONFLICT"),
    hypotheses: pick("HYPOTHESIS"),
    recommendations: pick("RECOMMENDATION"),
    evidenceSummary: items
      .flatMap((a) => a.evidence.map((e) => e.summary))
      .slice(0, 8),
    status: items.length ? "available" : "empty",
    limitations: [
      "read_only",
      "executionInfluence:none",
      "no_mission_creation",
      "no_planner_mutation",
    ],
    executionInfluence: "none",
  };
}

export function bootstrapCognitiveEnginePure(
  state: CognitiveEngineState,
  input: CognitiveBootstrapInput
): EngineResult<{ report: CognitiveBootstrapReport; artifacts: CognitiveArtifact[] }> {
  const context = buildCognitiveContext(
    {
      userId: input.userId,
      workspaceId: input.workspaceId,
      maxItems: input.maxItems ?? 40,
      timeRange: input.timeRange,
      correlationId: input.correlationId ?? `bootstrap_${Date.now()}`,
    },
    {
      identityClaims: input.identityClaims,
      memories: input.memories,
      worldEntities: input.worldEntities,
      worldRelationships: input.worldRelationships,
      missions: input.missions,
    }
  );

  const gen = generateCognitiveArtifactsPure(state, context, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    dryRun: input.dryRun,
    maxArtifacts: input.maxItems ?? 20,
    correlationId: context.correlationId,
  });

  const artifacts = gen.data?.artifacts ?? [];
  const report: CognitiveBootstrapReport = {
    dryRun: Boolean(input.dryRun),
    artifactsGenerated: artifacts.length,
    insufficientCount: gen.data?.run.insufficientCount ?? 0,
    blockedCount: gen.data?.run.blockedCount ?? 0,
    reusedCount: Number(gen.data?.run.report.reusedCount ?? 0),
    items: artifacts.map((a, i) => ({
      artifactType: a.artifactType,
      title: a.title,
      disposition: gen.data?.dispositions[i] ?? "ACCEPT",
      artifactId: a.id,
    })),
  };

  return {
    ok: true,
    error: null,
    state: gen.state,
    data: { report, artifacts },
  };
}
