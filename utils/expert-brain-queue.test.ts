import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIngestionQueueMessage,
  evaluateIngestionQueueSuccess,
  finalizeIngestionQueueRun,
  isDriveStorageFailureError,
  shouldResetFailedDriveItem,
} from "./expert-brain-queue";

test("evaluateIngestionQueueSuccess falha quando pending_drive permanece sem processar", () => {
  assert.equal(
    evaluateIngestionQueueSuccess({
      found: 3,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 3,
      pendingDriveRemaining: 5,
    }),
    false
  );
});

test("evaluateIngestionQueueSuccess passa quando item avança", () => {
  assert.equal(
    evaluateIngestionQueueSuccess({
      found: 1,
      processed: 1,
      completed: 1,
      failed: 0,
      skipped: 0,
      pendingDriveRemaining: 0,
    }),
    true
  );
});

test("waiting_for_openai conta como processado com sucesso parcial", () => {
  const result = finalizeIngestionQueueRun({
    found: 1,
    processed: 1,
    completed: 0,
    failed: 0,
    skipped: 0,
    pendingDriveRemaining: 0,
  });
  assert.equal(result.success, true);
});

test("finalizeIngestionQueueRun não mascara pending_drive pendente", () => {
  const result = finalizeIngestionQueueRun({
    found: 2,
    processed: 0,
    completed: 0,
    failed: 0,
    skipped: 2,
    pendingDriveRemaining: 4,
  });
  assert.equal(result.success, false);
  assert.match(result.message, /pending_drive/i);
});

test("shouldResetFailedDriveItem identifica falhas de Storage do Google Drive", () => {
  assert.equal(
    shouldResetFailedDriveItem(
      { source: "google_drive", drive_file_id: "abc" },
      "Upload para o Storage falhou: object exceeded the maximum allowed size"
    ),
    true
  );
  assert.equal(
    shouldResetFailedDriveItem({ source: "google_drive" }, "Transcrição falhou."),
    false
  );
});

test("isDriveStorageFailureError detecta mensagens de bucket", () => {
  assert.equal(isDriveStorageFailureError("bucket not found"), true);
  assert.equal(isDriveStorageFailureError("token expirado"), false);
});

test("buildIngestionQueueMessage descreve conclusões e falhas", () => {
  const message = buildIngestionQueueMessage({
    found: 2,
    processed: 2,
    completed: 1,
    failed: 1,
    skipped: 0,
    pendingDriveRemaining: 0,
  });
  assert.match(message, /Processados: 2/);
  assert.match(message, /Concluídos: 1/);
  assert.match(message, /Falhas: 1/);
});
