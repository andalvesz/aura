/**
 * Expert Brain — Canonical Ingestion State Machine (Sprint 1 stabilization).
 *
 * Pure, dependency-light module (types only) so it is fully unit-testable and
 * safe to import from both server and client. It is the single source of truth
 * for:
 *   - canonical operational states + legacy compatibility
 *   - transition validation
 *   - lease/lock validity
 *   - exponential retry scheduling + recoverable/permanent error classification
 *   - mutually-exclusive dashboard buckets + queuePending/queueProcessing
 *
 * NOTHING here touches the database — the service/repository layer applies it.
 */

import { isOauthReconnectError } from "@/utils/google-drive-oauth-errors";

// ---------------------------------------------------------------------------
// Canonical states
// ---------------------------------------------------------------------------

/** States a NEW execution is allowed to produce. */
export const CANONICAL_STATES = [
  "pending_drive",
  "downloading",
  "downloaded",
  "waiting_for_openai",
  "transcribing",
  "waiting_transcription_retry",
  "transcribed",
  "chunking",
  "extracting_chunk",
  "normalizing_chunk",
  "validating_chunk",
  "committing_chunk",
  "completed",
  "failed",
] as const;

export type CanonicalState = (typeof CANONICAL_STATES)[number];

/**
 * Legacy states accepted for backwards compatibility. They must never be
 * *produced* by new executions, but existing rows may still carry them.
 */
export const LEGACY_STATES = [
  "uploaded",
  "extracting",
  "pending",
  "processing",
  "done",
] as const;

export type LegacyState = (typeof LEGACY_STATES)[number];

export type IngestionState = CanonicalState | LegacyState;

const CANONICAL_SET = new Set<string>(CANONICAL_STATES);
const LEGACY_SET = new Set<string>(LEGACY_STATES);

export function isCanonicalState(status: string): status is CanonicalState {
  return CANONICAL_SET.has(status);
}

export function isLegacyState(status: string): status is LegacyState {
  return LEGACY_SET.has(status);
}

export function isKnownState(status: string): status is IngestionState {
  return CANONICAL_SET.has(status) || LEGACY_SET.has(status);
}

/** Terminal states: no further automatic processing. */
export const TERMINAL_STATES = new Set<string>(["completed", "failed", "done"]);

export function isTerminalState(status: string): boolean {
  return TERMINAL_STATES.has(status);
}

/**
 * Active *processing* states — an item in one of these is expected to hold a
 * valid lease while a worker owns it. Used to distinguish real processing from
 * queued/pending work in the metrics.
 */
export const PROCESSING_STATES = new Set<string>([
  "downloading",
  "transcribing",
  "chunking",
  "extracting_chunk",
  "normalizing_chunk",
  "validating_chunk",
  "committing_chunk",
  // legacy active
  "extracting",
  "processing",
]);

export function isProcessingState(status: string): boolean {
  return PROCESSING_STATES.has(status);
}

/** Statuses that are eligible to be picked up by a worker. */
export const WORKABLE_STATES: IngestionState[] = [
  "pending_drive",
  "downloading",
  "downloaded",
  "waiting_for_openai",
  "transcribing",
  "waiting_transcription_retry",
  "transcribed",
  "chunking",
  "extracting_chunk",
  "normalizing_chunk",
  "validating_chunk",
  "committing_chunk",
  // legacy compatibility
  "uploaded",
  "extracting",
  "pending",
  "processing",
];

const WORKABLE_SET = new Set<string>(WORKABLE_STATES);

export function isWorkableState(status: string): boolean {
  return WORKABLE_SET.has(status);
}

// ---------------------------------------------------------------------------
// Transition rules
// ---------------------------------------------------------------------------

/**
 * Allowed transitions between canonical states. Legacy states map into the
 * canonical machine but are never emitted by new executions.
 *
 * Special rule: nothing may return to `pending_drive` EXCEPT the three
 * recovery paths (OAuth reconnect, manual reset, abandoned-lease recovery),
 * which are expressed via {@link isAllowedPendingDriveReset} rather than the
 * normal graph.
 */
export const TRANSITIONS: Record<CanonicalState, CanonicalState[]> = {
  pending_drive: ["downloading", "failed"],
  downloading: ["downloaded", "transcribing", "chunking", "waiting_for_openai", "failed"],
  downloaded: ["transcribing", "chunking", "failed"],
  waiting_for_openai: ["transcribing", "failed"],
  transcribing: ["transcribed", "waiting_transcription_retry", "failed"],
  waiting_transcription_retry: ["transcribing", "failed"],
  transcribed: ["chunking", "failed"],
  chunking: ["extracting_chunk", "failed"],
  extracting_chunk: ["normalizing_chunk", "committing_chunk", "failed"],
  normalizing_chunk: ["validating_chunk", "failed"],
  validating_chunk: ["committing_chunk", "failed"],
  committing_chunk: ["extracting_chunk", "completed", "failed"],
  completed: [],
  failed: ["pending_drive"], // only via explicit reset/recovery
};

