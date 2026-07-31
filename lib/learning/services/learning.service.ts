/**
 * Learning service — adapters feed signals; cycle generates proposals only.
 */

import {
  applyLearningProposalPure,
  archiveLearningProposalPure,
  completeLearningEvaluationPure,
  confirmLearningProposalPure,
  explainLearningProposalPure,
  getLearningHomeWidgetPure,
  getLearningState,
  ingestLearningSignal,
  listLearningProposalsPure,
  rejectLearningProposalPure,
  revertLearningProposalPure,
  runLearningCyclePure,
  setLearningState,
  type LearningViewer,
  type RawLearningEvent,
} from "@/lib/learning";
import { getDataContext } from "@/lib/supabase/services/context";
import { listFeedback } from "@/lib/aura-brain/learning/feedback";
import { clearOrchestratorCache } from "@/lib/orchestrator";

async function viewerFromCtx(): Promise<LearningViewer> {
  const ctx = await getDataContext();
  return {
    userId: ctx.userId,
    workspaceId: ctx.activeWorkspaceId,
    role: ctx.workspaceRole,
    isWorkspaceMember: Boolean(ctx.activeWorkspaceId && ctx.workspaceRole),
  };
}

/** Import legacy aura-brain feedback into learning signals (adapter). */
export async function importLegacyBrainFeedback() {
  const viewer = await viewerFromCtx();
  let state = getLearningState(viewer.userId);
  const rows = listFeedback(viewer.userId, 100);
  let imported = 0;
  for (const f of rows) {
    const raw: RawLearningEvent = {
      userId: viewer.userId,
      workspaceId: f.workspaceId,
      sourceLayer: "aura-brain",
      event: f.signal,
      sourceType: f.targetKind,
      sourceId: f.targetId,
      subjectType: f.targetKind,
      subjectId: f.targetId,
      idempotencyKey: `aura-brain:${f.id}`,
      occurredAt: f.createdAt,
    };
    const res = ingestLearningSignal(state, raw);
    state = res.state;
    if (res.signal && !res.deduped) imported += 1;
  }
  setLearningState(viewer.userId, state);
  return { imported, error: null as string | null };
}

export async function ingestSignal(raw: Omit<RawLearningEvent, "userId"> & { userId?: string }) {
  const viewer = await viewerFromCtx();
  if (raw.userId && raw.userId !== viewer.userId) {
    return { signal: null, error: "user_mismatch" as string | null };
  }
  let state = getLearningState(viewer.userId);
  const res = ingestLearningSignal(state, { ...raw, userId: viewer.userId });
  setLearningState(viewer.userId, res.state);
  clearOrchestratorCache();
  return {
    signal: res.signal,
    deduped: res.deduped,
    error: res.error,
  };
}

export async function runLearningCycle(opts?: { minSampleSize?: number }) {
  const viewer = await viewerFromCtx();
  await importLegacyBrainFeedback();
  let state = getLearningState(viewer.userId);
  const { state: next, result } = runLearningCyclePure(state, {
    viewer,
    minSampleSize: opts?.minSampleSize,
  });
  setLearningState(viewer.userId, next);
  clearOrchestratorCache();
  return result;
}

export async function listLearningProposals(opts?: {
  status?: string | string[];
  proposalType?: string;
  query?: string;
}) {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  return {
    items: listLearningProposalsPure(state, viewer.userId, opts),
    error: null as string | null,
  };
}

export async function getLearningProposal(id: string) {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  const proposal =
    state.proposals.find(
      (p) => p.id === id && !p.softDeleted && p.userId === viewer.userId
    ) ?? null;
  if (!proposal) return { proposal: null, explanation: null, error: "not_found" };
  return {
    proposal,
    explanation: explainLearningProposalPure(state, id),
    signals: state.signals.filter((s) =>
      [...proposal.supportingSignalIds, ...proposal.counterSignalIds].includes(s.id)
    ),
    application: proposal.applicationId
      ? state.applications.find((a) => a.id === proposal.applicationId) ?? null
      : null,
    evaluation: proposal.evaluationId
      ? state.evaluations.find((e) => e.id === proposal.evaluationId) ?? null
      : null,
    error: null as string | null,
  };
}

export async function confirmLearningProposal(id: string) {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  const res = confirmLearningProposalPure(state, viewer, id);
  setLearningState(viewer.userId, res.state);
  clearOrchestratorCache();
  return { proposal: res.proposal, error: res.error };
}

export async function rejectLearningProposal(id: string, reason?: string) {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  const res = rejectLearningProposalPure(state, viewer, id, reason);
  setLearningState(viewer.userId, res.state);
  clearOrchestratorCache();
  return { proposal: res.proposal, error: res.error };
}

export async function applyLearningProposal(id: string) {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  const res = applyLearningProposalPure(state, viewer, id);
  setLearningState(viewer.userId, res.state);
  clearOrchestratorCache();
  return { proposal: res.proposal, error: res.error };
}

export async function completeLearningEvaluation(
  id: string,
  usefulAfter?: number
) {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  const res = completeLearningEvaluationPure(state, viewer, id, { usefulAfter });
  setLearningState(viewer.userId, res.state);
  return { proposal: res.proposal, error: res.error };
}

export async function revertLearningProposal(id: string) {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  const res = revertLearningProposalPure(state, viewer, id);
  setLearningState(viewer.userId, res.state);
  clearOrchestratorCache();
  return { proposal: res.proposal, error: res.error };
}

export async function archiveLearningProposal(id: string) {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  setLearningState(
    viewer.userId,
    archiveLearningProposalPure(state, viewer, id)
  );
  return { error: null as string | null };
}

export async function getHomeLearningWidget() {
  const viewer = await viewerFromCtx();
  const state = getLearningState(viewer.userId);
  return getLearningHomeWidgetPure(state, viewer.userId);
}
