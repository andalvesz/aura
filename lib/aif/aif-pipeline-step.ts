import {
  createChunkId,
  logAifChunkPlan,
  splitTextIntoChunks,
  AIF_HARD_MAX_EXTRACT_CHARS,
  AIF_MAX_CHUNK_CHARS,
} from "@/lib/aif/chunking";
import {
  finalizeChunkKnowledge,
  emptyExtractionDraft,
} from "@/lib/aif/aif-commit";
import {
  allChunksCompleted,
  aifChunkProgressPercent,
  buildAifV2MetadataPatch,
  getProgress,
  AIF_VERSION_V2,
} from "@/lib/aif/aif-progress";
import { updateProgress } from "@/lib/aif/aif-progress-update";
import { runAifKnowledgeExtractor, type AifExtractionDraft } from "@/lib/aif/knowledge-extractor";
import { runAifKnowledgeNormalizer } from "@/lib/aif/knowledge-normalizer";
import {
  boostConfidenceAfterValidation,
  runAifKnowledgeValidator,
} from "@/lib/aif/knowledge-validator";
import { ensureAifOperationalDecisionRules } from "@/lib/aif/decision-rules";
import { commitStructuredKnowledgeToExpertBrain } from "@/lib/supabase/services/aif.service";
import { downloadExpertBrainTranscript } from "@/lib/supabase/services/expert-brain-transcription.service";
import { getOptionalDataContext } from "@/lib/supabase/services/context";
import {
  ExpertCourseLessonsRepository,
  ExpertTranscriptsRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import { EXPERT_BRAIN_TRANSCRIPTS_BUCKET } from "@/utils/expert-brain-storage";
import { countAifEntities, type AifPipelineInput } from "@/utils/aif";
import type { ExpertIngestionQueueItem, ExpertIngestionStatus, Json } from "@/types/database";

export type AifPipelineStepResult = {
  status: ExpertIngestionStatus;
  advanced: boolean;
  completed: boolean;
  failed: boolean;
  error: string | null;
  currentChunk: number | null;
  totalChunks: number | null;
  memorySafe: true;
  step: string;
};

function aifStepError(step: string, message: string): Error {
  return new Error(`[aif-step:${step}] ${message}`);
}

function failStep(
  status: ExpertIngestionStatus,
  error: string,
  step: string
): AifPipelineStepResult {
  return {
    status,
    advanced: false,
    completed: false,
    failed: true,
    error: error.startsWith("[aif-step:") ? error : `[aif-step:${step}] ${error}`,
    currentChunk: null,
    totalChunks: null,
    memorySafe: true,
    step,
  };
}

function logStep(
  step: string,
  item: ExpertIngestionQueueItem,
  extra: Record<string, unknown> = {}
) {
  console.log("[aif-pipeline-step]", {
    step,
    itemId: item.id,
    status: item.status,
    fileName: item.file_name,
    ...extra,
  });
}

function draftStoragePath(userId: string, ingestionId: string, chunkIndex: number): string {
  return `${userId}/aif-chunk-drafts/${ingestionId}/${createChunkId(ingestionId, chunkIndex)}.json`;
}

async function savePendingDraft(
  userId: string,
  ingestionId: string,
  chunkIndex: number,
  draft: AifExtractionDraft
): Promise<{ path: string | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { path: null, error: "Usuário não autenticado." };
  const path = draftStoragePath(userId, ingestionId, chunkIndex);
  const { error } = await ctx.supabase.storage
    .from(EXPERT_BRAIN_TRANSCRIPTS_BUCKET)
    .upload(path, JSON.stringify(draft), {
      upsert: true,
      contentType: "application/json",
    });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

async function loadPendingDraft(
  path: string | null | undefined,
  fallback: AifExtractionDraft | null
): Promise<AifExtractionDraft> {
  if (fallback) return fallback;
  if (!path) return emptyExtractionDraft();
  const { text, error } = await downloadExpertBrainTranscript(path);
  if (error || !text?.trim()) return emptyExtractionDraft();
  try {
    return JSON.parse(text) as AifExtractionDraft;
  } catch {
    return emptyExtractionDraft();
  }
}

function readPendingDraftPath(item: ExpertIngestionQueueItem): string | null {
  const meta =
    typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};
  return typeof meta.pendingDraftPath === "string" ? meta.pendingDraftPath : null;
}

async function loadChunkText(
  item: ExpertIngestionQueueItem,
  chunkIndex: number
): Promise<{ text: string | null; error: string | null }> {
  logStep("load_chunk", item, { chunkIndex });
  const progress = getProgress(item);
  const path = progress.chunkPaths[chunkIndex];
  if (!path) return { text: null, error: `Chunk path ausente para índice ${chunkIndex}.` };

  const { text, error } = await downloadExpertBrainTranscript(path);
  if (error || !text?.trim()) {
    return { text: null, error: error ?? "Chunk vazio." };
  }
  if (text.length > AIF_HARD_MAX_EXTRACT_CHARS) {
    return {
      text: text.slice(0, AIF_HARD_MAX_EXTRACT_CHARS),
      error: null,
    };
  }
  return { text, error: null };
}

async function uploadChunkTexts(
  userId: string,
  ingestionId: string,
  chunks: string[]
): Promise<{ paths: string[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { paths: [], error: "Usuário não autenticado." };

  const paths: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = createChunkId(ingestionId, i);
    const path = `${userId}/aif-chunks/${ingestionId}/${chunkId}.txt`;
    const { error } = await ctx.supabase.storage
      .from(EXPERT_BRAIN_TRANSCRIPTS_BUCKET)
      .upload(path, chunks[i], {
        upsert: true,
        contentType: "text/plain",
      });
    if (error) return { paths, error: error.message };
    paths.push(path);
  }
  return { paths, error: null };
}

async function resolveSourceText(
  item: ExpertIngestionQueueItem
): Promise<{ text: string | null; transcriptPath: string | null; error: string | null }> {
  logStep("download_or_load_text", item);
  const progress = getProgress(item);
  const meta =
    typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};

  const transcriptPath =
    progress.transcriptPath ??
    (typeof meta.transcript_path === "string" ? meta.transcript_path : null) ??
    (item.file_path.includes("transcript") || item.file_path.endsWith(".txt")
      ? item.file_path
      : null);

  if (transcriptPath) {
    const { text, error } = await downloadExpertBrainTranscript(transcriptPath);
    if (!error && text?.trim()) {
      return { text, transcriptPath, error: null };
    }
  }

  const lessonId =
    progress.lessonId ?? (typeof meta.lesson_id === "string" ? meta.lesson_id : null);
  if (lessonId) {
    const ctx = await getOptionalDataContext();
    if (!ctx) return { text: null, transcriptPath: null, error: "Usuário não autenticado." };
    const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
    const { data: lesson } = await lessonsRepo.findById(lessonId);
    if (lesson?.raw_text?.trim()) {
      return { text: lesson.raw_text, transcriptPath, error: null };
    }
  }

  const ctx = await getOptionalDataContext();
  if (!ctx) return { text: null, transcriptPath: null, error: "Usuário não autenticado." };
  const transcriptsRepo = new ExpertTranscriptsRepository(ctx.supabase, ctx.userId);
  const { data: transcript } = await transcriptsRepo.findByIngestionId(item.id);
  if (transcript?.transcript_path) {
    const { text, error } = await downloadExpertBrainTranscript(transcript.transcript_path);
    if (!error && text?.trim()) {
      return { text, transcriptPath: transcript.transcript_path, error: null };
    }
  }

  return { text: null, transcriptPath, error: "Sem texto para chunking (AIF v2)." };
}