export type PendingDriveResetReason =
  | "oauth_reconnect"
  | "manual_reset"
  | "lease_recovery";

/**
 * A transition back to pending_drive is only legal for the three recovery
 * reasons. Everything else must NOT rewind to pending_drive.
 */
export function isAllowedPendingDriveReset(reason: PendingDriveResetReason | null | undefined): boolean {
  return (
    reason === "oauth_reconnect" ||
    reason === "manual_reset" ||
    reason === "lease_recovery"
  );
}

export function isValidTransition(
  from: string,
  to: string,
  options?: { resetReason?: PendingDriveResetReason | null }
): boolean {
  if (from === to) return true; // idempotent re-save of same micro-step
  if (to === "pending_drive") {
    return isAllowedPendingDriveReset(options?.resetReason);
  }
  if (!isCanonicalState(from)) {
    // Legacy source — allow forward moves into any canonical state except
    // an illegal rewind to pending_drive (handled above).
    return isCanonicalState(to);
  }
  return TRANSITIONS[from].includes(to as CanonicalState);
}

// ---------------------------------------------------------------------------
// Lease / lock
// ---------------------------------------------------------------------------

export const DEFAULT_LEASE_MS = 5 * 60_000; // 5 minutes

export type LeaseFields = {
  processing_by?: string | null;
  lease_until?: string | null;
};

/** True when the lease is still held (not expired) at `now`. */
export function isLeaseValid(leaseUntil: string | null | undefined, now: Date = new Date()): boolean {
  if (!leaseUntil) return false;
  const until = Date.parse(leaseUntil);
  if (Number.isNaN(until)) return false;
  return until > now.getTime();
}

/** True when a worker may claim this item (no lease, or lease expired). */
export function isLeaseAcquirable(
  item: LeaseFields,
  now: Date = new Date()
): boolean {
  return !isLeaseValid(item.lease_until, now);
}

export function computeLeaseUntil(now: Date = new Date(), leaseMs = DEFAULT_LEASE_MS): string {
  return new Date(now.getTime() + leaseMs).toISOString();
}

// ---------------------------------------------------------------------------
// Retry / backoff
// ---------------------------------------------------------------------------

export const MAX_RECOVERABLE_RETRIES = 5;

/** Backoff schedule per failure number (1-indexed). 5th → give up (failed). */
export const RETRY_BACKOFF_MS: number[] = [
  5 * 60_000, //   1st failure → 5 minutes
  15 * 60_000, //  2nd failure → 15 minutes
  60 * 60_000, //  3rd failure → 1 hour
  6 * 60 * 60_000, // 4th failure → 6 hours
];

export type RetryDecision = {
  /** Whether to permanently fail instead of scheduling a retry. */
  giveUp: boolean;
  /** The retry_count to persist (previous + 1). */
  retryCount: number;
  /** Delay until the next attempt (ms), or null when giving up. */
  delayMs: number | null;
  /** ISO timestamp of the next attempt, or null when giving up. */
  nextRetryAt: string | null;
};

/**
 * Decide the next retry step for a recoverable failure.
 *
 * @param previousRetryCount how many recoverable failures were already recorded
 */
export function planRetry(
  previousRetryCount: number,
  now: Date = new Date()
): RetryDecision {
  const retryCount = Math.max(0, previousRetryCount) + 1;
  if (retryCount >= MAX_RECOVERABLE_RETRIES) {
    return { giveUp: true, retryCount, delayMs: null, nextRetryAt: null };
  }
  const delayMs = RETRY_BACKOFF_MS[retryCount - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
  return {
    giveUp: false,
    retryCount,
    delayMs,
    nextRetryAt: new Date(now.getTime() + delayMs).toISOString(),
  };
}

/** True once next_retry_at has elapsed (or is unset). */
export function isRetryDue(nextRetryAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!nextRetryAt) return true;
  const at = Date.parse(nextRetryAt);
  if (Number.isNaN(at)) return true;
  return at <= now.getTime();
}

export type IngestionErrorKind = "recoverable" | "permanent" | "oauth";

const RECOVERABLE_PATTERNS = [
  "timeout",
  "timed out",
  "temporarily",
  "temporária",
  "temporario",
  "temporário",
  "rate limit",
  "429",
  "too many requests",
  "500",
  "502",
  "503",
  "504",
  "bad gateway",
  "gateway timeout",
  "service unavailable",
  "server error",
  "internal error",
  "whisper retornou texto vazio",
  "whisper vazio",
  "texto vazio",
  "empty transcription",
  "openai indisponível",
  "openai indisponivel",
  "openai unavailable",
  "econnreset",
  "econnrefused",
  "etimedout",
  "socket hang up",
  "network",
  "fetch failed",
  "quota",
];

