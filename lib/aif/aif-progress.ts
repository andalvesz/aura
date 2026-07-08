import type { ExpertIngestionQueueItem, ExpertIngestionStatus, Json } from "@/types/database";
import type { AifExtractionDraft } from "@/lib/aif/knowledge-extractor";

export const AIF_VERSION_V2 = "v2" as const;

export type AifV2QueueMetadata = {
  source?: string | null;
  driveFileId?: string | null;
  drive_file_id?: string | null;
  fileName?: string | null;
  totalChunks?: number;
  currentChunk?: number;
  processedChunks?: number[];
  transcriptPath?: string | null;
  transcript_path?: string | null;
  chunkPaths?: string[];
  aifVersion?: typeof AIF_VERSION_V2 | string;
  expertSourceId?: string | null;
  lesson_id?: string | null;
  course_id?: string | null;
  module_id?: string | null;
  author?: string | null;
  niche?: string | null;
  pendingChunkDraft?: AifExtractionDraft | null;
  chunkTitle?: string | null;
};

export type AifProgressSnapshot = {
  source: string | null;
  driveFileId: string | null;
  fileName: string | null;
  totalChunks: number;
  currentChunk: number;
  processedChunks: number[];
  transcriptPath: string | null;
  chunkPaths: string[];
  aifVersion: string;
  expertSourceId: string | null;
  pendingChunkDraft: AifExtractionDraft | null;
  lessonId: string | null;
  courseId: string | null;
  moduleId: string | null;
  author: string | null;
  niche: string | null;
};

export const AIF_CHUNK_STATUSES: ExpertIngestionStatus[] = [
  "downloaded",
  "transcribed",
  "chunking",
  "extracting_chunk",
  "normalizing_chunk",
  "validating_chunk",
  "committing_chunk",
];

export function isAifChunkStatus(status: string): boolean {
  return (AIF_CHUNK_STATUSES as string[]).includes(status);
}

function asRecord(metadata: unknown): Record<string, unknown> {
  if (typeof metadata === "object" && metadata && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

/** Pure — safe for client components */
export function getProgress(item: ExpertIngestionQueueItem): AifProgressSnapshot {
  const meta = asRecord(item.metadata);
  return {
    source: asString(meta.source),
    driveFileId: asString(meta.driveFileId) ?? asString(meta.drive_file_id),
    fileName: asString(meta.fileName) ?? item.file_name,
    totalChunks: asNumber(meta.totalChunks, 0),
    currentChunk: asNumber(meta.currentChunk, 0),
    processedChunks: asNumberArray(meta.processedChunks),
    transcriptPath: asString(meta.transcriptPath) ?? asString(meta.transcript_path),
    chunkPaths: asStringArray(meta.chunkPaths),
    aifVersion: asString(meta.aifVersion) ?? "1.0",
    expertSourceId: asString(meta.expertSourceId),
    pendingChunkDraft: (meta.pendingChunkDraft as AifExtractionDraft | null) ?? null,
    lessonId: asString(meta.lesson_id),
    courseId: asString(meta.course_id),
    moduleId: asString(meta.module_id),
    author: asString(meta.author),
    niche: asString(meta.niche),
  };
}

export function aifChunkProgressPercent(
  progress: Pick<AifProgressSnapshot, "totalChunks" | "processedChunks" | "currentChunk">
): number {
  const total = Math.max(0, progress.totalChunks);
  if (total <= 0) return 50;
  const done = progress.processedChunks.length;
  const base = 50;
  const span = 50;
  return Math.min(99, Math.round(base + (done / total) * span));
}

export function allChunksCompleted(progress: AifProgressSnapshot): boolean {
  return progress.totalChunks > 0 && progress.processedChunks.length >= progress.totalChunks;
}

export function buildAifV2MetadataPatch(
  progress: Partial<AifProgressSnapshot> & { aifVersion?: string }
): AifV2QueueMetadata {
  return {
    aifVersion: progress.aifVersion ?? AIF_VERSION_V2,
    ...(progress.source !== undefined ? { source: progress.source } : {}),
    ...(progress.driveFileId !== undefined
      ? { driveFileId: progress.driveFileId, drive_file_id: progress.driveFileId }
      : {}),
    ...(progress.fileName !== undefined ? { fileName: progress.fileName } : {}),
    ...(progress.totalChunks !== undefined ? { totalChunks: progress.totalChunks } : {}),
    ...(progress.currentChunk !== undefined ? { currentChunk: progress.currentChunk } : {}),
    ...(progress.processedChunks !== undefined
      ? { processedChunks: progress.processedChunks }
      : {}),
    ...(progress.transcriptPath !== undefined
      ? { transcriptPath: progress.transcriptPath, transcript_path: progress.transcriptPath }
      : {}),
    ...(progress.chunkPaths !== undefined ? { chunkPaths: progress.chunkPaths } : {}),
    ...(progress.expertSourceId !== undefined ? { expertSourceId: progress.expertSourceId } : {}),
    ...(progress.pendingChunkDraft !== undefined
      ? { pendingChunkDraft: progress.pendingChunkDraft }
      : {}),
  };
}

/** Merge helper for callers that already have base metadata */
export function mergeQueueMetadata(
  existing: unknown,
  patch: AifV2QueueMetadata | Record<string, unknown>
): Json {
  return {
    ...asRecord(existing),
    ...patch,
  } as Json;
}
