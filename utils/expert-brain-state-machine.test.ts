import test from "node:test";
import assert from "node:assert/strict";
import {
  bucketForItem,
  classifyIngestionError,
  computeLeaseUntil,
  countBuckets,
  deriveQueueMetrics,
  isItemEligible,
  isLeaseValid,
  isRetryDue,
  isValidTransition,
  planRetry,
  MAX_RECOVERABLE_RETRIES,
} from "./expert-brain-state-machine";

const NOW = new Date("2026-07-16T12:00:00.000Z");
const past = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const future = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

// 1. pending_drive → downloading
test("1. pending_drive transitions to downloading", () => {
  assert.equal(isValidTransition("pending_drive", "downloading"), true);
  // never rewinds to pending_drive without a recovery reason
  assert.equal(isValidTransition("downloading", "pending_drive"), false);
});

// 2. downloading → transcribing
test("2. downloading transitions to transcribing (video)", () => {
  assert.equal(isValidTransition("downloading", "transcribing"), true);
  assert.equal(isValidTransition("downloading", "chunking"), true); // text already present
});

// 3. transcribing empty → waiting_transcription_retry
test("3. empty whisper is recoverable → waiting_transcription_retry path", () => {
  assert.equal(classifyIngestionError("Whisper retornou texto vazio."), "recoverable");
  assert.equal(isValidTransition("transcribing", "waiting_transcription_retry"), true);
});

// 4. retry respects next_retry_at
test("4. retry respects next_retry_at (not due until backoff elapses)", () => {
  const plan = planRetry(0, NOW); // first failure → 5 min
  assert.equal(plan.giveUp, false);
  assert.equal(plan.delayMs, 5 * 60_000);
  assert.ok(plan.nextRetryAt);
  assert.equal(isRetryDue(plan.nextRetryAt, NOW), false);
  assert.equal(isRetryDue(plan.nextRetryAt, new Date(NOW.getTime() + 5 * 60_000 + 1)), true);
});

// 5. fifth recoverable error → failed
test("5. fifth recoverable error gives up (failed)", () => {
  assert.equal(planRetry(1, NOW).giveUp, false); // 2nd
  assert.equal(planRetry(2, NOW).giveUp, false); // 3rd
  assert.equal(planRetry(3, NOW).giveUp, false); // 4th
  const fifth = planRetry(4, NOW); // 5th
  assert.equal(fifth.giveUp, true);
  assert.equal(fifth.retryCount, MAX_RECOVERABLE_RETRIES);
  assert.equal(fifth.nextRetryAt, null);
});

// 6. failed item never blocks the next item
test("6. a failed item is not eligible and does not block others", () => {
  const failed = { status: "failed", lease_until: null, next_retry_at: null };
  const next = { status: "pending_drive", lease_until: null, next_retry_at: null };
  assert.equal(isItemEligible(failed, { now: NOW }), false);
  assert.equal(isItemEligible(next, { now: NOW }), true);
});

// 7. lease prevents duplicate processing
test("7. a valid lease blocks a second worker", () => {
  const leased = { status: "transcribing", lease_until: future(60_000), next_retry_at: null };
  assert.equal(isLeaseValid(leased.lease_until, NOW), true);
  assert.equal(isItemEligible(leased, { now: NOW }), false);
});

// 8. expired lease allows recovery
test("8. an expired lease can be recovered", () => {
  const abandoned = { status: "transcribing", lease_until: past(60_000), next_retry_at: null };
  assert.equal(isLeaseValid(abandoned.lease_until, NOW), false);
  assert.equal(isItemEligible(abandoned, { now: NOW }), true);
});

// 9. current_chunk is resumed
test("9. resume continues from persisted chunk state (never restarts)", () => {
  // committing_chunk can loop to the next extracting_chunk or complete.
  assert.equal(isValidTransition("committing_chunk", "extracting_chunk"), true);
  assert.equal(isValidTransition("committing_chunk", "completed"), true);
  // eligibility is based on persisted status, so a mid-pipeline item resumes.
  const resuming = { status: "committing_chunk", lease_until: past(1000), next_retry_at: null };
  assert.equal(isItemEligible(resuming, { now: NOW }), true);
});