async function stepChunking(item: ExpertIngestionQueueItem): Promise<AifPipelineStepResult> {
  const step = "chunking";
  logStep(step, item);
  try {
    const { text, transcriptPath, error } = await resolveSourceText(item);
    if (error || !text?.trim()) {
      await updateProgress(item.id, {
        status: "failed",
        error: error ?? "Sem texto.",
      });
      return failStep("failed", error ?? "Sem texto.", step);
    }

    const chunks = splitTextIntoChunks(text, AIF_MAX_CHUNK_CHARS);
    logAifChunkPlan({
      contentLength: text.length,
      chunkCount: chunks.length,
      fileId: item.id,
    });

    const ctx = await getOptionalDataContext();
    if (!ctx) {
      await updateProgress(item.id, { status: "failed", error: "Usuário não autenticado." });
      return failStep("failed", "Usuário não autenticado.", step);
    }

    const { paths, error: uploadError } = await uploadChunkTexts(ctx.userId, item.id, chunks);
    if (uploadError) {
      await updateProgress(item.id, { status: "failed", error: uploadError });
      return failStep("failed", uploadError, step);
    }

    const progress = getProgress(item);
    const resumeFrom =
      progress.processedChunks.length > 0
        ? Math.max(...progress.processedChunks) + 1
        : 0;
    const currentChunk = Math.min(resumeFrom, Math.max(0, chunks.length - 1));

    const update = await updateProgress(item.id, {
      status: "extracting_chunk",
      progress: aifChunkProgressPercent({
        totalChunks: chunks.length,
        processedChunks: progress.processedChunks,
        currentChunk,
      }),
      error: null,
      metadata: {
        ...buildAifV2MetadataPatch({
          aifVersion: AIF_VERSION_V2,
          totalChunks: chunks.length,
          currentChunk,
          processedChunks: progress.processedChunks,
          chunkPaths: paths,
          transcriptPath: transcriptPath ?? progress.transcriptPath,
          fileName: item.file_name,
          source: progress.source,
          driveFileId: progress.driveFileId,
          expertSourceId: progress.expertSourceId,
          pendingChunkDraft: null,
        }),
        pendingDraftPath: null,
      },
    });
    if (update.error) {
      throw aifStepError(step, update.error);
    }

    return {
      status: "extracting_chunk",
      advanced: true,
      completed: false,
      failed: false,
      error: null,
      currentChunk,
      totalChunks: chunks.length,
      memorySafe: true,
      step,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw aifStepError(step, message.replace(/^\[aif-step:[^\]]+\]\s*/, ""));
  }
}

