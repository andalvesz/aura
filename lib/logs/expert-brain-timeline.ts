import type { Json } from "@/types/database";
import { recordSystemLogInternal } from "@/lib/logs/system-log.service";

/**
 * Per-item ingestion timeline events. Reuses the existing `system_logs` table
 * (modulo = "expert-brain") — no new table required.
 */
export type IngestionTimelineEvent =
  | "queued"
  | "download_started"
  | "download_completed"
  | "transcription_started"
  | "transcription_completed"
  | "chunking_completed"
  | "chunk_extracted"
  | "chunk_normalized"
  | "chunk_validated"
  | "chunk_committed"
  | "retry_scheduled"
  | "completed"
  | "failed";

const EVENT_TIPO: Record<
  IngestionTimelineEvent,
  "info" | "success" | "warning" | "error"
> = {
  queued: "info",
  download_started: "info",
  download_completed: "info",
  transcription_started: "info",
  transcription_completed: "info",
  chunking_completed: "info",
  chunk_extracted: "info",
  chunk_normalized: "info",
  chunk_validated: "info",
  chunk_committed: "info",
  retry_scheduled: "warning",
  completed: "success",
  failed: "error",
};

export const EXPERT_BRAIN_TIMELINE_MODULE = "expert-brain-ingestion";

/**
 * Map a status transition to a timeline event (or null when the transition is
 * not noteworthy). Used by the processor so individual stage functions don't
 * need instrumentation.
 */
export function eventForTransition(
  from: string,
  to: string
): IngestionTimelineEvent | null {
  if (from === to) return null;
  if (to === "failed") return "failed";
  if (to === "completed") return "completed";
  if (to === "downloading") return "download_started";
  if (from === "downloading" && (to === "downloaded" || to === "transcribing" || to === "chunking" || to === "uploaded")) {
    return "download_completed";
  }
  if (to === "transcribing") return "transcription_started";
  if (to === "transcribed") return "transcription_completed";
  if (to === "extracting_chunk" && (from === "chunking" || from === "transcribed" || from === "downloaded")) {
    return "chunking_completed";
  }
  if (from === "extracting_chunk" && to === "normalizing_chunk") return "chunk_extracted";
  if (from === "normalizing_chunk" && to === "validating_chunk") return "chunk_normalized";
  if (from === "validating_chunk" && to === "committing_chunk") return "chunk_validated";
  if (from === "committing_chunk" && to === "extracting_chunk") return "chunk_committed";
  return null;
}

/**
 * Records a timeline event. Never throws — timeline logging must not break the
 * pipeline.
 */
export async function recordIngestionEvent(
  ingestionId: string,
  event: IngestionTimelineEvent,
  detalhes: Record<string, unknown> = {}
): Promise<void> {
  try {
    await recordSystemLogInternal({
      tipo: EVENT_TIPO[event],
      modulo: EXPERT_BRAIN_TIMELINE_MODULE,
      mensagem: `[${event}] ${ingestionId}`,
      detalhes: { ingestion_id: ingestionId, event, ...detalhes } as Json,
    });
  } catch (err) {
    console.warn("[expert-brain-timeline] failed to record event", {
      ingestionId,
      event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
