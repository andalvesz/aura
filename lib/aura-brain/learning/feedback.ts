/**
 * Learning / feedback signals — store only; no auto rule changes in Sprint 4.
 */

export type FeedbackSignal =
  | "util"
  | "nao_util"
  | "concluido"
  | "ignorado"
  | "nao_sugerir_novamente";

export type FeedbackTargetKind =
  | "recommendation"
  | "insight"
  | "plan"
  | "action";

export type AuraBrainFeedback = {
  id: string;
  userId: string;
  workspaceId: string | null;
  targetKind: FeedbackTargetKind;
  targetId: string;
  signal: FeedbackSignal;
  createdAt: string;
};

const feedbackStore: AuraBrainFeedback[] = [];

export function recordFeedback(
  entry: Omit<AuraBrainFeedback, "id" | "createdAt"> & { id?: string }
): AuraBrainFeedback {
  const row: AuraBrainFeedback = {
    id: entry.id ?? `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: entry.userId,
    workspaceId: entry.workspaceId,
    targetKind: entry.targetKind,
    targetId: entry.targetId,
    signal: entry.signal,
    createdAt: new Date().toISOString(),
  };
  feedbackStore.unshift(row);
  return row;
}

export function listFeedback(userId: string, limit = 50): AuraBrainFeedback[] {
  return feedbackStore.filter((f) => f.userId === userId).slice(0, limit);
}

export function clearFeedback(userId?: string): void {
  if (!userId) {
    feedbackStore.length = 0;
    return;
  }
  for (let i = feedbackStore.length - 1; i >= 0; i--) {
    if (feedbackStore[i]?.userId === userId) feedbackStore.splice(i, 1);
  }
}

export function shouldSuppressTarget(
  userId: string,
  targetId: string
): boolean {
  return feedbackStore.some(
    (f) =>
      f.userId === userId &&
      f.targetId === targetId &&
      f.signal === "nao_sugerir_novamente"
  );
}