async function stepExtractChunk(item: ExpertIngestionQueueItem): Promise<AifPipelineStepResult> {
  const step = "extracting_chunk";
  logStep(step, item);
  try {
    const progress = getProgress(item);
    if (!progress.totalChunks || !progress.chunkPaths.length) {
      await updateProgress(item.id, { status: "chunking", error: null });
      return {
        status: "chunking",
        advanced: true,
        completed: false,
        failed: false,
        error: null,
        currentChunk: progress.currentChunk,
        totalChunks: progress.totalChunks,
        memorySafe: true,
        step,
      };
    }

    const index = progress.currentChunk;
    if (progress.processedChunks.includes(index)) {
      const next = index + 1;
      if (next >= progress.totalChunks) {
        await updateProgress(item.id, {
          status: "committing_chunk",
          progress: 99,
          metadata: {
            ...buildAifV2MetadataPatch({ currentChunk: index, pendingChunkDraft: null }),
            pendingDraftPath: null,
          },
        });
        return {
          status: "committing_chunk",
          advanced: true,
          completed: false,
          failed: false,
          error: null,
          currentChunk: index,
          totalChunks: progress.totalChunks,
          memorySafe: true,
          step,
        };
      }
      await updateProgress(item.id, {
        status: "extracting_chunk",
        metadata: {
          ...buildAifV2MetadataPatch({ currentChunk: next, pendingChunkDraft: null }),
          pendingDraftPath: null,
        },
      });
      return {
        status: "extracting_chunk",
        advanced: true,
        completed: false,
        failed: false,
        error: null,
        currentChunk: next,
        totalChunks: progress.totalChunks,
        memorySafe: true,
        step,
      };
    }

    const { text, error } = await loadChunkText(item, index);
    if (error || !text) {
      await updateProgress(item.id, { status: "failed", error: error ?? "Falha ao ler chunk." });
      return failStep("failed", error ?? "Falha ao ler chunk.", step);
    }

    console.info("[aif-v2] extract chunk", {
      ingestionId: item.id,
      chunkIndex: index,
      totalChunks: progress.totalChunks,
      contentLength: text.length,
    });

    const title =
      item.lesson_name?.trim() ||
      progress.fileName ||
      item.file_name ||
      `Chunk ${index + 1}`;

    const draft = await runAifKnowledgeExtractor({
      rawText: text,
      title: `${title} [${index + 1}/${progress.totalChunks}]`,
      author: progress.author,
      niche: progress.niche,
    });

    const ctx = await getOptionalDataContext();
    if (!ctx) {
      return failStep("failed", "Usuário não autenticado.", step);
    }

    const saved = await savePendingDraft(ctx.userId, item.id, index, draft);
    if (saved.error || !saved.path) {
      throw aifStepError(step, saved.error ?? "Falha ao salvar draft do chunk.");
    }

    // Do NOT embed full draft in metadata (OOM / JSON size) — path only
    const update = await updateProgress(item.id, {
      status: "normalizing_chunk",
      progress: aifChunkProgressPercent(progress),
      metadata: {
        ...buildAifV2MetadataPatch({
          pendingChunkDraft: null,
          currentChunk: index,
        }),
        pendingDraftPath: saved.path,
      },
    });
    if (update.error) throw aifStepError(step, update.error);

    return {
      status: "normalizing_chunk",
      advanced: true,
      completed: false,
      failed: false,
      error: null,
      currentChunk: index,
      totalChunks: progress.totalChunks,
      memorySafe: true,
      step,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw aifStepError(step, message.replace(/^\[aif-step:[^\]]+\]\s*/, ""));
  }
}

