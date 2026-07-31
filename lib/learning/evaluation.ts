/**
 * Human review, apply, evaluate, revert — controlled application only.
 */

import {
  EVALUATION_WINDOW_MS,
  SUPPRESSION_TTL_MS,
} from "@/lib/learning/types";
import {
  findApplication,
  findProposal,
  hashPayload,
  pushLearningAudit,
  sanitizeLearningMeta,
} from "@/lib/learning/store";
import {
  canApplyWorkspaceLearning,
  canMutateProposal,
  proposalPayload,
  validateProposalConfirmation,
  validateProposedChange,
} from "@/lib/learning/policy";
import type {
  LearningApplication,
  LearningAuditEntry,
  LearningEvaluation,
  LearningProposal,
  LearningState,
  LearningSuppression,
  LearningViewer,
} from "@/lib/learning/types";
import { setPersonality } from "@/lib/orchestrator/session";

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

function upsertProposal(
  state: LearningState,
  proposal: LearningProposal
): LearningState {
  return {
    ...state,
    proposals: [
      proposal,
      ...state.proposals.filter((p) => p.id !== proposal.id),
    ],
  };
}

export function confirmLearningProposalPure(
  state: LearningState,
  viewer: LearningViewer,
  proposalId: string,
  now = new Date().toISOString()
): { state: LearningState; proposal: LearningProposal | null; error: string | null } {
  const proposal = findProposal(state, proposalId);
  if (!proposal) return { state, proposal: null, error: "not_found" };
  if (!canMutateProposal(viewer, proposal)) {
    return {
      state: pushLearningAudit(
        state,
        audit({
          userId: viewer.userId,
          workspaceId: viewer.workspaceId,
          proposalId,
          event: "learning_policy_blocked",
          summary: "confirm_forbidden",
          metadata: {},
        })
      ),
      proposal: null,
      error: "forbidden",
    };
  }
  if (proposal.scope === "WORKSPACE" && !canApplyWorkspaceLearning(viewer)) {
    return { state, proposal: null, error: "workspace_role_required" };
  }
  const check = validateProposalConfirmation({
    proposal,
    payload: proposalPayload(proposal),
    nowIso: now,
  });
  if (!check.ok) return { state, proposal, error: check.error };

  const updated: LearningProposal = {
    ...proposal,
    status: "CONFIRMED",
    updatedAt: now,
    rowVersion: proposal.rowVersion + 1,
  };
  let next = upsertProposal(state, updated);
  next = pushLearningAudit(
    next,
    audit({
      userId: viewer.userId,
      workspaceId: proposal.workspaceId,
      proposalId,
      event: "learning_proposal_confirmed",
      summary: proposal.title,
      metadata: { payloadHash: proposal.payloadHash },
      createdAt: now,
    })
  );
  return { state: next, proposal: updated, error: null };
}

export function rejectLearningProposalPure(
  state: LearningState,
  viewer: LearningViewer,
  proposalId: string,
  reason = "user_rejected",
  now = new Date().toISOString()
): { state: LearningState; proposal: LearningProposal | null; error: string | null } {
  const proposal = findProposal(state, proposalId);
  if (!proposal) return { state, proposal: null, error: "not_found" };
  if (!canMutateProposal(viewer, proposal)) {
    return { state, proposal: null, error: "forbidden" };
  }
  const updated: LearningProposal = {
    ...proposal,
    status: "REJECTED",
    updatedAt: now,
    rowVersion: proposal.rowVersion + 1,
  };
  const suppression: LearningSuppression = {
    id: nid("sup"),
    userId: viewer.userId,
    workspaceId: proposal.workspaceId,
    proposalType: proposal.proposalType,
    patternKey: proposal.patternId
      ? state.patterns.find((p) => p.id === proposal.patternId)?.patternKey ??
        proposal.proposalType
      : proposal.proposalType,
    reason,
    rejectedProposalId: proposal.id,
    createdAt: now,
    expiresAt: new Date(new Date(now).getTime() + SUPPRESSION_TTL_MS).toISOString(),
  };
  let next: LearningState = {
    ...upsertProposal(state, updated),
    suppressions: [suppression, ...state.suppressions],
  };
  next = pushLearningAudit(
    next,
    audit({
      userId: viewer.userId,
      workspaceId: proposal.workspaceId,
      proposalId,
      event: "learning_proposal_rejected",
      summary: reason,
      metadata: { suppressionId: suppression.id },
      createdAt: now,
    })
  );
  return { state: next, proposal: updated, error: null };
}

/**
 * Apply only safe V1 changes after CONFIRMED. Never elevates autonomy / expands allowlist.
 */
