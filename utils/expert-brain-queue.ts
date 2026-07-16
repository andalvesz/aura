export type IngestionQueueRunCounts = {
  found: number;
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
  pendingDriveRemaining: number;
};

export type IngestionQueueItemOutcome = {
  itemId: string | null;
  previousStatus: string | null;
  currentStatus: string | null;
  stepExecuted: string | null;
  progress: number | null;
  /** Whether the single processed item reached `completed`. */
  itemCompleted: boolean;
  retryScheduled: boolean;
  nextRetryAt: string | null;
  remaining: number;
};

export type IngestionQueueRunResult = IngestionQueueRunCounts &
  IngestionQueueItemOutcome & {
    success: boolean;
    message: string;
    error: string | null;
    memorySafe: true;
  };

export const EMPTY_ITEM_OUTCOME: IngestionQueueItemOutcome = {
  itemId: null,
  previousStatus: null,
  currentStatus: null,
  stepExecuted: null,
  progress: null,
  itemCompleted: false,
  retryScheduled: false,
  nextRetryAt: null,
  remaining: 0,
};

export function buildIngestionQueueMessage(counts: IngestionQueueRunCounts): string {
  const { found, processed, completed, failed, skipped, pendingDriveRemaining } = counts;

  if (found === 0) {
    if (pendingDriveRemaining > 0) {
      return `${pendingDriveRemaining} item(ns) pending_drive aguardando processamento`;
    }
    return "Nenhum item processável encontrado";
  }

  if (processed === 0 && pendingDriveRemaining > 0) {
    return `${pendingDriveRemaining} item(ns) pending_drive não avançaram — verifique Google Drive e OPENAI_API_KEY`;
  }

  const parts = [
    processed > 0 ? `Processados: ${processed}` : null,
    completed > 0 ? `Concluídos: ${completed}` : null,
    failed > 0 ? `Falhas: ${failed}` : null,
    skipped > 0 ? `Ignorados: ${skipped}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Nenhum item avançou de status";
}

export function evaluateIngestionQueueSuccess(counts: IngestionQueueRunCounts): boolean {
  if (counts.processed > 0 || counts.completed > 0) return true;
  if (counts.found === 0 && counts.pendingDriveRemaining === 0) return true;
  if (counts.processed === 0 && counts.pendingDriveRemaining > 0) return false;
  if (counts.failed > 0 && counts.processed === 0) return false;
  return counts.skipped === 0;
}

export function finalizeIngestionQueueRun(
  counts: IngestionQueueRunCounts & { error?: string | null } & Partial<IngestionQueueItemOutcome>
): IngestionQueueRunResult {
  const error = counts.error ?? null;
  const message = buildIngestionQueueMessage(counts);
  const success = !error && evaluateIngestionQueueSuccess(counts);
  const remaining =
    counts.remaining ??
    counts.pendingDriveRemaining + Math.max(0, counts.found - counts.processed);

  return {
    found: counts.found,
    processed: counts.processed,
    completed: counts.completed,
    failed: counts.failed,
    skipped: counts.skipped,
    pendingDriveRemaining: counts.pendingDriveRemaining,
    success,
    message,
    error,
    memorySafe: true,
    itemId: counts.itemId ?? null,
    previousStatus: counts.previousStatus ?? null,
    currentStatus: counts.currentStatus ?? null,
    stepExecuted: counts.stepExecuted ?? null,
    progress: counts.progress ?? null,
    itemCompleted: counts.itemCompleted ?? counts.completed > 0,
    retryScheduled: counts.retryScheduled ?? false,
    nextRetryAt: counts.nextRetryAt ?? null,
    remaining,
  };
}

const STORAGE_FAILURE_PATTERNS = [
  "storage",
  "bucket",
  "object exceeded",
  "payload too large",
  "file size limit",
  "maximum allowed size",
];

export function isDriveStorageFailureError(error: string | null | undefined): boolean {
  if (!error?.trim()) return false;
  const normalized = error.toLowerCase();
  return STORAGE_FAILURE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function shouldResetFailedDriveItem(metadata: unknown, error: string | null | undefined): boolean {
  if (!isDriveStorageFailureError(error)) return false;
  if (typeof metadata !== "object" || !metadata || Array.isArray(metadata)) return false;
  const meta = metadata as Record<string, unknown>;
  return meta.source === "google_drive" || Boolean(meta.drive_file_id);
}