async function stepNormalizeChunk(item: ExpertIngestionQueueItem): Promise<AifPipelineStepResult> {
  const step = "normalizing_chunk";
  logStep(step, item);
  try {
    const progress = getProgress(item);
    const draft = await loadPendingDraft(readPendingDraftPath(item), progress.pendingChunkDraft);
    const normalized = runAifKnowledgeNormalizer(draft, progress.niche);

    const ctx = await getOptionalDataContext();
    if (!ctx) return failStep("failed", "Usuário não autenticado.", step);

    const saved = await savePendingDraft(ctx.userId, item.id, progress.currentChunk, normalized);
    if (saved.error || !saved.path) {
      throw aifStepError(step, saved.error ?? "Falha ao salvar draft normalizado.");
    }

    const update = await updateProgress(item.id, {
      status: "validating_chunk",
      progress: aifChunkProgressPercent(progress),
      metadata: {
        ...buildAifV2MetadataPatch({
          pendingChunkDraft: null,
          currentChunk: progress.currentChunk,
        }),
        pendingDraftPath: saved.path,
      },
    });
    if (update.error) throw aifStepError(step, update.error);

    return {
      status: "validating_chunk",
      advanced: true,
      completed: false,
      failed: false,
      error: null,
      currentChunk: progress.currentChunk,
      totalChunks: progress.totalChunks,
      memorySafe: true,
      step,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw aifStepError(step, message.replace(/^\[aif-step:[^\]]+\]\s*/, ""));
  }
}

async function stepValidateChunk(item: ExpertIngestionQueueItem): Promise<AifPipelineStepResult> {
  const step = "validating_chunk";
  logStep(step, item);
  try {
    const progress = getProgress(item);
    const draft = await loadPendingDraft(readPendingDraftPath(item), progress.pendingChunkDraft);
    const withRules = ensureAifOperationalDecisionRules(draft);
    const { draft: validated, report } = runAifKnowledgeValidator(withRules);
    const boosted = boostConfidenceAfterValidation(validated, report);
    const pending: AifExtractionDraft = {
      frameworks: boosted.frameworks,
      checklists: boosted.checklists,
      decisionRules: boosted.decisionRules,
      kpis: boosted.kpis,
      cases: boosted.cases,
      principles: boosted.principles,
      mentalModels: boosted.mentalModels,
      antiPatterns: boosted.antiPatterns,
      concepts: boosted.concepts,
    };

    const ctx = await getOptionalDataContext();
    if (!ctx) return failStep("failed", "Usuário não autenticado.", step);

    const saved = await savePendingDraft(ctx.userId, item.id, progress.currentChunk, pending);
    if (saved.error || !saved.path) {
      throw aifStepError(step, saved.error ?? "Falha ao salvar draft validado.");
    }

    const update = await updateProgress(item.id, {
      status: "committing_chunk",
      progress: aifChunkProgressPercent(progress),
      metadata: {
        ...buildAifV2MetadataPatch({
          pendingChunkDraft: null,
          currentChunk: progress.currentChunk,
        }),
        pendingDraftPath: saved.path,
      },
    });
    if (update.error) throw aifStepError(step, update.error);

    return {
      status: "committing_chunk",
      advanced: true,
      completed: false,
      failed: false,
      error: null,
      currentChunk: progress.currentChunk,
      totalChunks: progress.totalChunks,
      memorySafe: true,
      step,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw aifStepError(step, message.replace(/^\[aif-step:[^\]]+\]\s*/, ""));
  }
}

