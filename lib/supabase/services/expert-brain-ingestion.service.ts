import type { Json } from "@/types/database";
import {
  extractTextFromFile,
  parseUploadedFiles,
  parseZipCourse,
  transcribeVideoBuffer,
  type ParsedCourseStructure,
} from "@/lib/expert-brain/parsers";
import {
  ExpertCourseLessonsRepository,
  ExpertCourseModulesRepository,
  ExpertCoursesRepository,
  ExpertIngestionQueueRepository,
  ExpertProcessingQueueRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import {
  EXPERT_BRAIN_FILES_BUCKET,
  assertExpertBrainStoragePathOwned,
  isExpertBrainZipFile,
  titleFromExpertBrainFileName,
} from "@/utils/expert-brain-storage";
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

async function downloadExpertBrainFile(filePath: string): Promise<Buffer | null> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return null;

  const { data, error } = await ctx.supabase.storage
    .from(EXPERT_BRAIN_FILES_BUCKET)
    .download(filePath);

  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function createLessonsFromStructure(
  structure: ParsedCourseStructure,
  meta: {
    author?: string | null;
    niche?: string | null;
    storagePathPrefix?: string | null;
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
    metadata: { upload_source: "storage" } as Json,
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
      let rawText = lessonFile.text;

      if (!rawText && lessonFile.buffer && lessonFile.sourceType === "video") {
        rawText = await transcribeVideoBuffer(lessonFile.buffer, lessonFile.fileName);
      }

      const storagePath = meta.storagePathPrefix
        ? `${meta.storagePathPrefix}/${lessonFile.path}`
        : lessonFile.path;

      const { data: lessonRow, error: lessonError } = await lessonsRepo.create({
        module_id: moduleRow.id,
        title: lessonFile.title,
        source_type: lessonFile.sourceType,
        sort_order: lessonIndex,
        status: rawText?.trim() ? "pending" : "failed",
        raw_text: rawText?.trim() || null,
        file_name: lessonFile.fileName,
        file_path: storagePath,
        metadata: {
          has_text: Boolean(rawText?.trim()),
          needs_transcript: !rawText?.trim() && lessonFile.sourceType === "video",
        } as Json,
      });

      if (lessonError || !lessonRow) continue;

      lessonIds.push(lessonRow.id);

      if (rawText?.trim()) {
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

async function createSingleFileLesson(params: {
  filePath: string;
  fileName: string;
  buffer: Buffer;
  courseName: string;
  moduleName: string;
  lessonName: string;
  author?: string | null;
  niche?: string | null;
}): Promise<{ courseId: string | null; lessonIds: string[]; error: string | null }> {
  const { text, sourceType } = await extractTextFromFile(params.fileName, params.buffer);
  let rawText = text;

  if (!rawText && sourceType === "video") {
    rawText = await transcribeVideoBuffer(params.buffer, params.fileName);
  }

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
            text: rawText,
            buffer: sourceType === "video" ? params.buffer : null,
            mimeType: null,
          },
        ],
      },
    ],
  };

  return createLessonsFromStructure(structure, {
    author: params.author,
    niche: params.niche,
  });
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
    status: "pending",
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

  return registerExpertBrainIngestion({
    file_path: lesson.file_path,
    course_name: course?.title ?? null,
    module_name: module?.title ?? null,
    lesson_name: lesson.title,
    file_name: lesson.file_name,
    author: course?.author ?? null,
    niche: course?.niche ?? null,
    reprocess: true,
  });
}

async function processIngestionItem(item: import("@/types/database").ExpertIngestionQueueItem) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const meta =
    typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};

  await ingestionRepo.markProcessing(item.id);
  await ingestionRepo.updateProgress(item.id, 15);

  const buffer = await downloadExpertBrainFile(item.file_path);
  if (!buffer) {
    await ingestionRepo.markFailed(item.id, "Não foi possível baixar o arquivo do Storage.");
    return { error: "Download falhou." };
  }

  await ingestionRepo.updateProgress(item.id, 35);

  const fileName = item.file_name ?? item.file_path.split("/").pop() ?? "arquivo";
  const author = typeof meta.author === "string" ? meta.author : null;
  const niche = typeof meta.niche === "string" ? meta.niche : null;

  try {
    if (isExpertBrainZipFile(fileName)) {
      const structure = await parseZipCourse(buffer, item.course_name ?? undefined);
      await ingestionRepo.updateProgress(item.id, 55);
      const result = await createLessonsFromStructure(structure, {
        author,
        niche,
        storagePathPrefix: item.file_path.replace(/\/[^/]+$/, ""),
      });
      if (result.error) {
        await ingestionRepo.markFailed(item.id, result.error);
        return { error: result.error };
      }
    } else {
      const courseName =
        item.course_name?.trim() ||
        titleFromExpertBrainFileName(fileName) ||
        "Curso importado";
      const moduleName = item.module_name?.trim() || "Módulo 1";
      const lessonName =
        item.lesson_name?.trim() || titleFromExpertBrainFileName(fileName) || "Aula 1";

      await ingestionRepo.updateProgress(item.id, 55);
      const result = await createSingleFileLesson({
        filePath: item.file_path,
        fileName,
        buffer,
        courseName,
        moduleName,
        lessonName,
        author,
        niche,
      });

      if (result.error) {
        await ingestionRepo.markFailed(item.id, result.error);
        return { error: result.error };
      }
    }

    await ingestionRepo.updateProgress(item.id, 90);
    await ingestionRepo.markDone(item.id);
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar arquivo.";
    await ingestionRepo.markFailed(item.id, message);
    return { error: message };
  }
}

export async function processExpertBrainIngestionQueue(limit = 3): Promise<{
  processed: number;
  failed: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { processed: 0, failed: 0, error: "Usuário não autenticado." };

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const { data: pending, error: pendingError } = await ingestionRepo.findPending(limit);

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
  const [recentRes, pendingRes, processingRes] = await Promise.all([
    ingestionRepo.findRecent(20),
    ingestionRepo.countByStatus("pending"),
    ingestionRepo.countByStatus("processing"),
  ]);

  const error = recentRes.error ?? pendingRes.error ?? processingRes.error;
  if (error) return { items: [], pending: 0, processing: 0, error };

  return {
    items: recentRes.data ?? [],
    pending: pendingRes.count,
    processing: processingRes.count,
    error: null,
  };
}
