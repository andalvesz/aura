import test from "node:test";
import assert from "node:assert/strict";
import {
  isInvalidGrantError,
  isOauthReconnectError,
} from "./google-drive-oauth-errors";
import {
  bucketForIngestionItem,
  countIngestionBuckets,
  emptyExpertBrainDashboard,
  ingestionBucketLabel,
} from "./expert-brain-dashboard";

test("isInvalidGrantError detects Google expired/revoked token", () => {
  assert.equal(
    isInvalidGrantError(
      'Falha ao renovar token: {"error":"invalid_grant","error_description":"Token has been expired or revoked."}'
    ),
    true
  );
  assert.equal(isInvalidGrantError("Token has been expired or revoked."), true);
  assert.equal(isInvalidGrantError("network timeout"), false);
});

test("isOauthReconnectError covers reconnect messaging", () => {
  assert.equal(isOauthReconnectError("Google Drive precisa ser reconectado"), true);
  assert.equal(isOauthReconnectError("Refresh token ausente."), true);
  assert.equal(isOauthReconnectError("Upload falhou"), false);
});

test("ingestion buckets separate oauth and whisper waits", () => {
  const items = [
    { status: "pending_drive" as const, last_error: null, error: null },
    {
      status: "pending_drive" as const,
      last_error: "invalid_grant",
      error: null,
    },
    {
      status: "waiting_transcription_retry" as const,
      last_error: "Whisper retornou texto vazio.",
      error: null,
    },
    // processing only counts with a valid (unexpired) lease per the canonical spec
    {
      status: "chunking" as const,
      last_error: null,
      error: null,
      lease_until: new Date(Date.now() + 60_000).toISOString(),
    },
    { status: "completed" as const, last_error: null, error: null },
    { status: "failed" as const, last_error: null, error: "boom" },
  ];

  assert.equal(bucketForIngestionItem(items[0], false), "pending");
  assert.equal(bucketForIngestionItem(items[0], true), "waiting_oauth");
  assert.equal(bucketForIngestionItem(items[1], false), "waiting_oauth");
  assert.equal(bucketForIngestionItem(items[2], false), "waiting_whisper");
  assert.equal(bucketForIngestionItem(items[3], false), "processing");
  // same processing status but with an expired lease → pending (never double count)
  assert.equal(
    bucketForIngestionItem(
      { status: "chunking", last_error: null, error: null, lease_until: null },
      false
    ),
    "pending"
  );
  assert.equal(bucketForIngestionItem(items[4], false), "completed");
  assert.equal(bucketForIngestionItem(items[5], false), "failed");

  const counts = countIngestionBuckets(items, true);
  assert.equal(counts.pending, 0);
  assert.equal(counts.waiting_oauth, 2);
  assert.equal(counts.waiting_whisper, 1);
  assert.equal(counts.processing, 1);
  assert.equal(counts.completed, 1);
  assert.equal(counts.failed, 1);
});

test("emptyExpertBrainDashboard includes recovery fields", () => {
  const dashboard = emptyExpertBrainDashboard();
  assert.equal(dashboard.driveConnection.needsReconnect, false);
  assert.equal(dashboard.ingestionBuckets.waiting_oauth, 0);
  assert.equal(ingestionBucketLabel("waiting_oauth"), "Waiting OAuth");
  assert.equal(ingestionBucketLabel("waiting_whisper"), "Waiting Whisper");
});
