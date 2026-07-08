import type { Json, KnowledgeJob, KnowledgeSource } from "@/types/database";
import { extractTextFromFile, transcribeVideoBuffer } from "@/lib/expert-brain/parsers";
import { downloadDriveFile } from "@/lib/google-drive/client";
import { getValidGoogleAccessToken } from "@/lib/google/token.service";
import {
  KnowledgeJobsRepository,
  KnowledgeSourcesRepository,
} from "@/lib/supabase/repositories/knowledge-sources.repository";
import { runAifPipeline } from "@/lib/supabase/services/aif.service";
import { KNOWLEDGE_JOB_STAGE_PROGRESS } from "@/utils/knowledge-sources";
import { getOptionalDataContext } from "./context";

function readMetadata(source: KnowledgeSource): Record<string, unknown> {
  if (typeof source.metadata !== "object" || !source.metadata || Array.isArray(source.metadata)) {
    return {};
  }
  return source.metadata as Record<string, unknown>;
}

async function updateJobAndSource(
  job: KnowledgeJob,
  source: KnowledgeSource,
  stage: KnowledgeJob["stage"],
  sourceStatus: KnowledgeSource["status"] = "processing"
) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const jobsRepo = new KnowledgeJobsRepository(ctx.supabase, ctx.userId);
  const sourcesRepo = new KnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const progress = KNOWLEDGE_JOB_STAGE_PROGRESS[stage];

  await jobsRepo.updateStage(job.id, stage, {
    status: stage === "completed" ? "completed" : stage === "failed" ? "failed" : "running",
    started_at: job.started_at ?? new Date().toISOString(),
    ...(stage === "completed" || stage === "failed"
      ? { completed_at: new Date().toISOString() }
      : {}),
  });

  await sourcesRepo.updateProgress(source.id, progress, sourceStatus);
}

async function failJob(job: KnowledgeJob, source: KnowledgeSource, message: string) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const jobsRepo = new KnowledgeJobsRepository(ctx.supabase, ctx.userId);
  const sourcesRepo = new KnowledgeSourcesRepository(ctx.supabase, ctx.userId);

  await jobsRepo.updateStage(job.id, "failed", {
    status: "failed",
    error: message,
    completed_at: new Date().toISOString(),
  });
  await sourcesRepo.updateProgress(source.id, 0, "failed");
}

async function resolveRawText(
  source: KnowledgeSource,
  job: KnowledgeJob
): Promise<{ text: string | null; error: string | null }> {
  const meta = readMetadata(source);
  let videoBuffer: Buffer | null = null;

  try {
    if (source.provider === "upload") {
      if (source.source_type === "pdf" && typeof meta.pdfBase64 === "string") {
        await updateJobAndSource(job, source, "downloading");
        const buffer = Buffer.from(meta.pdfBase64, "base64");
        const { text } = await extractTextFromFile(
          (meta.fileName as string) ?? "upload.pdf",
          buffer
        );
        return { text, error: text ? null : "PDF sem texto extraível." };
      }

      if (typeof meta.uploadText === "string" && meta.uploadText.trim()) {
        return { text: meta.uploadText.trim(), error: null };
      }

      return { text: null, error: "Conteúdo do upload não encontrado." };
    }

    if (!source.drive_file_id) {
      return { text: null, error: "Arquivo do Drive não identificado." };
    }

    const { accessToken, error: tokenError } = await getValidGoogleAccessToken();
    if (!accessToken) {
      return { text: null, error: tokenError ?? "Google Drive não conectado." };
    }

    await updateJobAndSource(job, source, "downloading");
    videoBuffer = await downloadDriveFile(accessToken, source.drive_file_id);

    if (source.source_type === "drive_video") {
      await updateJobAndSource(job, source, "transcribing");
      const fileName =
        (meta.fileName as string) ?? source.lesson_name ?? "video.mp4";
      const text = await transcribeVideoBuffer(videoBuffer, fileName);
      videoBuffer = null;
      return { text: text?.trim() ?? null, error: text ? null : "Whisper não retornou texto." };
    }

    const fileName = (meta.fileName as string) ?? source.lesson_name ?? "file";
    const { text } = await extractTextFromFile(fileName, videoBuffer);
    videoBuffer = null;
    return { text, error: text ? null : "Não foi possível extrair texto do arquivo." };
  } catch (err) {
    videoBuffer = null;
    const message = err instanceof Error ? err.message : "Erro no processamento.";
    return { text: null, error: message };
  } finally {
    videoBuffer = null;
  }
}