async function stepCommitChunk(item: ExpertIngestionQueueItem): Promise<AifPipelineStepResult> {
  const step = "committing_chunk";
  logStep(step, item);
  try {
    const progress = getProgress(item);
    const index = progress.currentChunk;
    const draftPath = readPendingDraftPath(item);
    const draft = await loadPendingDraft(draftPath, progress.pendingChunkDraft);
    const hasDraft =
      Boolean(draftPath) ||
      Boolean(progress.pendingChunkDraft) ||
      countAifEntities({
        ...draft,
        graph: { nodes: [], edges: [] },
        validation: { passed: true, issues: [], deduplicatedCount: 0, averageConfidence: 0 },
      }) > 0;

    if (progress.processedChunks.includes(index) && !hasDraft) {
      const next = index + 1;
      if (next >= progress.totalChunks || allChunksCompleted(progress)) {
        return finishPipeline(item, progress.expertSourceId);
      }
      await updateProgress(item.id, {
        status: "extracting_chunk",
        metadata: {
          ...buildAifV2MetadataPatch({ currentChunk: next, pendingChunkDraft: null }),
          pendingDraftPath: null,
        },
        progress: aifChunkProgressPercent({
          ...progress,
          currentChunk: next,
        }),
      });
      return {
        status: "extracting_chunk",
        advanced: true,
        completed: false,
        failed: false,
        error: null,
        currentChunk: next,
        totalChunks: progress.totalChunks,
        memorySafe: true,
        step,
      };
    }

    if (!hasDraft) {
      await updateProgress(item.id, { status: "extracting_chunk", error: null });
      return {
        status: "extracting_chunk",
        advanced: true,
        completed: false,
        failed: false,
        error: null,
        currentChunk: index,
        totalChunks: progress.totalChunks,
        memorySafe: true,
        step,
      };
    }

    const { text } = await loadChunkText(item, index);
    const knowledge = finalizeChunkKnowledge(draft, progress.niche);
    const title =
      item.lesson_name?.trim() ||
      progress.fileName ||
      item.file_name ||
      `Aula`;

    const meta =
      typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, unknown>)
        : {};

    const input: AifPipelineInput = {
      title,
      author: progress.author,
      niche: progress.niche,
      origin: progress.source === "google_drive" ? "google_drive" : "aif-v2",
      sourceType: progress.source === "google_drive" ? "google_drive" : "txt",
      courseId: progress.courseId ?? (typeof meta.course_id === "string" ? meta.course_id : null),
      moduleId: progress.moduleId ?? (typeof meta.module_id === "string" ? meta.module_id : null),
      lessonId: progress.lessonId ?? (typeof meta.lesson_id === "string" ? meta.lesson_id : null),
      existingSourceId: progress.expertSourceId,
    };

    const mode = progress.expertSourceId ? "append" : "replace";
    const entityCount = countAifEntities(knowledge);

    let expertSourceId = progress.expertSourceId;
    if (entityCount > 0) {
      console.info("[aif-v2] commit chunk", {
        ingestionId: item.id,
        chunkIndex: index,
        entityCount,
        mode,
      });
      const commit = await commitStructuredKnowledgeToExpertBrain({
        input,
        rawText: text ?? "",
        knowledge,
        commitMode: mode,
      });
      if (commit.error || !commit.source) {
        await updateProgress(item.id, {
          status: "failed",
          error: commit.error ?? "Falha no commit do chunk.",
        });
        return failStep("failed", commit.error ?? "Falha no commit do chunk.", step);
      }
      expertSourceId = commit.source.id;
    }

    const processedChunks = progress.processedChunks.includes(index)
      ? progress.processedChunks
      : [...progress.processedChunks, index].sort((a, b) => a - b);

    const nextProgress = {
      ...progress,
      processedChunks,
      expertSourceId,
      pendingChunkDraft: null as AifExtractionDraft | null,
    };

    if (allChunksCompleted(nextProgress)) {
      return finishPipeline(item, expertSourceId, processedChunks);
    }

    const nextChunk = index + 1;
    const update = await updateProgress(item.id, {
      status: "extracting_chunk",
      progress: aifChunkProgressPercent({
        totalChunks: progress.totalChunks,
        processedChunks,
        currentChunk: nextChunk,
      }),
      error: null,
      metadata: {
        ...buildAifV2MetadataPatch({
          processedChunks,
          currentChunk: nextChunk,
          expertSourceId,
          pendingChunkDraft: null,
        }),
        pendingDraftPath: null,
      },
    });
    if (update.error) throw aifStepError(step, update.error);

    return {
      status: "extracting_chunk",
      advanced: true,
      completed: false,
      failed: false,
      error: null,
      currentChunk: nextChunk,
      totalChunks: progress.totalChunks,
      memorySafe: true,
      step,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw aifStepError(step, message.replace(/^\[aif-step:[^\]]+\]\s*/, ""));
  }
}

