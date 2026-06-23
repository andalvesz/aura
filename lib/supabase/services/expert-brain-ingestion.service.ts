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
import { ingestKnowledgeSource } from "@/lib/supabase/services/expert-brain.service";
import {
  hasOpenAiKey,
  transcribeIngestionVideo,
} from "@/lib/supabase/services/expert-brain-transcription.service";
import { getValidGoogleDriveExpertAccessToken } from "@/lib/supabase/services/google-drive.service";
import {
  EXPERT_BRAIN_FILES_BUCKET,
  assertExpertBrainStoragePathOwned,
  buildExpertBrainStoragePath,
  detectExpertBrainSourceType,
  formatExpertBrainStorageUploadError,
  guessExpertBrainContentType,
  isExpertBrainVideoFile,
  isExpertBrainZipFile,
  titleFromExpertBrainFileName,
  validateExpertBrainFileSize,
} from "@/utils/expert-brain-storage";
import { logExpertBrain } from "@/utils/expert-brain-pipeline";
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
};

function isGoogleDriveIngestionPath(filePath: string): boolean {
  return filePath.startsWith("google-drive://");
}

function driveFileIdFromPath(filePath: string): string | null {
  if (!isGoogleDriveIngestionPath(filePath)) return null;
  const id = filePath.slice("google-drive://".length).trim();
  return id || null;
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

  await lessonsRepo.update(params.lessonId, { status: "processing" });

  const { data: lesson } = await lessonsRepo.findById(params.lessonId);
  const existingSourceId = lesson?.source_id ?? null;

  const result = await ingestKnowledgeSource({
    title: params.title,
    source_type: params.sourceType,
    raw_text: params.rawText,
    author: params.author ?? null,
    niche: params.niche ?? null,
    origin: params.origin ?? null,
    course_id: params.courseId,
    module_id: params.moduleId,
    lesson_id: params.lessonId,
    existing_source_id: existingSourceId,
  });

  if (result.error || !result.source) {
    await lessonsRepo.update(params.lessonId, {
      status: "failed",
      metadata: {
        ...(typeof lesson?.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
        error: result.error ?? "Falha na extração.",
      } as Json,
    });
    return { sourceId: null, error: result.error ?? "Falha na extração." };
  }

  await lessonsRepo.update(params.lessonId, {
    status: "ready",
    source_id: result.source.id,
    raw_text: params.rawText,
    metadata: {
      ...(typeof lesson?.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
      frameworks_count: result.frameworks.length,
      decision_rules_count: result.decisionRules.length,
      success_patterns_count: result.successPatterns.length,
      failure_patterns_count: result.failurePatterns.length,
      playbooks_count: result.playbooks.length,
      checklists_count: result.checklists.length,
      processed_at: new Date().toISOString(),
    } as Json,
  });

  if (params.transcriptId) {
    await transcriptsRepo.update(params.transcriptId, { source_id: result.source.id });
  }

  return { sourceId: result.source.id, error: null };
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

async function processPendingDriveStage(
  item: import("@/types/database").ExpertIngestionQueueItem
): Promise<{ error: string | null }> {
  const ingestionRepo = (await getIngestionRepo())!;
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const meta = readIngestionMeta(item);
  const fileName = item.file_name ?? item.file_path.split("/").pop() ?? "arquivo";
  const driveFileId = meta.drive_file_id ?? driveFileIdFromPath(item.file_path);

  if (!driveFileId) {
    await ingestionRepo.markFailed(item.id, "ID do arquivo no Google Drive ausente.");
    return { error: "ID do arquivo no Google Drive ausente." };
  }

  await ingestionRepo.updateProgress(item.id, 10);

  const { accessToken, error: tokenError } = await getValidGoogleDriveExpertAccessToken();
  if (!accessToken) {
    await ingestionRepo.markFailed(item.id, tokenError ?? "Google Drive não conectado.");
    return { error: tokenError ?? "Google Drive não conectado." };
  }

  logExpertBrain("upload", {
    ingestionId: item.id,
    stage: "drive_download",
    driveFileId,
    fileName,
  });

  let buffer: Buffer;
  try {
    buffer = await downloadDriveFile(accessToken, driveFileId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download do Google Drive falhou.";
    await ingestionRepo.markFailed(item.id, message);
    return { error: message };
  }

  const sizeError = validateExpertBrainFileSize(buffer.length);
  if (sizeError) {
    await ingestionRepo.markFailed(item.id, sizeError);
    return { error: sizeError };
  }

  await ingestionRepo.updateProgress(item.id, 20);

  const { path: storagePath, error: uploadError } = await uploadExpertBrainBuffer(
    ctx.userId,
    fileName,
    buffer
  );

  if (uploadError || !storagePath) {
    await ingestionRepo.markFailed(item.id, uploadError ?? "Upload para o Storage falhou.");
    return { error: uploadError ?? "Upload para o Storage falhou." };
  }

  const mergedMetadata =
    typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
      ? { ...(item.metadata as Record<string, unknown>), storage_path: storagePath, drive_downloaded: true }
      : { storage_path: storagePath, drive_downloaded: true };

  await ingestionRepo.update(item.id, {
    file_path: storagePath,
    metadata: mergedMetadata as Json,
  });

  logExpertBrain("upload", {
    ingestionId: item.id,
    stage: "drive_storage",
    storagePath,
    fileName,
  });

  if (isExpertBrainVideoFile(fileName)) {
    if (!hasOpenAiKey()) {
      await ingestionRepo.markWaitingForOpenai(item.id);
      return { error: null };
    }
    await ingestionRepo.markTranscribing(item.id);
    return { error: null };
  }

  await ingestionRepo.markUploaded(item.id);
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
    await ingestionRepo.markFailed(item.id, transcription.error ?? "Transcrição falhou.");
    return { error: transcription.error };
  }

  const lessonResult = await ensureSingleLesson({
    ingestionId: item.id,
    filePath: item.file_path,
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

async function processIngestionItem(item: import("@/types/database").ExpertIngestionQueueItem) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  let current = item;

  for (let step = 0; step < 6; step++) {
    const status = current.status;
    let result: { error: string | null };

    if (status === "pending_drive") {
      result = await processPendingDriveStage(current);
    } else if (status === "uploaded" || status === "pending") {
      result = await processUploadedStage(current);
    } else if (status === "waiting_for_openai") {
      if (!hasOpenAiKey()) return { error: null };
      await ingestionRepo.markTranscribing(current.id);
      const refreshed = await ingestionRepo.findById(current.id);
      current = refreshed.data ?? { ...current, status: "transcribing" };
      result = await processTranscribingStage(current);
    } else if (status === "transcribing" || status === "processing") {
      result = await processTranscribingStage(current);
    } else if (status === "extracting") {
      result = await processExtractingStage(current);
    } else {
      return { error: null };
    }

    if (result.error) return result;

    const refreshed = await ingestionRepo.findById(current.id);
    if (!refreshed.data) return { error: null };

    if (
      refreshed.data.status === current.status ||
      refreshed.data.status === "completed" ||
      refreshed.data.status === "failed" ||
      refreshed.data.status === "waiting_for_openai"
    ) {
      return { error: null };
    }

    current = refreshed.data;
  }

  return { error: null };
}

export async function processExpertBrainIngestionQueue(limit = 3): Promise<{
  processed: number;
  failed: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { processed: 0, failed: 0, error: "Usuário não autenticado." };

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const { data: pending, error: pendingError } = await ingestionRepo.findWorkable(limit);

  if (pendingError) return { processed: 0, failed: 0, error: pendingError };
  if (!pending?.length) return { processed: 0, failed: 0, error: null };

  let processed = 0;
  let failed = 0;

  for (const item of pending) {
    const { error: processError } = await processIngestionItem(item);
    if (processError) failed += 1;
    else processed += 1;
  }

  return { processed, failed, error: null };
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