async function processKnowledgeJob(
  job: KnowledgeJob,
  source: KnowledgeSource
): Promise<{ ok: boolean; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { ok: false, error: "Usuário não autenticado." };

  const sourcesRepo = new KnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const jobsRepo = new KnowledgeJobsRepository(ctx.supabase, ctx.userId);

  await jobsRepo.updateStage(job.id, job.stage, {
    status: "running",
    started_at: new Date().toISOString(),
  });
  await sourcesRepo.update(source.id, { status: "processing" });

  const { text, error: textError } = await resolveRawText(source, job);
  if (textError || !text?.trim()) {
    await failJob(job, source, textError ?? "Texto vazio.");
    return { ok: false, error: textError ?? "Texto vazio." };
  }

  await updateJobAndSource(job, source, "extracting");

  const title =
    source.lesson_name?.trim() ||
    source.course_name?.trim() ||
    "Conhecimento importado";

  const expertSourceType =
    source.source_type === "drive_video"
      ? "video"
      : source.source_type === "pdf"
        ? "pdf"
        : "transcript";

  await updateJobAndSource(job, source, "saving");

  const pipeline = await runAifPipeline({
    title,
    sourceType: expertSourceType,
    rawText: text,
    origin: source.provider === "google_drive" ? "google_drive" : "upload",
    courseId: null,
    moduleId: null,
    lessonId: null,
  });

  if (pipeline.error || !pipeline.expertSourceId) {
    await failJob(job, source, pipeline.error ?? "Extração falhou.");
    return { ok: false, error: pipeline.error ?? "Extração falhou." };
  }

  const knowledge = pipeline.knowledge;
  await sourcesRepo.update(source.id, {
    status: "ready",
    progress: 100,
    expert_source_id: pipeline.expertSourceId,
    metadata: {
      ...readMetadata(source),
      aif_pipeline: true,
      extracted: {
        frameworks: knowledge?.frameworks.length ?? 0,
        decisionRules: knowledge?.decisionRules.length ?? 0,
        successPatterns: knowledge?.cases.length ?? 0,
        failurePatterns: knowledge?.antiPatterns.length ?? 0,
      },
    } as Json,
  });

  await jobsRepo.updateStage(job.id, "completed", {
    status: "completed",
    completed_at: new Date().toISOString(),
    error: null,
  });

  return { ok: true, error: null };
}

export async function processKnowledgeJobsBatch(limit = 3): Promise<{
  processed: number;
  completed: number;
  failed: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { processed: 0, completed: 0, failed: 0, error: "Usuário não autenticado." };
  }

  const jobsRepo = new KnowledgeJobsRepository(ctx.supabase, ctx.userId);
  const sourcesRepo = new KnowledgeSourcesRepository(ctx.supabase, ctx.userId);

  const { data: pendingJobs, error } = await jobsRepo.findPending(limit);
  if (error) {
    return { processed: 0, completed: 0, failed: 0, error };
  }

  let processed = 0;
  let completed = 0;
  let failed = 0;

  for (const job of pendingJobs ?? []) {
    const { data: source } = await sourcesRepo.findById(job.source_id);
    if (!source) {
      await jobsRepo.updateStage(job.id, "failed", {
        status: "failed",
        error: "Fonte não encontrada.",
        completed_at: new Date().toISOString(),
      });
      failed += 1;
      processed += 1;
      continue;
    }

    const result = await processKnowledgeJob(job, source);
    processed += 1;
    if (result.ok) completed += 1;
    else failed += 1;
  }

  return { processed, completed, failed, error: null };
}