// 10. completed only after all chunks
test("10. completed is terminal and only reachable from committing_chunk", () => {
  assert.equal(isValidTransition("committing_chunk", "completed"), true);
  assert.equal(isValidTransition("extracting_chunk", "completed"), false);
  const done = { status: "completed", lease_until: null, next_retry_at: null };
  assert.equal(isItemEligible(done, { now: NOW }), false);
});

// 11. pending never enters processing
test("11. pending states are not counted as processing", () => {
  const counts = countBuckets(
    [
      { status: "pending_drive" },
      { status: "downloaded" },
      { status: "transcribed" },
      { status: "waiting_for_openai" },
    ],
    { now: NOW }
  );
  assert.equal(counts.processing, 0);
  const { queueProcessing } = deriveQueueMetrics(counts);
  assert.equal(queueProcessing, 0);
});

test("11b. processing state without a valid lease falls back to pending", () => {
  // downloading with an expired lease is NOT active processing.
  assert.equal(
    bucketForItem({ status: "downloading", lease_until: past(1000) }, { now: NOW }),
    "pending"
  );
  // downloading with a live lease IS processing.
  assert.equal(
    bucketForItem({ status: "downloading", lease_until: future(60_000) }, { now: NOW }),
    "processing"
  );
});

// 12. item never appears in two buckets
test("12. buckets are mutually exclusive (sum equals item count)", () => {
  const items = [
    { status: "failed" },
    { status: "completed" },
    { status: "pending_drive", last_error: "Google Drive precisa ser reconectado" },
    { status: "waiting_transcription_retry" },
    { status: "transcribing", lease_until: future(60_000) },
    { status: "downloaded" },
  ];
  const counts = countBuckets(items, { now: NOW });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(total, items.length);
  assert.equal(counts.failed, 1);
  assert.equal(counts.completed, 1);
  assert.equal(counts.waiting_oauth, 1);
  assert.equal(counts.waiting_whisper, 1);
  assert.equal(counts.processing, 1);
  assert.equal(counts.pending, 1);

  const { queuePending, queueProcessing } = deriveQueueMetrics(counts);
  // no double counting: pending(1)+oauth(1)+whisper(1) = 3, processing = 1
  assert.equal(queuePending, 3);
  assert.equal(queueProcessing, 1);
});

// 13. OAuth expired does not mark failed
test("13. OAuth error is classified separately (never permanent-fail)", () => {
  assert.equal(classifyIngestionError("invalid_grant"), "oauth");
  assert.equal(
    classifyIngestionError("Google Drive precisa ser reconectado"),
    "oauth"
  );
  // OAuth-parked pending_drive is not eligible until reconnection.
  const parked = {
    status: "pending_drive",
    last_error: "Google Drive precisa ser reconectado",
    lease_until: null,
    next_retry_at: null,
  };
  assert.equal(isItemEligible(parked, { now: NOW }), false);
  assert.equal(bucketForItem(parked, { now: NOW }), "waiting_oauth");
});

// 14. reconnection preserves progress (item goes back to pending_drive via recovery)
test("14. only recovery reasons may rewind to pending_drive", () => {
  assert.equal(
    isValidTransition("failed", "pending_drive", { resetReason: "oauth_reconnect" }),
    true
  );
  assert.equal(
    isValidTransition("committing_chunk", "pending_drive", { resetReason: "manual_reset" }),
    true
  );
  assert.equal(isValidTransition("committing_chunk", "pending_drive"), false);
});

// 15. API processes a single micro-step (lease window is bounded)
test("15. lease window is bounded and claimable after expiry", () => {
  const leaseUntil = computeLeaseUntil(NOW, 5 * 60_000);
  assert.equal(isLeaseValid(leaseUntil, NOW), true);
  assert.equal(isLeaseValid(leaseUntil, new Date(NOW.getTime() + 5 * 60_000 + 1)), false);
});

test("permanent errors are not retried", () => {
  assert.equal(classifyIngestionError("Arquivo removido do Drive"), "permanent");
  assert.equal(classifyIngestionError("Formato inválido"), "permanent");
  assert.equal(classifyIngestionError("permission denied"), "permanent");
});

test("recoverable errors: 429, 5xx, timeout, network", () => {
  assert.equal(classifyIngestionError("Request failed with 429"), "recoverable");
  assert.equal(classifyIngestionError("503 Service Unavailable"), "recoverable");
  assert.equal(classifyIngestionError("socket hang up"), "recoverable");
  assert.equal(classifyIngestionError("fetch failed"), "recoverable");
});
