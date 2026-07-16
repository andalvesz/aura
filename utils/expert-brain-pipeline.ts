import type { ExpertIngestionStatus } from "@/types/database";
import { getProgress, isAifChunkStatus } from "@/lib/aif/aif-progress";
import type { ExpertIngestionQueueItem } from "@/types/database";

export type ExpertBrainPipelineStage = "upload" | "transcribe" | "extract" | "complete";

export const PIPELINE_PROGRESS: Record<string, number> = {
  uploaded: 0,
  waiting_for_openai: 25,
  waiting_transcription_retry: 25,
  transcribing: 25,
  transcribed: 45,
  downloaded: 20,
  chunking: 55,
  extracting: 50,
  extracting_chunk: 60,
  normalizing_chunk: 70,
  validating_chunk: 80,
  committing_chunk: 90,
  completed: 100,
  failed: 0,
  pending: 0,
  pending_drive: 10,
  processing: 25,
  done: 100,
};

export const PIPELINE_STAGE_LABELS = [
  { key: "upload", label: "Upload", percent: 0 },
  { key: "transcribe", label: "Transcrição", percent: 25 },
  { key: "extract", label: "Extração", percent: 50 },
  { key: "complete", label: "Concluído", percent: 100 },
] as const;

export function pipelineProgressForStatus(status: ExpertIngestionStatus | string): number {
  return PIPELINE_PROGRESS[status] ?? 0;
}

export function pipelineStageIndex(status: ExpertIngestionStatus | string): number {
  switch (status) {
    case "uploaded":
    case "pending":
    case "pending_drive":
    case "downloaded":
      return 0;
    case "waiting_for_openai":
    case "waiting_transcription_retry":
    case "transcribing":
    case "transcribed":
      return 1;
    case "extracting":
    case "processing":
    case "chunking":
    case "extracting_chunk":
    case "normalizing_chunk":
    case "validating_chunk":
    case "committing_chunk":
      return 2;
    case "completed":
    case "done":
      return 3;
    default:
      return 0;
  }
}

export function ingestionStatusLabel(status: ExpertIngestionStatus | string): string {
  const labels: Record<string, string> = {
    uploaded: "Upload",
    downloaded: "Baixado",
    transcribing: "Transcrevendo",
    transcribed: "Transcrito",
    chunking: "Chunking",
    extracting: "Extraindo",
    extracting_chunk: "Extraindo chunk",
    normalizing_chunk: "Normalizando chunk",
    validating_chunk: "Validando chunk",
    committing_chunk: "Commitando chunk",
    completed: "Concluído",
    waiting_for_openai: "Aguardando OpenAI — configure OPENAI_API_KEY no servidor",
    waiting_transcription_retry: "Aguardando retry do Whisper",
    failed: "Falhou",
    pending: "Upload",
    pending_drive: "Downloadando",
    processing: "Processando",
    done: "Concluído",
  };
  return labels[status] ?? status;
}

export function ingestionStatusColor(status: ExpertIngestionStatus | string): string {
  const colors: Record<string, string> = {
    uploaded: "text-sky-400 bg-sky-500/10",
    downloaded: "text-cyan-400 bg-cyan-500/10",
    transcribing: "text-amber-400 bg-amber-500/10",
    transcribed: "text-amber-300 bg-amber-500/10",
    chunking: "text-violet-300 bg-violet-500/10",
    extracting: "text-violet-400 bg-violet-500/10",
    extracting_chunk: "text-violet-400 bg-violet-500/10",
    normalizing_chunk: "text-indigo-400 bg-indigo-500/10",
    validating_chunk: "text-fuchsia-400 bg-fuchsia-500/10",
    committing_chunk: "text-emerald-300 bg-emerald-500/10",
    completed: "text-emerald-400 bg-emerald-500/10",
    waiting_for_openai: "text-orange-400 bg-orange-500/10",
    waiting_transcription_retry: "text-amber-300 bg-amber-500/10",
    failed: "text-red-400 bg-red-500/10",
    pending: "text-sky-400 bg-sky-500/10",
    pending_drive: "text-cyan-400 bg-cyan-500/10",
    processing: "text-amber-400 bg-amber-500/10",
    done: "text-emerald-400 bg-emerald-500/10",
  };
  return colors[status] ?? "text-zinc-400 bg-zinc-500/10";
}

export function formatAifChunkProgress(item: ExpertIngestionQueueItem): string | null {
  if (!isAifChunkStatus(item.status) && item.status !== "chunking" && item.status !== "transcribed") {
    const progress = getProgress(item);
    if (progress.aifVersion === "v2" && progress.totalChunks > 0) {
      return `Chunk ${Math.min(progress.currentChunk + 1, progress.totalChunks)}/${progress.totalChunks}`;
    }
    return null;
  }
  const progress = getProgress(item);
  if (progress.totalChunks <= 0) return "Preparando chunks…";
  return `Chunk ${Math.min(progress.currentChunk + 1, progress.totalChunks)}/${progress.totalChunks} (${progress.processedChunks.length} ok)`;
}

export function logExpertBrain(stage: ExpertBrainPipelineStage, data: Record<string, unknown>) {
  console.info(`[expert-brain] ${stage}`, data);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
