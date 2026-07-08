import type { Json } from "@/types/database";
import { downloadDriveFile } from "@/lib/google-drive/client";
import {
  extractTextFromFile,
  parseZipCourse,
  type ParsedCourseStructure,
} from "@/lib/expert-brain/parsers";
import {
  ExpertCourseLessonsRepository,
  ExpertCourseModulesRepository,
  ExpertCoursesRepository,
  ExpertIngestionQueueRepository,
  ExpertProcessingQueueRepository,
  ExpertTranscriptsRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import { runAifPipeline } from "@/lib/supabase/services/aif.service";
import {
  downloadExpertBrainTranscript,
  hasOpenAiKey,
  transcribeDriveIngestionVideo,
  transcribeIngestionVideo,
} from "@/lib/supabase/services/expert-brain-transcription.service";
import { getValidGoogleDriveExpertAccessToken } from "@/lib/supabase/services/google-drive.service";
import {
  EXPERT_BRAIN_FILES_BUCKET,
  assertExpertBrainStoragePathOwned,
  buildExpertBrainStoragePath,
  detectExpertBrainSourceType,
  driveFileIdFromIngestionPath,
  formatExpertBrainStorageUploadError,
  guessExpertBrainContentType,
  isExpertBrainVideoFile,
  isExpertBrainZipFile,
  isGoogleDriveIngestionPath,
  titleFromExpertBrainFileName,
  validateExpertBrainFileSize,
} from "@/utils/expert-brain-storage";
import { logExpertBrain } from "@/utils/expert-brain-pipeline";
import {
  finalizeIngestionQueueRun,
  shouldResetFailedDriveItem,
  type IngestionQueueRunResult,
} from "@/utils/expert-brain-queue";
import { getOptionalDataContext } from "./context";

export type RegisterExpertBrainIngestionInput = {
  file_path: string;
  course_name?: string | null;
  module_name?: string | null;
  lesson_name?: string | null;
  file_name?: string | null;
  author?: string | null;
  niche?: string | null;
  reprocess?: boolean;
};

type IngestionMeta = {
  author?: string | null;
  niche?: string | null;
  reprocess?: boolean;
  lesson_id?: string | null;
  course_id?: string | null;
  module_id?: string | null;
  drive_file_id?: string | null;
  drive_mime_type?: string | null;
  source?: string | null;
  transcript_path?: string | null;
  transcript_only?: boolean;
};

function driveFileIdFromPath(filePath: string): string | null {
  return driveFileIdFromIngestionPath(filePath);
}

async function downloadExpertBrainFile(filePath: string): Promise<Buffer | null> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return null;

  const { data, error } = await ctx.supabase.storage
    .from(EXPERT_BRAIN_FILES_BUCKET)
    .download(filePath);

  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

function readIngestionMeta(item: import("@/types/database").ExpertIngestionQueueItem): IngestionMeta {
  if (typeof item.metadata !== "object" || !item.metadata || Array.isArray(item.metadata)) {
    return {};
  }
  const meta = item.metadata as Record<string, unknown>;
  return {
    author: typeof meta.author === "string" ? meta.author : null,
    niche: typeof meta.niche === "string" ? meta.niche : null,
    reprocess: meta.reprocess === true,
    lesson_id: typeof meta.lesson_id === "string" ? meta.lesson_id : null,
    course_id: typeof meta.course_id === "string" ? meta.course_id : null,
    module_id: typeof meta.module_id === "string" ? meta.module_id : null,
    drive_file_id: typeof meta.drive_file_id === "string" ? meta.drive_file_id : null,
    drive_mime_type: typeof meta.drive_mime_type === "string" ? meta.drive_mime_type : null,
    source: typeof meta.source === "string" ? meta.source : null,
    transcript_path: typeof meta.transcript_path === "string" ? meta.transcript_path : null,
    transcript_only: meta.transcript_only === true,
  };
}

async function createLessonsFromStructure(
  structure: ParsedCourseStructure,
  meta: {
    author?: string | null;
    niche?: string | null;
    storagePathPrefix?: string | null;
    ingestionId?: string;
    deferVideoTranscription?: boolean;
  }
): Promise<{ courseId: string | null; lessonIds: string[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { courseId: null, lessonIds: [], error: "Usuário não autenticado." };

  const coursesRepo = new ExpertCoursesRepository(ctx.supabase, ctx.userId);
  const modulesRepo = new ExpertCourseModulesRepository(ctx.supabase, ctx.userId);
  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const processingRepo = new ExpertProcessingQueueRepository(ctx.supabase, ctx.userId);

  const { data: course, error: courseError } = await coursesRepo.create({
    title: structure.courseTitle,
    author: meta.author ?? null,
    niche: meta.niche ?? null,
    status: "pending",
    metadata: { upload_source: "storage", ingestion_id: meta.ingestionId ?? null } as Json,
  });

  if (courseError || !course) {
    return { courseId: null, lessonIds: [], error: courseError ?? "Erro ao criar curso." };
  }

  const lessonIds: string[] = [];

  for (let modIndex = 0; modIndex < structure.modules.length; modIndex++) {
    const mod = structure.modules[modIndex];
    const { data: moduleRow, error: moduleError } = await modulesRepo.create({
      course_id: course.id,
      title: mod.title,
      sort_order: modIndex,
      status: "pending",
      metadata: {} as Json,
    });

    if (moduleError || !moduleRow) {
      return { courseId: course.id, lessonIds, error: moduleError ?? "Erro ao criar módulo." };
    }

    for (let lessonIndex = 0; lessonIndex < mod.lessons.length; lessonIndex++) {
      const lessonFile = mod.lessons[lessonIndex];
      const rawText = lessonFile.text?.trim() || null;
      const needsTranscript =
        meta.deferVideoTranscription &&
        lessonFile.sourceType === "video" &&
        !rawText;

      const storagePath = meta.storagePathPrefix
        ? `${meta.storagePathPrefix}/${lessonFile.path}`
        : lessonFile.path;

      const { data: lessonRow, error: lessonError } = await lessonsRepo.create({
        module_id: moduleRow.id,
        title: lessonFile.title,
        source_type: lessonFile.sourceType,
        sort_order: lessonIndex,
        status: needsTranscript ? "pending" : rawText ? "pending" : "failed",
        raw_text: rawText,
        file_name: lessonFile.fileName,
        file_path: storagePath,
        metadata: {
          has_text: Boolean(rawText),
          needs_transcript: needsTranscript,
          ingestion_id: meta.ingestionId ?? null,
        } as Json,
      });

      if (lessonError || !lessonRow) continue;

      lessonIds.push(lessonRow.id);

      if (rawText && !needsTranscript) {
        await processingRepo.create({
          entity_type: "lesson",
          entity_id: lessonRow.id,
          action: "process",
          priority: 0,
          status: "pending",
          metadata: { course_id: course.id, module_id: moduleRow.id } as Json,
        });
      }
    }
  }

  return { courseId: course.id, lessonIds, error: null };
}

async function ensureSingleLesson(params: {
  ingestionId: string;
  filePath: string;
  fileName: string;
  courseName: string;
  moduleName: string;
  lessonName: string;
  author?: string | null;
  niche?: string | null;
  rawText?: string | null;
  needsTranscript?: boolean;
}): Promise<{
  lessonId: string | null;
  courseId: string | null;
  moduleId: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { lessonId: null, courseId: null, moduleId: null, error: "Usuário não autenticado." };
  }

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const item = await ingestionRepo.findById(params.ingestionId);
  const meta = item.data ? readIngestionMeta(item.data) : {};

  if (meta.lesson_id) {
    const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
    const { data: lesson } = await lessonsRepo.findById(meta.lesson_id);
    if (lesson) {
      if (params.rawText?.trim()) {
        await lessonsRepo.update(lesson.id, {
          raw_text: params.rawText.trim(),
          status: "pending",
          metadata: {
            ...(typeof lesson.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
            needs_transcript: false,
          } as Json,
        });
      }
      return {
        lessonId: lesson.id,
        courseId: meta.course_id ?? null,
        moduleId: lesson.module_id,
        error: null,
      };
    }
  }

  const sourceType = detectExpertBrainSourceType(params.fileName);
  const structure: ParsedCourseStructure = {
    courseTitle: params.courseName,
    modules: [
      {
        title: params.moduleName,
        lessons: [
          {
            path: params.filePath,
            fileName: params.fileName,
            title: params.lessonName,
            sourceType,
            text: params.rawText ?? null,
            buffer: null,
            mimeType: null,
          },
        ],
      },
    ],
  };

  const result = await createLessonsFromStructure(structure, {
    author: params.author,
    niche: params.niche,
    ingestionId: params.ingestionId,
    deferVideoTranscription: params.needsTranscript,
  });

  if (result.error || !result.lessonIds.length) {
    return { lessonId: null, courseId: result.courseId, moduleId: null, error: result.error };
  }

  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const lessonId = result.lessonIds[0];
  const { data: lesson } = await lessonsRepo.findById(lessonId);
  const moduleId = lesson?.module_id ?? null;

  await ingestionRepo.update(params.ingestionId, {
    metadata: {
      author: params.author ?? null,
      niche: params.niche ?? null,
      lesson_id: lessonId,
      course_id: result.courseId,
      module_id: moduleId,
    } as Json,
  });

  return { lessonId, courseId: result.courseId, moduleId, error: null };
}

async function runExtractionForLesson(params: {
  lessonId: string;
  courseId: string | null;
  moduleId: string | null;
  rawText: string;
  title: string;
  sourceType: import("@/types/database").ExpertKnowledgeSourceType;
  author?: string | null;
  niche?: string | null;
  origin?: string | null;
  transcriptId?: string | null;
}): Promise<{ sourceId: string | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { sourceId: null, error: "Usuário não autenticado." };

  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const transcriptsRepo = new ExpertTranscriptsRepository(ctx.supabase, ctx.userId);

  logExpertBrain("extract", {
    lessonId: params.lessonId,
    title: params.title,
    words: params.rawText.split(/\s+/).length,
  });

  console.info("[drive-import] extract", {
    lessonId: params.lessonId,
    title: params.title,
    sourceType: params.sourceType,
    words: params.rawText.split(/\s+/).length,
  });

  await lessonsRepo.update(params.lessonId, { status: "processing" });

  const { data: lesson } = await lessonsRepo.findById(params.lessonId);
  const existingSourceId = lesson?.source_id ?? null;

  console.info("[expert-brain-queue] before runAifPipeline", {
    lessonId: params.lessonId,
    title: params.title,
    sourceType: params.sourceType,
    existingSourceId,
    rawTextLength: params.rawText.length,
  });

  const pipeline = await runAifPipeline({
    title: params.title,
    sourceType: params.sourceType,
    rawText: params.rawText,
    author: params.author ?? null,
    niche: params.niche ?? null,
    origin: params.origin ?? null,
    courseId: params.courseId,
    moduleId: params.moduleId,
    lessonId: params.lessonId,
    existingSourceId: existingSourceId,
  });

  console.info("[expert-brain-queue] after runAifPipeline", {
    lessonId: params.lessonId,
    stage: pipeline.stage,
    expertSourceId: pipeline.expertSourceId,
    error: pipeline.error,
  });

  if (pipeline.error || !pipeline.expertSourceId) {
    console.error("[drive-import] extract", {
      lessonId: params.lessonId,
      error: pipeline.error ?? "Falha na extração.",
    });
    await lessonsRepo.update(params.lessonId, {
      status: "failed",
      metadata: {
        ...(typeof lesson?.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
        error: pipeline.error ?? "Falha na extração.",
      } as Json,
    });
    return { sourceId: null, error: pipeline.error ?? "Falha na extração." };
  }

  const knowledge = pipeline.knowledge;
  await lessonsRepo.update(params.lessonId, {
    status: "ready",
    source_id: pipeline.expertSourceId,
    raw_text: params.rawText,
    metadata: {
      ...(typeof lesson?.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
      aif_pipeline: true,
      frameworks_count: knowledge?.frameworks.length ?? 0,
      decision_rules_count: knowledge?.decisionRules.length ?? 0,
      success_patterns_count: knowledge?.cases.length ?? 0,
      failure_patterns_count: knowledge?.antiPatterns.length ?? 0,
      checklists_count: knowledge?.checklists.length ?? 0,
      processed_at: new Date().toISOString(),
    } as Json,
  });

  if (params.transcriptId) {
    await transcriptsRepo.update(params.transcriptId, { source_id: pipeline.expertSourceId });
  }

  return { sourceId: pipeline.expertSourceId, error: null };
}

export async function registerExpertBrainIngestion(
  input: RegisterExpertBrainIngestionInput
): Promise<{ ingestionId: string | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { ingestionId: null, error: "Usuário não autenticado." };

  const filePath = input.file_path?.trim();
  if (!filePath) return { ingestionId: null, error: "Informe file_path." };
  if (!assertExpertBrainStoragePathOwned(ctx.userId, filePath)) {
    return { ingestionId: null, error: "file_path inválido." };
  }

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const { data, error } = await ingestionRepo.create({
    file_path: filePath,
    course_name: input.course_name?.trim() || null,
    module_name: input.module_name?.trim() || null,
    lesson_name: input.lesson_name?.trim() || null,
    file_name: input.file_name?.trim() || null,
    status: "uploaded",
    progress: 0,
    metadata: {
      author: input.author ?? null,
      niche: input.niche ?? null,
      reprocess: input.reprocess ?? false,
    } as Json,
  });

  if (error || !data) {
    return { ingestionId: null, error: error ?? "Erro ao enfileirar ingestão." };
  }

  logExpertBrain("upload", {
    ingestionId: data.id,
    filePath,
    fileName: input.file_name ?? null,
  });

  return { ingestionId: data.id, error: null };
}

export async function requeueExpertBrainIngestionFromLesson(
  lessonId: string
): Promise<{ ingestionId: string | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { ingestionId: null, error: "Usuário não autenticado." };

  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const modulesRepo = new ExpertCourseModulesRepository(ctx.supabase, ctx.userId);
  const coursesRepo = new ExpertCoursesRepository(ctx.supabase, ctx.userId);

  const { data: lesson, error: lessonError } = await lessonsRepo.findById(lessonId);
  if (lessonError || !lesson) return { ingestionId: null, error: lessonError ?? "Aula não encontrada." };
  if (!lesson.file_path?.trim()) {
    return { ingestionId: null, error: "Aula sem arquivo no Storage para reprocessar." };
  }
  if (!assertExpertBrainStoragePathOwned(ctx.userId, lesson.file_path)) {
    return { ingestionId: null, error: "Caminho de arquivo inválido." };
  }

  const { data: module } = await modulesRepo.findById(lesson.module_id);
  const { data: course } = module ? await coursesRepo.findById(module.course_id) : { data: null };

  const result = await registerExpertBrainIngestion({
    file_path: lesson.file_path,
    course_name: course?.title ?? null,
    module_name: module?.title ?? null,
    lesson_name: lesson.title,
    file_name: lesson.file_name,
    author: course?.author ?? null,
    niche: course?.niche ?? null,
    reprocess: true,
  });

  if (result.ingestionId) {
    const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
    await ingestionRepo.update(result.ingestionId, {
      metadata: {
        author: course?.author ?? null,
        niche: course?.niche ?? null,
        reprocess: true,
        lesson_id: lessonId,
        course_id: course?.id ?? null,
        module_id: module?.id ?? null,
      } as Json,
    });
  }

  return result;
}

async function uploadExpertBrainBuffer(
  userId: string,
  fileName: string,
  buffer: Buffer
): Promise<{ path: string | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { path: null, error: "Usuário não autenticado." };

  const storagePath = buildExpertBrainStoragePath(userId, fileName);
  const { error } = await ctx.supabase.storage.from(EXPERT_BRAIN_FILES_BUCKET).upload(storagePath, buffer, {
    contentType: guessExpertBrainContentType(fileName),
  });

  if (error) {
    return {
      path: null,
      error: formatExpertBrainStorageUploadError(error.message, buffer.length),
    };
  }

  return { path: storagePath, error: null };
}

function ingestionUpdateError(
  label: string,
  result: { error: string | null }
): string | null {
  return result.error ? `${label}: ${result.error}` : null;
}

async function failIngestionItem(
  ingestionRepo: ExpertIngestionQueueRepository,
  id: string,
  message: string
): Promise<{ error: string }> {
  await ingestionRepo.markFailed(id, message);
  return { error: message };
}

async function completeDriveVideoIngestion(
  item: import("@/types/database").ExpertIngestionQueueItem,
  ingestionRepo: ExpertIngestionQueueRepository,
  params: {
    fileName: string;
    meta: IngestionMeta;
    driveFileId: string | null;
    rawText: string;
    transcriptPath: string;
    transcriptId: string | null;
  }
): Promise<{ error: string | null }> {
  console.log("[queue] completeDriveVideoIngestion", item.id, item.status, params.fileName);

  const { fileName, meta, driveFileId, rawText, transcriptPath, transcriptId } = params;
  const courseName =
    item.course_name?.trim() || titleFromExpertBrainFileName(fileName) || "Curso importado";
  const moduleName = item.module_name?.trim() || "Módulo 1";
  const lessonName =
    item.lesson_name?.trim() || titleFromExpertBrainFileName(fileName) || "Aula 1";

  const mergedMetadata =
    typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
      ? {
          ...(item.metadata as Record<string, unknown>),
          transcript_path: transcriptPath,
          transcript_only: true,
          drive_file_id: driveFileId,
          drive_downloaded: true,
          source: meta.source ?? "google_drive",
        }
      : {
          transcript_path: transcriptPath,
          transcript_only: true,
          drive_file_id: driveFileId,
          drive_downloaded: true,
          source: "google_drive",
        };

  const pathUpdateError = ingestionUpdateError(
    "Falha ao salvar transcrição na fila",
    await ingestionRepo.update(item.id, {
      file_path: transcriptPath,
      metadata: mergedMetadata as Json,
    })
  );
  if (pathUpdateError) return failIngestionItem(ingestionRepo, item.id, pathUpdateError);

  const lessonResult = await ensureSingleLesson({
    ingestionId: item.id,
    filePath: transcriptPath,
    fileName,
    courseName,
    moduleName,
    lessonName,
    author: meta.author,
    niche: meta.niche,
    rawText,
    needsTranscript: false,
  });

  if (lessonResult.error || !lessonResult.lessonId) {
    return failIngestionItem(
      ingestionRepo,
      item.id,
      lessonResult.error ?? "Erro ao criar aula a partir da transcrição."
    );
  }

  if (transcriptId) {
    const transcriptsRepo = (await getTranscriptsRepo())!;
    await transcriptsRepo.update(transcriptId, {
      lesson_id: lessonResult.lessonId,
    });
  }

  const extraction = await runExtractionForLesson({
    lessonId: lessonResult.lessonId,
    courseId: lessonResult.courseId,
    moduleId: lessonResult.moduleId,
    rawText,
    title: lessonName,
    sourceType: detectExpertBrainSourceType(fileName),
    author: meta.author,
    niche: meta.niche,
    origin: "google_drive",
    transcriptId,
  });

  if (extraction.error) {
    return failIngestionItem(ingestionRepo, item.id, extraction.error);
  }

  const completedError = ingestionUpdateError(
    "Falha ao marcar completed",
    await ingestionRepo.markCompleted(item.id)
  );
  if (completedError) return failIngestionItem(ingestionRepo, item.id, completedError);

  logExpertBrain("complete", {
    ingestionId: item.id,
    lessonId: lessonResult.lessonId,
    sourceId: extraction.sourceId,
    mode: "drive-video",
  });
  console.info("[drive-import] complete", {
    ingestionId: item.id,
    lessonId: lessonResult.lessonId,
    sourceId: extraction.sourceId,
    transcriptPath,
  });

  return { error: null };
}

async function processPendingDriveVideo(
  item: import("@/types/database").ExpertIngestionQueueItem,
  ingestionRepo: ExpertIngestionQueueRepository,
  params: {
    buffer: Buffer;
    driveFileId: string;
    fileName: string;
    meta: IngestionMeta;
  }
): Promise<{ error: string | null }> {
  const { buffer, driveFileId, fileName, meta } = params;

  console.log("[queue] processPendingDriveVideo", item.id, item.status, driveFileId, fileName);

  console.info("[drive-import] whisper", {
    ingestionId: item.id,
    fileName,
    driveFileId,
    bytes: buffer.length,
  });

  const transcription = await transcribeDriveIngestionVideo({
    ingestionId: item.id,
    fileName,
    driveFileId,
    buffer,
    lessonId: meta.lesson_id,
  });

  if (transcription.waitingForOpenai) {
    const waitMeta =
      typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
        ? {
            ...(item.metadata as Record<string, unknown>),
            source: meta.source ?? "google_drive",
            drive_file_id: driveFileId,
            transcript_only: true,
            drive_downloaded: true,
          }
        : {
            source: "google_drive",
            drive_file_id: driveFileId,
            transcript_only: true,
            drive_downloaded: true,
          };

    const waitMetaError = ingestionUpdateError(
      "Falha ao salvar metadados Drive",
      await ingestionRepo.update(item.id, { metadata: waitMeta as Json })
    );
    if (waitMetaError) return failIngestionItem(ingestionRepo, item.id, waitMetaError);

    const waitError = ingestionUpdateError(
      "Falha ao marcar waiting_for_openai",
      await ingestionRepo.markWaitingForOpenai(item.id)
    );
    if (waitError) return failIngestionItem(ingestionRepo, item.id, waitError);
    return { error: null };
  }

  if (transcription.error || !transcription.rawText?.trim() || !transcription.transcriptPath) {
    return failIngestionItem(
      ingestionRepo,
      item.id,
      transcription.error ?? "Transcrição do vídeo falhou."
    );
  }

  console.info("[drive-import] whisper", {
    ingestionId: item.id,
    transcriptId: transcription.transcriptId,
    transcriptPath: transcription.transcriptPath,
    words: transcription.rawText.split(/\s+/).length,
    ok: true,
  });

  console.log("[queue] before completeDriveVideoIngestion", item.id);
  const completeResult = await completeDriveVideoIngestion(item, ingestionRepo, {
    fileName,
    meta,
    driveFileId,
    rawText: transcription.rawText,
    transcriptPath: transcription.transcriptPath,
    transcriptId: transcription.transcriptId,
  });
  console.log("[queue] after completeDriveVideoIngestion", item.id, { error: completeResult.error });
  return completeResult;
}

async function processPendingDriveStage(
  item: import("@/types/database").ExpertIngestionQueueItem,
  ingestionRepo: ExpertIngestionQueueRepository
): Promise<{ error: string | null }> {
  console.log("[queue] processPendingDriveStage", item.id, item.status);

  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const meta = readIngestionMeta(item);
  const fileName = item.file_name ?? item.file_path.split("/").pop() ?? "arquivo";
  const driveFileId = meta.drive_file_id ?? driveFileIdFromPath(item.file_path);

  if (!driveFileId) {
    return failIngestionItem(
      ingestionRepo,
      item.id,
      "ID do arquivo no Google Drive ausente."
    );
  }

  const progressStartError = ingestionUpdateError(
    "Falha ao atualizar progresso",
    await ingestionRepo.updateProgress(item.id, 10)
  );
  if (progressStartError) {
    return failIngestionItem(ingestionRepo, item.id, progressStartError);
  }

  const { accessToken, error: tokenError } = await getValidGoogleDriveExpertAccessToken();
  if (!accessToken) {
    return failIngestionItem(
      ingestionRepo,
      item.id,
      tokenError ?? "Google Drive não conectado."
    );
  }

  logExpertBrain("upload", {
    ingestionId: item.id,
    stage: "drive_download",
    driveFileId,
    fileName,
  });

  console.info("[drive-import] download", { ingestionId: item.id, driveFileId, fileName });

  let buffer: Buffer;
  try {
    buffer = await downloadDriveFile(accessToken, driveFileId);
    console.info("[drive-import] download", {
      ingestionId: item.id,
      driveFileId,
      bytes: buffer.length,
      ok: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download do Google Drive falhou.";
    console.error("[drive-import] download", {
      ingestionId: item.id,
      driveFileId,
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    const downloadError = await failIngestionItem(ingestionRepo, item.id, message);
    return downloadError;
  }

  const sizeError = validateExpertBrainFileSize(buffer.length);
  if (sizeError) {
    return failIngestionItem(ingestionRepo, item.id, sizeError);
  }

  const progressMidError = ingestionUpdateError(
    "Falha ao atualizar progresso",
    await ingestionRepo.updateProgress(item.id, 20)
  );
  if (progressMidError) {
    return failIngestionItem(ingestionRepo, item.id, progressMidError);
  }

  if (isExpertBrainVideoFile(fileName)) {
    console.log("[queue] before processPendingDriveVideo", item.id);
    const driveVideoResult = await processPendingDriveVideo(item, ingestionRepo, {
      buffer,
      driveFileId,
      fileName,
      meta,
    });
    console.log("[queue] after processPendingDriveVideo", item.id, { error: driveVideoResult.error });
    return driveVideoResult;
  }

  console.info("[drive-import] upload", { ingestionId: item.id, fileName, bytes: buffer.length });

  const { path: storagePath, error: uploadError } = await uploadExpertBrainBuffer(
    ctx.userId,
    fileName,
    buffer
  );

  if (uploadError || !storagePath) {
    console.error("[drive-import] upload", {
      ingestionId: item.id,
      fileName,
      error: uploadError ?? "Upload para o Storage falhou.",
    });
    return failIngestionItem(
      ingestionRepo,
      item.id,
      uploadError ?? "Upload para o Storage falhou."
    );
  }

  console.info("[drive-import] upload", { ingestionId: item.id, storagePath, ok: true });

  const mergedMetadata =
    typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
      ? { ...(item.metadata as Record<string, unknown>), storage_path: storagePath, drive_downloaded: true }
      : { storage_path: storagePath, drive_downloaded: true };

  const pathUpdateError = ingestionUpdateError(
    "Falha ao salvar caminho no Storage",
    await ingestionRepo.update(item.id, {
      file_path: storagePath,
      metadata: mergedMetadata as Json,
    })
  );
  if (pathUpdateError) {
    return failIngestionItem(ingestionRepo, item.id, pathUpdateError);
  }

  logExpertBrain("upload", {
    ingestionId: item.id,
    stage: "drive_storage",
    storagePath,
    fileName,
  });

  const uploadedError = ingestionUpdateError(
    "Falha ao marcar uploaded",
    await ingestionRepo.markUploaded(item.id)
  );
  if (uploadedError) return failIngestionItem(ingestionRepo, item.id, uploadedError);
  return { error: null };
}

async function processUploadedStage(
  item: import("@/types/database").ExpertIngestionQueueItem
): Promise<{ error: string | null }> {
  const ingestionRepo = (await getIngestionRepo())!;
  const fileName = item.file_name ?? item.file_path.split("/").pop() ?? "arquivo";
  const meta = readIngestionMeta(item);

  if (isExpertBrainZipFile(fileName)) {
    const buffer = await downloadExpertBrainFile(item.file_path);
    if (!buffer) {
      await ingestionRepo.markFailed(item.id, "Não foi possível baixar o ZIP do Storage.");
      return { error: "Download falhou." };
    }

    try {
      const structure = await parseZipCourse(buffer, item.course_name ?? undefined);
      const result = await createLessonsFromStructure(structure, {
        author: meta.author,
        niche: meta.niche,
        storagePathPrefix: item.file_path.replace(/\/[^/]+$/, ""),
        ingestionId: item.id,
        deferVideoTranscription: true,
      });

      if (result.error) {
        await ingestionRepo.markFailed(item.id, result.error);
        return { error: result.error };
      }

      const hasVideos = structure.modules.some((mod) =>
        mod.lessons.some((lesson) => lesson.sourceType === "video" && !lesson.text?.trim())
      );

      if (hasVideos && !hasOpenAiKey()) {
        await ingestionRepo.markWaitingForOpenai(item.id);
        return { error: null };
      }

      if (hasVideos) {
        await ingestionRepo.markTranscribing(item.id);
        return { error: null };
      }

      await ingestionRepo.markExtracting(item.id);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao processar ZIP.";
      await ingestionRepo.markFailed(item.id, message);
      return { error: message };
    }
  }

  if (isExpertBrainVideoFile(fileName)) {
    await ingestionRepo.markTranscribing(item.id);
    return { error: null };
  }

  const buffer = await downloadExpertBrainFile(item.file_path);
  if (!buffer) {
    await ingestionRepo.markFailed(item.id, "Não foi possível baixar o arquivo do Storage.");
    return { error: "Download falhou." };
  }

  const { text, sourceType } = await extractTextFromFile(fileName, buffer);
  const courseName =
    item.course_name?.trim() || titleFromExpertBrainFileName(fileName) || "Curso importado";
  const moduleName = item.module_name?.trim() || "Módulo 1";
  const lessonName = item.lesson_name?.trim() || titleFromExpertBrainFileName(fileName) || "Aula 1";

  const lessonResult = await ensureSingleLesson({
    ingestionId: item.id,
    filePath: item.file_path,
    fileName,
    courseName,
    moduleName,
    lessonName,
    author: meta.author,
    niche: meta.niche,
    rawText: text,
  });

  if (lessonResult.error || !lessonResult.lessonId) {
    await ingestionRepo.markFailed(item.id, lessonResult.error ?? "Erro ao criar aula.");
    return { error: lessonResult.error };
  }

  if (!text?.trim()) {
    await ingestionRepo.markFailed(item.id, "Arquivo sem texto extraível.");
    return { error: "Sem texto." };
  }

  await ingestionRepo.markExtracting(item.id);
  return { error: null };
}

async function processTranscribingStage(
  item: import("@/types/database").ExpertIngestionQueueItem
): Promise<{ error: string | null }> {
  const ingestionRepo = (await getIngestionRepo())!;
  const fileName = item.file_name ?? item.file_path.split("/").pop() ?? "arquivo";
  const meta = readIngestionMeta(item);

  if (!isExpertBrainVideoFile(fileName) && !isExpertBrainZipFile(fileName)) {
    await ingestionRepo.markExtracting(item.id);
    return { error: null };
  }

  if (!hasOpenAiKey()) {
    await ingestionRepo.markWaitingForOpenai(item.id);
    return { error: null };
  }

  const courseName =
    item.course_name?.trim() || titleFromExpertBrainFileName(fileName) || "Curso importado";
  const moduleName = item.module_name?.trim() || "Módulo 1";
  const lessonName = item.lesson_name?.trim() || titleFromExpertBrainFileName(fileName) || "Aula 1";

  console.info("[drive-import] whisper", {
    ingestionId: item.id,
    fileName,
    filePath: item.file_path,
    lessonId: meta.lesson_id ?? null,
  });

  const transcription = await transcribeIngestionVideo({
    ingestionId: item.id,
    filePath: item.file_path,
    fileName,
    lessonId: meta.lesson_id,
  });

  if (transcription.waitingForOpenai) {
    await ingestionRepo.markWaitingForOpenai(item.id);
    return { error: null };
  }

  if (transcription.error || !transcription.rawText?.trim()) {
    console.error("[drive-import] whisper", {
      ingestionId: item.id,
      error: transcription.error ?? "Transcrição falhou.",
      waitingForOpenai: transcription.waitingForOpenai,
    });
    await ingestionRepo.markFailed(item.id, transcription.error ?? "Transcrição falhou.");
    return { error: transcription.error };
  }

  console.info("[drive-import] whisper", {
    ingestionId: item.id,
    transcriptId: transcription.transcriptId,
    words: transcription.rawText.split(/\s+/).length,
    ok: true,
  });

  const isDriveVideo =
    isExpertBrainVideoFile(fileName) &&
    (isGoogleDriveIngestionPath(item.file_path) || meta.transcript_only || Boolean(meta.drive_file_id));

  if (isDriveVideo) {
    const transcriptsRepo = (await getTranscriptsRepo())!;
    const transcriptPath =
      meta.transcript_path ??
      (transcription.transcriptId
        ? (await transcriptsRepo.findById(transcription.transcriptId)).data?.transcript_path
        : null) ??
      (await transcriptsRepo.findByIngestionId(item.id)).data?.transcript_path ??
      null;

    if (!transcriptPath) {
      await ingestionRepo.markFailed(item.id, "Transcrição sem caminho no Storage.");
      return { error: "Transcrição sem caminho no Storage." };
    }

    return completeDriveVideoIngestion(item, ingestionRepo, {
      fileName,
      meta,
      driveFileId: meta.drive_file_id ?? driveFileIdFromPath(item.file_path),
      rawText: transcription.rawText,
      transcriptPath,
      transcriptId: transcription.transcriptId,
    });
  }

  const lessonFilePath = item.file_path;

  const lessonResult = await ensureSingleLesson({
    ingestionId: item.id,
    filePath: lessonFilePath,
    fileName,
    courseName,
    moduleName,
    lessonName,
    author: meta.author,
    niche: meta.niche,
    rawText: transcription.rawText,
    needsTranscript: false,
  });

  if (lessonResult.error || !lessonResult.lessonId) {
    await ingestionRepo.markFailed(item.id, lessonResult.error ?? "Erro ao vincular aula.");
    return { error: lessonResult.error };
  }

  if (transcription.transcriptId) {
    const transcriptsRepo = (await getTranscriptsRepo())!;
    await transcriptsRepo.update(transcription.transcriptId, {
      lesson_id: lessonResult.lessonId,
    });
  }

  await ingestionRepo.markExtracting(item.id);
  return { error: null };
}

async function processExtractingStage(
  item: import("@/types/database").ExpertIngestionQueueItem
): Promise<{ error: string | null }> {
  const ingestionRepo = (await getIngestionRepo())!;
  const meta = readIngestionMeta(item);
  const fileName = item.file_name ?? item.file_path.split("/").pop() ?? "arquivo";

  let lessonId = meta.lesson_id;
  let courseId = meta.course_id ?? null;
  let moduleId = meta.module_id ?? null;
  let rawText: string | null = null;
  let title = item.lesson_name?.trim() || titleFromExpertBrainFileName(fileName);
  let sourceType = detectExpertBrainSourceType(fileName);

  if (!lessonId) {
    if (meta.transcript_only || isGoogleDriveIngestionPath(item.file_path)) {
      const transcriptsRepo = (await getTranscriptsRepo())!;
      const { data: transcript } = await transcriptsRepo.findByIngestionId(item.id);
      if (transcript?.transcript_path) {
        const { text, error: transcriptError } = await downloadExpertBrainTranscript(
          transcript.transcript_path
        );
        if (transcriptError || !text?.trim()) {
          await ingestionRepo.markFailed(item.id, transcriptError ?? "Transcrição indisponível.");
          return { error: transcriptError ?? "Transcrição indisponível." };
        }
        rawText = text;
      }
    }

    if (!rawText?.trim()) {
      const buffer = await downloadExpertBrainFile(item.file_path);
      if (!buffer) {
        await ingestionRepo.markFailed(item.id, "Download falhou na extração.");
        return { error: "Download falhou." };
      }

      if (isExpertBrainZipFile(fileName)) {
        await ingestionRepo.markCompleted(item.id);
        logExpertBrain("complete", { ingestionId: item.id, mode: "zip-deferred" });
        return { error: null };
      }

      const { text } = await extractTextFromFile(fileName, buffer);
      rawText = text;
    }
  } else {
    const ctx = await getOptionalDataContext();
    if (!ctx) {
      await ingestionRepo.markFailed(item.id, "Usuário não autenticado.");
      return { error: "Usuário não autenticado." };
    }
    const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
    const { data: lesson } = await lessonsRepo.findById(lessonId);
    rawText = lesson?.raw_text?.trim() ?? null;
    title = lesson?.title ?? title;
    sourceType = lesson?.source_type ?? sourceType;
    moduleId = lesson?.module_id ?? moduleId;
  }

  if (!rawText?.trim()) {
    await ingestionRepo.markFailed(item.id, "Sem texto para extração.");
    return { error: "Sem texto." };
  }

  if (!lessonId) {
    const lessonResult = await ensureSingleLesson({
      ingestionId: item.id,
      filePath: item.file_path,
      fileName,
      courseName: item.course_name?.trim() || titleFromExpertBrainFileName(fileName) || "Curso",
      moduleName: item.module_name?.trim() || "Módulo 1",
      lessonName: title,
      author: meta.author,
      niche: meta.niche,
      rawText,
    });
    lessonId = lessonResult.lessonId;
    courseId = lessonResult.courseId;
    moduleId = lessonResult.moduleId;
  }

  if (!lessonId) {
    await ingestionRepo.markFailed(item.id, "Aula não encontrada para extração.");
    return { error: "Aula não encontrada." };
  }

  const transcriptsRepo = (await getTranscriptsRepo())!;
  const { data: transcript } = await transcriptsRepo.findByIngestionId(item.id);

  const extraction = await runExtractionForLesson({
    lessonId,
    courseId,
    moduleId,
    rawText,
    title,
    sourceType,
    author: meta.author,
    niche: meta.niche,
    origin: meta.source === "google_drive" ? "google_drive" : fileName,
    transcriptId: transcript?.id ?? null,
  });

  if (extraction.error) {
    await ingestionRepo.markFailed(item.id, extraction.error);
    return { error: extraction.error };
  }

  await ingestionRepo.markCompleted(item.id);
  logExpertBrain("complete", {
    ingestionId: item.id,
    lessonId,
    sourceId: extraction.sourceId,
  });
  console.info("[drive-import] complete", {
    ingestionId: item.id,
    lessonId,
    sourceId: extraction.sourceId,
  });

  return { error: null };
}

async function getIngestionRepo() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return null;
  return new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
}

async function getTranscriptsRepo() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return null;
  return new ExpertTranscriptsRepository(ctx.supabase, ctx.userId);
}

async function processIngestionItem(
  item: import("@/types/database").ExpertIngestionQueueItem
): Promise<{
  error: string | null;
  changed: boolean;
  terminalStatus: "completed" | "failed" | "waiting_for_openai" | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { error: "Usuário não autenticado.", changed: false, terminalStatus: null };
  }

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  let current = item;
  const initialStatus = item.status;

  for (let step = 0; step < 8; step++) {
    const status = current.status;
    console.log("[queue] processing", current.id, status);
    let result: { error: string | null };

    switch (status) {
      case "pending_drive":
        console.log("[queue] entering pending_drive", current.id);
        result = await processPendingDriveStage(current, ingestionRepo);
        break;
      case "uploaded":
      case "pending":
        console.log("[queue] entering uploaded/pending", current.id, status);
        result = await processUploadedStage(current);
        break;
      case "waiting_for_openai":
        console.log("[queue] entering waiting_for_openai", current.id);
        if (!hasOpenAiKey()) {
          return {
            error: null,
            changed: initialStatus !== current.status,
            terminalStatus: "waiting_for_openai",
          };
        }
        await ingestionRepo.markTranscribing(current.id);
        {
          const refreshed = await ingestionRepo.findById(current.id);
          current = refreshed.data ?? { ...current, status: "transcribing" };
        }
        result = await processTranscribingStage(current);
        break;
      case "transcribing":
      case "processing":
        console.log("[queue] entering transcribing/processing", current.id, status);
        result = await processTranscribingStage(current);
        break;
      case "extracting":
        console.log("[queue] entering extracting", current.id);
        result = await processExtractingStage(current);
        break;
      default:
        console.warn("[queue] skip unhandled status", {
          id: current.id,
          status,
          reason: "status não possui handler no switch de processIngestionItem",
        });
        return { error: null, changed: initialStatus !== current.status, terminalStatus: null };
    }

    if (result.error) {
      return { error: result.error, changed: false, terminalStatus: "failed" };
    }

    const refreshed = await ingestionRepo.findById(current.id);
    if (!refreshed.data) {
      return {
        error: "Item da fila não encontrado após processamento.",
        changed: false,
        terminalStatus: null,
      };
    }

    if (refreshed.data.status === current.status) {
      const message = `Estágio '${current.status}' não avançou o item da fila.`;
      await ingestionRepo.markFailed(current.id, message);
      return { error: message, changed: false, terminalStatus: "failed" };
    }

    if (refreshed.data.status === "completed") {
      return {
        error: null,
        changed: initialStatus !== refreshed.data.status,
        terminalStatus: "completed",
      };
    }

    if (refreshed.data.status === "failed") {
      return { error: refreshed.data.error, changed: false, terminalStatus: "failed" };
    }

    if (refreshed.data.status === "waiting_for_openai") {
      return {
        error: null,
        changed: initialStatus !== refreshed.data.status,
        terminalStatus: "waiting_for_openai",
      };
    }

    current = refreshed.data;
  }

  return { error: null, changed: initialStatus !== current.status, terminalStatus: null };
}

export async function resetFailedDriveVideos(): Promise<{
  reset: number;
  scanned: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { reset: 0, scanned: 0, error: "Usuário não autenticado." };

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const { data: failedItems, error } = await ingestionRepo.findFailed(500);

  if (error) return { reset: 0, scanned: 0, error };

  const candidates = (failedItems ?? []).filter((item) =>
    shouldResetFailedDriveItem(item.metadata, item.error)
  );

  let reset = 0;
  for (const item of candidates) {
    const update = await ingestionRepo.resetToPendingDrive(item.id);
    if (!update.error) reset += 1;
  }

  logExpertBrain("upload", {
    stage: "reset_failed_drive_videos",
    scanned: candidates.length,
    reset,
  });

  return { reset, scanned: candidates.length, error: null };
}

export async function processExpertBrainIngestionQueue(limit = 3): Promise<IngestionQueueRunResult> {
  const effectiveLimit = Math.max(1, Math.min(limit, 20));
  console.log("[queue] processExpertBrainIngestionQueue start", {
    requestedLimit: limit,
    effectiveLimit,
  });

  console.log("[queue] before getOptionalDataContext");
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    console.log("[queue] after getOptionalDataContext", { userId: null });
    return finalizeIngestionQueueRun({
      found: 0,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      pendingDriveRemaining: 0,
      error: "Usuário não autenticado.",
    });
  }
  console.log("[queue] after getOptionalDataContext", { userId: ctx.userId });

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);

  console.log("[queue] before findPendingDrive");
  const { data: pendingDriveItems, error: pendingDriveError } =
    await ingestionRepo.findPendingDrive(1);
  console.log("[queue] after findPendingDrive", {
    count: pendingDriveItems?.length ?? 0,
    pendingDriveError,
    items: pendingDriveItems?.map((item) => ({
      id: item.id,
      status: item.status,
      fileName: item.file_name,
    })),
  });

  console.log("[queue] before findWorkable");
  const { data: workableItems, error: pendingError } =
    await ingestionRepo.findWorkable(effectiveLimit);
  console.log("[queue] after findWorkable", {
    total: workableItems?.length ?? 0,
    pendingError,
    items:
      workableItems?.map((item) => ({
        id: item.id,
        status: item.status,
        fileName: item.file_name,
      })) ?? [],
  });

  if (pendingError || pendingDriveError) {
    return finalizeIngestionQueueRun({
      found: 0,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      pendingDriveRemaining: 0,
      error: pendingError ?? pendingDriveError ?? "Erro ao buscar fila.",
    });
  }

  let pending = workableItems ?? [];
  if (!pending.length && pendingDriveItems?.length) {
    console.warn("[queue] findWorkable vazio — usando fallback pending_drive explícito");
    pending = pendingDriveItems;
  }

  const found = pending.length;
  console.log("[queue] items to process", { found, effectiveLimit });

  const { count: pendingDriveCount } = await ingestionRepo.countByStatus("pending_drive");
  console.log("[queue] pending_drive remaining before run", { pendingDriveCount });

  if (!found) {
    console.log("[queue] after countByStatus pending_drive", { pendingDriveCount });
    if (pendingDriveCount > 0) {
      console.error("[drive-import] queue", {
        stage: "processExpertBrainIngestionQueue",
        issue: "findWorkable vazio, mas há itens pending_drive",
        pendingDriveCount,
        effectiveLimit,
      });
    }
    return finalizeIngestionQueueRun({
      found: 0,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      pendingDriveRemaining: pendingDriveCount,
    });
  }

  console.info("[drive-import] queue", {
    stage: "processExpertBrainIngestionQueue",
    effectiveLimit,
    found,
    pending: pending.map((p) => ({ id: p.id, status: p.status, fileName: p.file_name })),
  });

  let processed = 0;
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of pending) {
    console.log("[queue] processExpertBrainIngestionQueue item", item.id, item.status);
    console.log("[queue] before processIngestionItem", item.id);
    const { error: processError, changed, terminalStatus } = await processIngestionItem(item);
    console.log("[queue] after processIngestionItem", item.id, {
      processError,
      changed,
      terminalStatus,
    });

    if (processError) {
      failed += 1;
      continue;
    }

    if (terminalStatus === "completed") {
      completed += 1;
      processed += 1;
      continue;
    }

    if (terminalStatus === "waiting_for_openai") {
      processed += 1;
      continue;
    }

    if (changed) processed += 1;
    else skipped += 1;
  }

  const { count: pendingDriveRemaining } = await ingestionRepo.countByStatus("pending_drive");

  console.log("[queue] processExpertBrainIngestionQueue summary", {
    found,
    processed,
    completed,
    failed,
    skipped,
    pendingDriveRemaining,
  });

  return finalizeIngestionQueueRun({
    found,
    processed,
    completed,
    failed,
    skipped,
    pendingDriveRemaining,
  });
}

export async function getExpertBrainIngestionStatus(): Promise<{
  items: import("@/types/database").ExpertIngestionQueueItem[];
  pending: number;
  processing: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { items: [], pending: 0, processing: 0, error: "Usuário não autenticado." };

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const [recentRes, activeRes] = await Promise.all([
    ingestionRepo.findRecent(20),
    ingestionRepo.countActive(),
  ]);

  const error = recentRes.error ?? activeRes.error;
  if (error) return { items: [], pending: 0, processing: 0, error };

  return {
    items: recentRes.data ?? [],
    pending: activeRes.count,
    processing: activeRes.count,
    error: null,
  };
}