export function applyLearningProposalPure(
  state: LearningState,
  viewer: LearningViewer,
  proposalId: string,
  now = new Date().toISOString()
): { state: LearningState; proposal: LearningProposal | null; error: string | null } {
  const proposal = findProposal(state, proposalId);
  if (!proposal) return { state, proposal: null, error: "not_found" };
  if (!canMutateProposal(viewer, proposal)) {
    return { state, proposal: null, error: "forbidden" };
  }
  // Replay / duplicate apply guard (before status gate)
  if (proposal.applicationId) {
    return { state, proposal, error: "already_applied" };
  }
  if (proposal.status !== "CONFIRMED") {
    return { state, proposal, error: "must_confirm_first" };
  }
  const changeCheck = validateProposedChange(proposal.proposedChange);
  if (!changeCheck.ok) return { state, proposal, error: changeCheck.error };

  const hashCheck = validateProposalConfirmation({
    proposal,
    payload: proposalPayload(proposal),
    nowIso: now,
  });
  if (!hashCheck.ok && hashCheck.error === "payload_changed") {
    return { state, proposal, error: hashCheck.error };
  }

  // Controlled side-effect: conversation style preference via orchestrator personality only
  if (proposal.proposalType === "COMMUNICATION_STYLE_UPDATE") {
    const tone = proposal.proposedChange.afterSnapshot.tone;
    if (tone === "concise" || tone === "direct" || tone === "warm" || tone === "formal" || tone === "coach") {
      setPersonality(viewer.userId, { tone });
    }
  }

  const application: LearningApplication = {
    id: nid("app"),
    proposalId: proposal.id,
    userId: viewer.userId,
    appliedAt: now,
    snapshotBefore: { ...proposal.proposedChange.beforeSnapshot },
    snapshotAfter: { ...proposal.proposedChange.afterSnapshot },
    reversible: true,
    revertedAt: null,
  };

  const evaluation: LearningEvaluation = {
    id: nid("eval"),
    proposalId: proposal.id,
    applicationId: application.id,
    baselineMetric: proposal.confidence,
    currentMetric: proposal.confidence,
    windowFrom: now,
    windowTo: new Date(new Date(now).getTime() + EVALUATION_WINDOW_MS).toISOString(),
    sampleSize: 0,
    result: "INCONCLUSIVE",
    limitations: [
      "Sem causalidade absoluta",
      "Janela de avaliação em andamento",
    ],
    completedAt: null,
  };

  const updated: LearningProposal = {
    ...proposal,
    status: "EVALUATING",
    applicationId: application.id,
    evaluationId: evaluation.id,
    updatedAt: now,
    rowVersion: proposal.rowVersion + 1,
  };

  let next: LearningState = {
    ...upsertProposal(state, updated),
    applications: [application, ...state.applications],
    evaluations: [evaluation, ...state.evaluations],
  };
  next = pushLearningAudit(
    next,
    audit({
      userId: viewer.userId,
      workspaceId: proposal.workspaceId,
      proposalId,
      event: "learning_proposal_applied",
      summary: proposal.title,
      metadata: { applicationId: application.id },
      createdAt: now,
    })
  );
  next = pushLearningAudit(
    next,
    audit({
      userId: viewer.userId,
      workspaceId: proposal.workspaceId,
      proposalId,
      event: "learning_evaluation_started",
      summary: evaluation.id,
      metadata: {},
      createdAt: now,
    })
  );
  return { state: next, proposal: updated, error: null };
}

export function completeLearningEvaluationPure(
  state: LearningState,
  viewer: LearningViewer,
  proposalId: string,
  opts?: { usefulAfter?: number; now?: string }
): { state: LearningState; proposal: LearningProposal | null; error: string | null } {
  const proposal = findProposal(state, proposalId);
  if (!proposal || !proposal.evaluationId) {
    return { state, proposal: null, error: "not_found" };
  }
  if (proposal.ownerId !== viewer.userId) {
    return { state, proposal: null, error: "forbidden" };
  }
  const evaluation = state.evaluations.find((e) => e.id === proposal.evaluationId);
  if (!evaluation) return { state, proposal, error: "evaluation_missing" };

  const now = opts?.now ?? new Date().toISOString();
  const current = opts?.usefulAfter ?? evaluation.baselineMetric;
  const result =
    current > evaluation.baselineMetric + 0.05
      ? ("SUCCESSFUL" as const)
      : current < evaluation.baselineMetric - 0.05
        ? ("UNSUCCESSFUL" as const)
        : ("INCONCLUSIVE" as const);

  const updatedEval: LearningEvaluation = {
    ...evaluation,
    currentMetric: current,
    sampleSize: Math.max(evaluation.sampleSize, proposal.sampleSize),
    result,
    completedAt: now,
    limitations: [
      ...evaluation.limitations,
      "Comparação correlacional — não prova causalidade.",
    ],
  };

  const status =
    result === "SUCCESSFUL"
      ? ("SUCCESSFUL" as const)
      : result === "UNSUCCESSFUL"
        ? ("UNSUCCESSFUL" as const)
        : ("APPLIED" as const);

  const updatedProposal: LearningProposal = {
    ...proposal,
    status,
    updatedAt: now,
    rowVersion: proposal.rowVersion + 1,
  };

  let next: LearningState = {
    ...upsertProposal(state, updatedProposal),
    evaluations: [
      updatedEval,
      ...state.evaluations.filter((e) => e.id !== updatedEval.id),
    ],
  };
  next = pushLearningAudit(
    next,
    audit({
      userId: viewer.userId,
      workspaceId: proposal.workspaceId,
      proposalId,
      event: "learning_evaluation_completed",
      summary: result,
      metadata: { current, baseline: evaluation.baselineMetric },
      createdAt: now,
    })
  );
  return { state: next, proposal: updatedProposal, error: null };
}