const PERMANENT_PATTERNS = [
  "arquivo removido",
  "file removed",
  "file not found",
  "não encontrado",
  "nao encontrado",
  "not found",
  "formato inválido",
  "formato invalido",
  "invalid format",
  "unsupported",
  "não suportado",
  "nao suportado",
  "permissão definitiva",
  "permissao definitiva",
  "permission denied",
  "forbidden",
  "sem áudio",
  "sem audio",
  "no audio",
  "sem texto",
  "estrutura de dados impossível",
  "estrutura de dados impossivel",
  "unprocessable",
];

/**
 * Classify a failure message into recoverable / permanent / oauth.
 * OAuth reconnect errors are handled by the OAuth flow, not retry/backoff.
 */
export function classifyIngestionError(message: string | null | undefined): IngestionErrorKind {
  if (!message?.trim()) return "recoverable";
  const normalized = message.toLowerCase();

  if (isOauthReconnectError(message)) return "oauth";

  // Permanent wins over recoverable when both patterns are present, EXCEPT the
  // deliberately recoverable "whisper empty" case which is checked first.
  if (RECOVERABLE_PATTERNS.some((p) => normalized.includes(p))) {
    return "recoverable";
  }
  if (PERMANENT_PATTERNS.some((p) => normalized.includes(p))) {
    return "permanent";
  }

  // Unknown → treat as recoverable so a transient hiccup never hard-fails an
  // item on the first try. The retry cap eventually converts it to failed.
  return "recoverable";
}

// ---------------------------------------------------------------------------
// Eligibility (worker selection)
// ---------------------------------------------------------------------------

export type EligibilityFields = {
  status: string;
  lease_until?: string | null;
  next_retry_at?: string | null;
  last_error?: string | null;
  error?: string | null;
};

/**
 * Whether an item can be picked up right now.
 * @param driveConnectionExpired when true, pending_drive/OAuth-parked items are skipped.
 */
export function isItemEligible(
  item: EligibilityFields,
  options: { now?: Date; driveConnectionExpired?: boolean } = {}
): boolean {
  const now = options.now ?? new Date();
  if (isTerminalState(item.status)) return false;
  if (!isWorkableState(item.status)) return false;
  if (isLeaseValid(item.lease_until, now)) return false; // someone owns it
  if (!isRetryDue(item.next_retry_at, now)) return false; // backing off

  // OAuth-parked pending_drive items wait for reconnection — never auto-retry.
  const oauthParked =
    item.status === "pending_drive" &&
    (isOauthReconnectError(item.last_error) || isOauthReconnectError(item.error));
  if (oauthParked) return false;
  if (item.status === "pending_drive" && options.driveConnectionExpired) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Buckets / metrics (mutually exclusive)
// ---------------------------------------------------------------------------

export type IngestionBucket =
  | "pending"
  | "processing"
  | "waiting_oauth"
  | "waiting_whisper"
  | "completed"
  | "failed";

export type BucketFields = {
  status: string;
  lease_until?: string | null;
  last_error?: string | null;
  error?: string | null;
};

/**
 * Classify an item into exactly ONE bucket. Priority order guarantees an item
 * is never counted twice:
 *   failed → completed → waiting_oauth → waiting_whisper → processing → pending
 */
export function bucketForItem(
  item: BucketFields,
  options: { driveConnectionExpired?: boolean; now?: Date } = {}
): IngestionBucket {
  const now = options.now ?? new Date();
  const status = item.status;

  if (status === "failed") return "failed";
  if (status === "completed" || status === "done") return "completed";

  const oauthError =
    isOauthReconnectError(item.last_error) || isOauthReconnectError(item.error);
  if (status === "pending_drive" && (options.driveConnectionExpired || oauthError)) {
    return "waiting_oauth";
  }

  if (status === "waiting_for_openai" || status === "waiting_transcription_retry") {
    return "waiting_whisper";
  }

  // Real processing only counts when the lease is still held.
  if (isProcessingState(status) && isLeaseValid(item.lease_until, now)) {
    return "processing";
  }

  return "pending";
}

export type IngestionBucketCounts = Record<IngestionBucket, number>;

export function emptyBucketCounts(): IngestionBucketCounts {
  return {
    pending: 0,
    processing: 0,
    waiting_oauth: 0,
    waiting_whisper: 0,
    completed: 0,
    failed: 0,
  };
}

export function countBuckets(
  items: BucketFields[],
  options: { driveConnectionExpired?: boolean; now?: Date } = {}
): IngestionBucketCounts {
  const counts = emptyBucketCounts();
  for (const item of items) {
    counts[bucketForItem(item, options)] += 1;
  }
  return counts;
}

/**
 * Derive the two summary numbers from the mutually-exclusive buckets so a given
 * item is never counted in both:
 *   - queueProcessing = processing bucket only
 *   - queuePending    = every non-terminal, non-processing bucket
 */
export function deriveQueueMetrics(counts: IngestionBucketCounts): {
  queuePending: number;
  queueProcessing: number;
} {
  return {
    queueProcessing: counts.processing,
    queuePending: counts.pending + counts.waiting_oauth + counts.waiting_whisper,
  };
}