async function finishPipeline(
  item: ExpertIngestionQueueItem,
  expertSourceId: string | null,
  processedChunks?: number[]
): Promise<AifPipelineStepResult> {
  const step = "finalize_item";
  logStep(step, item, { expertSourceId });
  try {
    const progress = getProgress(item);
    const chunks = processedChunks ?? progress.processedChunks;

    const ctx = await getOptionalDataContext();
    const lessonId = progress.lessonId;
    if (ctx && lessonId && expertSourceId) {
      const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
      const { data: lesson } = await lessonsRepo.findById(lessonId);
      await lessonsRepo.update(lessonId, {
        status: "ready",
        source_id: expertSourceId,
        metadata: {
          ...(typeof lesson?.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
          aif_pipeline: true,
          aif_version: AIF_VERSION_V2,
          total_chunks: progress.totalChunks,
          processed_chunks: chunks.length,
          processed_at: new Date().toISOString(),
        } as Json,
      });
    }

    const update = await updateProgress(item.id, {
      status: "completed",
      progress: 100,
      error: null,
      metadata: {
        ...buildAifV2MetadataPatch({
          processedChunks: chunks,
          expertSourceId,
          pendingChunkDraft: null,
          currentChunk: Math.max(0, progress.totalChunks - 1),
        }),
        pendingDraftPath: null,
      },
    });
    if (update.error) throw aifStepError(step, update.error);

    if (ctx) {
      const { ExpertIngestionQueueRepository } = await import(
        "@/lib/supabase/repositories/expert-brain.repository"
      );
      const repo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
      await repo.update(item.id, { processed_at: new Date().toISOString() });
    }

    return {
      status: "completed",
      advanced: true,
      completed: true,
      failed: false,
      error: null,
      currentChunk: progress.currentChunk,
      totalChunks: progress.totalChunks,
      memorySafe: true,
      step,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw aifStepError(step, message.replace(/^\[aif-step:[^\]]+\]\s*/, ""));
  }
}

/**
 * Executes a single small AIF v2 step for an ingestion queue item.
 * Never processes an entire course / full transcript in one invocation beyond one chunk.
 */
export async function runAifPipelineStep(
  item: ExpertIngestionQueueItem
): Promise<AifPipelineStepResult> {
  const step = "load_item";
  logStep(step, item, {
    metadataKeys:
      typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
        ? Object.keys(item.metadata as Record<string, unknown>)
        : [],
  });

  const status = item.status;

  try {
    switch (status) {
      case "chunking":
      case "transcribed":
      case "downloaded":
        return await stepChunking(item);
      case "extracting_chunk":
        return await stepExtractChunk(item);
      case "normalizing_chunk":
        return await stepNormalizeChunk(item);
      case "validating_chunk":
        return await stepValidateChunk(item);
      case "committing_chunk":
        return await stepCommitChunk(item);
      default:
        return {
          status: status as ExpertIngestionStatus,
          advanced: false,
          completed: false,
          failed: false,
          error: `Status '${status}' não é um passo AIF v2.`,
          currentChunk: getProgress(item).currentChunk,
          totalChunks: getProgress(item).totalChunks,
          memorySafe: true,
          step: "load_item",
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const prefixed = message.startsWith("[aif-step:")
      ? message
      : `[aif-step:${status}] ${message}`;
    console.error("[aif-pipeline-step] failed", { status, itemId: item.id, error: prefixed });
    try {
      await updateProgress(item.id, { status: "failed", error: prefixed });
    } catch (markError) {
      console.error("[aif-pipeline-step] mark failed also errored", markError);
    }
    throw error instanceof Error ? error : aifStepError(status, message);
  }
}

/** @deprecated Prefer runAifPipelineStep for queue workers. Kept for direct/small text ingest. */
export { runAifPipelineStep as runAifPipelineIncremental };
