import type { ExpertIngestionStatus } from "@/types/database";

export type ExpertBrainPipelineStage = "upload" | "transcribe" | "extract" | "complete";

export const PIPELINE_PROGRESS: Record<string, number> = {
  uploaded: 0,
  waiting_for_openai: 25,
  transcribing: 25,
  extracting: 50,
  completed: 100,
  failed: 0,
  pending: 0,
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
      return 0;
    case "waiting_for_openai":
    case "transcribing":
      return 1;
    case "extracting":
    case "processing":
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
    transcribing: "Transcrevendo",
    extracting: "Extraindo",
    completed: "Concluído",
    waiting_for_openai: "Aguardando OpenAI",
    failed: "Falhou",
    pending: "Upload",
    processing: "Processando",
    done: "Concluído",
  };
  return labels[status] ?? status;
}

export function ingestionStatusColor(status: ExpertIngestionStatus | string): string {
  const colors: Record<string, string> = {
    uploaded: "text-sky-400 bg-sky-500/10",
    transcribing: "text-amber-400 bg-amber-500/10",
    extracting: "text-violet-400 bg-violet-500/10",
    completed: "text-emerald-400 bg-emerald-500/10",
    waiting_for_openai: "text-orange-400 bg-orange-500/10",
    failed: "text-red-400 bg-red-500/10",
    pending: "text-sky-400 bg-sky-500/10",
    processing: "text-amber-400 bg-amber-500/10",
    done: "text-emerald-400 bg-emerald-500/10",
  };
  return colors[status] ?? "text-zinc-400 bg-zinc-500/10";
}

export function logExpertBrain(stage: ExpertBrainPipelineStage, data: Record<string, unknown>) {
  console.info(`[expert-brain] ${stage}`, data);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