export function revertLearningProposalPure(
  state: LearningState,
  viewer: LearningViewer,
  proposalId: string,
  now = new Date().toISOString()
): { state: LearningState; proposal: LearningProposal | null; error: string | null } {
  const proposal = findProposal(state, proposalId);
  if (!proposal || !proposal.applicationId) {
    return { state, proposal: null, error: "not_found" };
  }
  if (proposal.ownerId !== viewer.userId) {
    return { state, proposal: null, error: "forbidden" };
  }
  const application = findApplication(state, proposal.applicationId);
  if (!application || !application.reversible) {
    return { state, proposal, error: "not_reversible" };
  }
  if (application.revertedAt) {
    return { state, proposal, error: "already_reverted" };
  }

  // Conflict: if afterSnapshot was changed by a newer application on same component
  const newer = state.applications.find(
    (a) =>
      a.proposalId !== proposal.id &&
      a.userId === viewer.userId &&
      !a.revertedAt &&
      new Date(a.appliedAt).getTime() > new Date(application.appliedAt).getTime() &&
      JSON.stringify(a.snapshotAfter) !== JSON.stringify(application.snapshotAfter)
  );
  // Only block if newer touches same keys
  if (newer) {
    const keys = Object.keys(application.snapshotAfter);
    const overlap = keys.some((k) => k in newer.snapshotAfter);
    if (overlap) {
      return { state, proposal, error: "revert_conflict_newer_change" };
    }
  }

  if (proposal.proposalType === "COMMUNICATION_STYLE_UPDATE") {
    setPersonality(viewer.userId, { tone: "direct" });
  }

  const updatedApp: LearningApplication = {
    ...application,
    revertedAt: now,
  };
  const updatedProposal: LearningProposal = {
    ...proposal,
    status: "REVERTED",
    updatedAt: now,
    rowVersion: proposal.rowVersion + 1,
  };

  let next: LearningState = {
    ...upsertProposal(state, updatedProposal),
    applications: [
      updatedApp,
      ...state.applications.filter((a) => a.id !== updatedApp.id),
    ],
  };
  next = pushLearningAudit(
    next,
    audit({
      userId: viewer.userId,
      workspaceId: proposal.workspaceId,
      proposalId,
      event: "learning_proposal_reverted",
      summary: proposal.title,
      metadata: { applicationId: application.id },
      createdAt: now,
    })
  );
  return { state: next, proposal: updatedProposal, error: null };
}

export function archiveLearningProposalPure(
  state: LearningState,
  viewer: LearningViewer,
  proposalId: string,
  now = new Date().toISOString()
): LearningState {
  const proposal = findProposal(state, proposalId);
  if (!proposal || proposal.ownerId !== viewer.userId) return state;
  const updated = {
    ...proposal,
    status: "ARCHIVED" as const,
    updatedAt: now,
    rowVersion: proposal.rowVersion + 1,
  };
  let next = upsertProposal(state, updated);
  next = pushLearningAudit(
    next,
    audit({
      userId: viewer.userId,
      workspaceId: proposal.workspaceId,
      proposalId,
      event: "learning_proposal_archived",
      summary: "archived",
      metadata: {},
      createdAt: now,
    })
  );
  return next;
}

export function explainLearningProposalPure(
  state: LearningState,
  proposalId: string
): import("@/lib/learning/types").LearningExplanation | null {
  const proposal = findProposal(state, proposalId);
  if (!proposal) return null;
  const supporting = state.signals.filter((s) =>
    proposal.supportingSignalIds.includes(s.id)
  );
  const counter = state.signals.filter((s) =>
    proposal.counterSignalIds.includes(s.id)
  );
  return {
    why: `Padrão observado com amostra ${proposal.sampleSize} e confiança ${proposal.confidence.toFixed(2)}.`,
    signals: supporting.map((s) => `${s.signalType} · ${s.sourceLayer}`),
    sources: [...new Set(supporting.map((s) => s.sourceLayer))],
    context: proposal.context.label,
    sampleSize: proposal.sampleSize,
    duplicatesRemoved: 0,
    counterEvidence: counter.map((s) => `${s.signalType} · ${s.subjectId}`),
    rules: [
      "AUTO_OBSERVE_only",
      "human_review_required",
      "no_autonomy_elevation",
      "no_allowlist_expand",
    ],
    limitations: [
      proposal.possibleRisk,
      "Não declara causalidade absoluta.",
      "Não altera Identity/Memory/Planner diretamente sem confirmação.",
    ],
    exactChange: proposal.proposedChange.description,
  };
}

void hashPayload;
