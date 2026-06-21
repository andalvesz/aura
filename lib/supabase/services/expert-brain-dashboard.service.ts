import type { Json } from "@/types/database";
import {
  parseUploadedFiles,
  parseZipCourse,
  transcribeVideoBuffer,
  type ParsedCourseStructure,
} from "@/lib/expert-brain/parsers";
import {
  ExpertCourseLessonsRepository,
  ExpertCourseModulesRepository,
  ExpertCoursesRepository,
  ExpertDecisionRulesRepository,
  ExpertFailurePatternsRepository,
  ExpertFrameworksRepository,
  ExpertKnowledgeSourcesRepository,
  ExpertProcessingQueueRepository,
  ExpertSuccessPatternsRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import {
  ingestKnowledgeSource,
  reprocessKnowledgeSource,
} from "@/lib/supabase/services/expert-brain.service";
import { getOptionalDataContext } from "./context";
import {
  buildCourseTree,
  countByStatus,
  mapDecisionRuleArtifact,
  mapFailurePatternArtifact,
  mapFrameworkArtifact,
  mapSuccessPatternArtifact,
  type ExpertBrainDashboard,
} from "@/utils/expert-brain-dashboard";

export type ExpertUploadMode = "zip" | "videos" | "pdfs" | "transcripts";

function deriveAggregateStatus(
  statuses: string[]
): "pending" | "processing" | "ready" | "failed" | "partial" {
  if (statuses.length === 0) return "pending";
  if (statuses.every((s) => s === "ready")) return "ready";
  if (statuses.every((s) => s === "failed")) return "failed";
  if (statuses.some((s) => s === "processing")) return "processing";
  if (statuses.some((s) => s === "ready")) return "partial";
  if (statuses.some((s) => s === "failed")) return "partial";
  return "pending";
}

async function refreshModuleStatus(moduleId: string) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const modulesRepo = new ExpertCourseModulesRepository(ctx.supabase, ctx.userId);
  const coursesRepo = new ExpertCoursesRepository(ctx.supabase, ctx.userId);

  const { data: module } = await modulesRepo.findById(moduleId);
  if (!module) return;

  const { data: lessons } = await lessonsRepo.findByModuleId(moduleId);
  const status = deriveAggregateStatus((lessons ?? []).map((l) => l.status));
  await modulesRepo.updateStatus(moduleId, status);

  const { data: modules } = await modulesRepo.findByCourseId(module.course_id);
  const courseStatus = deriveAggregateStatus((modules ?? []).map((m) => m.status));
  await coursesRepo.updateStatus(module.course_id, courseStatus);
}

async function refreshCourseStatus(courseId: string) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const modulesRepo = new ExpertCourseModulesRepository(ctx.supabase, ctx.userId);
  const coursesRepo = new ExpertCoursesRepository(ctx.supabase, ctx.userId);

  const { data: lessons } = await lessonsRepo.findByCourseId(courseId);
  const status = deriveAggregateStatus((lessons ?? []).map((l) => l.status));
  await coursesRepo.updateStatus(courseId, status);

  const { data: modules } = await modulesRepo.findByCourseId(courseId);
  for (const mod of modules ?? []) {
    const modLessons = (lessons ?? []).filter((l) => l.module_id === mod.id);
    await modulesRepo.updateStatus(mod.id, deriveAggregateStatus(modLessons.map((l) => l.status)));
  }
}

export async function getExpertBrainDashboard(): Promise<{
  dashboard: ExpertBrainDashboard | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { dashboard: null, error: "Usuário não autenticado." };

  const coursesRepo = new ExpertCoursesRepository(ctx.supabase, ctx.userId);
  const modulesRepo = new ExpertCourseModulesRepository(ctx.supabase, ctx.userId);
  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const queueRepo = new ExpertProcessingQueueRepository(ctx.supabase, ctx.userId);
  const sourcesRepo = new ExpertKnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const decisionRulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const successRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);
  const failureRepo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);

  const [
    coursesRes,
    modulesRes,
    lessonsRes,
    queueRes,
    readySourcesRes,
    pendingQueueRes,
    processingQueueRes,
    frameworksRes,
    rulesRes,
    successRes,
    failureRes,
  ] = await Promise.all([
    coursesRepo.findRecent(100),
    modulesRepo.findAllRecent(),
    lessonsRepo.findAllRecent(),
    queueRepo.findRecent(20),
    sourcesRepo.findByStatus("ready", 1000),
    queueRepo.countByStatus("pending"),
    queueRepo.countByStatus("processing"),
    frameworksRepo.findRecent(30),
    decisionRulesRepo.findTop(30),
    successRepo.findRecent(30),
    failureRepo.findRecent(30),
  ]);

  const firstError =
    coursesRes.error ??
    modulesRes.error ??
    lessonsRes.error ??
    queueRes.error ??
    readySourcesRes.error ??
    pendingQueueRes.error ??
    processingQueueRes.error ??
    frameworksRes.error ??
    rulesRes.error ??
    successRes.error ??
    failureRes.error;

  if (firstError) return { dashboard: null, error: firstError };

  const courses = coursesRes.data ?? [];
  const modules = modulesRes.data ?? [];
  const lessons = lessonsRes.data ?? [];

  return {
    dashboard: {
      metrics: {
        courses: courses.length,
        modules: modules.length,
        lessons: lessons.length,
        sourcesReady: (readySourcesRes.data ?? []).length,
        queuePending: pendingQueueRes.count,
        queueProcessing: processingQueueRes.count,
        frameworks: (frameworksRes.data ?? []).length,
        decisionRules: (rulesRes.data ?? []).length,
        successPatterns: (successRes.data ?? []).length,
        failurePatterns: (failureRes.data ?? []).length,
      },
      statusCounts: countByStatus(lessons),
      courses: buildCourseTree(courses, modules, lessons),
      queue: queueRes.data ?? [],
      frameworks: (frameworksRes.data ?? []).map(mapFrameworkArtifact),
      decisionRules: (rulesRes.data ?? []).map(mapDecisionRuleArtifact),
      successPatterns: (successRes.data ?? []).map(mapSuccessPatternArtifact),
      failurePatterns: (failureRes.data ?? []).map(mapFailurePatternArtifact),
    },
    error: null,
  };
}

async function createCourseStructure(
  structure: ParsedCourseStructure,
  meta: { author?: string | null; niche?: string | null }
) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { courseId: null, lessonIds: [] as string[], error: "Usuário não autenticado." };

  const coursesRepo = new ExpertCoursesRepository(ctx.supabase, ctx.userId);
  const modulesRepo = new ExpertCourseModulesRepository(ctx.supabase, ctx.userId);
  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const queueRepo = new ExpertProcessingQueueRepository(ctx.supabase, ctx.userId);

  const { data: course, error: courseError } = await coursesRepo.create({
    title: structure.courseTitle,
    author: meta.author ?? null,
    niche: meta.niche ?? null,
    status: "pending",
    metadata: { upload_source: "dashboard" } as Json,
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

      const { data: lessonRow, error: lessonError } = await lessonsRepo.create({
        module_id: moduleRow.id,
        title: lessonFile.title,
        source_type: lessonFile.sourceType,
        sort_order: lessonIndex,
        status: rawText?.trim() ? "pending" : "failed",
        raw_text: rawText?.trim() || null,
        file_name: lessonFile.fileName,
        file_path: lessonFile.path,
        metadata: {
          has_text: Boolean(rawText?.trim()),
          needs_transcript: !rawText?.trim() && lessonFile.sourceType === "video",
        } as Json,
      });

      if (lessonError || !lessonRow) continue;

      lessonIds.push(lessonRow.id);

      if (rawText?.trim()) {
        await queueRepo.create({
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

export async function uploadExpertBrainContent(params: {
  mode: ExpertUploadMode;
  files: Array<{ name: string; buffer: Buffer }>;
  courseTitle?: string | null;
  author?: string | null;
  niche?: string | null;
}): Promise<{ courseId: string | null; queued: number; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { courseId: null, queued: 0, error: "Usuário não autenticado." };
  if (params.files.length === 0) {
    return { courseId: null, queued: 0, error: "Nenhum arquivo enviado." };
  }

  try {
    let structure: ParsedCourseStructure;

    if (params.mode === "zip") {
      const zipFile = params.files[0];
      structure = await parseZipCourse(zipFile.buffer, params.courseTitle ?? undefined);
    } else {
      structure = await parseUploadedFiles(params.files, params.mode);
      if (params.courseTitle?.trim()) {
        structure.courseTitle = params.courseTitle.trim();
      }
    }

    const { courseId, lessonIds, error } = await createCourseStructure(structure, {
      author: params.author,
      niche: params.niche,
    });

    if (error) return { courseId, queued: 0, error };

    return { courseId, queued: lessonIds.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar upload.";
    return { courseId: null, queued: 0, error: message };
  }
}

export async function enqueueExpertReprocess(params: {
  entityType: "lesson" | "module" | "course";
  entityId: string;
}): Promise<{ queued: number; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { queued: 0, error: "Usuário não autenticado." };

  const queueRepo = new ExpertProcessingQueueRepository(ctx.supabase, ctx.userId);
  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);

  let lessonIds: string[] = [];

  if (params.entityType === "lesson") {
    lessonIds = [params.entityId];
  } else if (params.entityType === "module") {
    const { data: lessons } = await lessonsRepo.findByModuleId(params.entityId);
    lessonIds = (lessons ?? []).map((l) => l.id);
  } else {
    const { data: lessons } = await lessonsRepo.findByCourseId(params.entityId);
    lessonIds = (lessons ?? []).map((l) => l.id);
  }

  if (lessonIds.length === 0) {
    return { queued: 0, error: "Nenhuma aula encontrada para reprocessar." };
  }

  for (const lessonId of lessonIds) {
    await queueRepo.create({
      entity_type: "lesson",
      entity_id: lessonId,
      action: "reprocess",
      priority: 10,
      status: "pending",
      metadata: { requested_entity: params.entityType } as Json,
    });
  }

  return { queued: lessonIds.length, error: null };
}

async function processLessonQueueItem(lessonId: string, action: "process" | "reprocess") {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
  const modulesRepo = new ExpertCourseModulesRepository(ctx.supabase, ctx.userId);
  const coursesRepo = new ExpertCoursesRepository(ctx.supabase, ctx.userId);
  const sourcesRepo = new ExpertKnowledgeSourcesRepository(ctx.supabase, ctx.userId);

  const { data: lesson, error: lessonError } = await lessonsRepo.findById(lessonId);
  if (lessonError || !lesson) return { error: lessonError ?? "Aula não encontrada." };

  const rawText = lesson.raw_text?.trim();
  if (!rawText) {
    await lessonsRepo.update(lessonId, {
      status: "failed",
      metadata: {
        ...(typeof lesson.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
        error: "Sem texto para processar.",
      } as Json,
    });
    await refreshModuleStatus(lesson.module_id);
    return { error: "Aula sem texto para processar." };
  }

  const { data: module } = await modulesRepo.findById(lesson.module_id);
  const { data: course } = module
    ? await coursesRepo.findById(module.course_id)
    : { data: null };

  await lessonsRepo.update(lessonId, { status: "processing" });
  if (module) await modulesRepo.updateStatus(module.id, "processing");
  if (course) await coursesRepo.updateStatus(course.id, "processing");

  let result;

  if (action === "reprocess" && lesson.source_id) {
    result = await reprocessKnowledgeSource(lesson.source_id);
  } else if (lesson.source_id) {
    result = await reprocessKnowledgeSource(lesson.source_id);
  } else {
    result = await ingestKnowledgeSource({
      title: lesson.title,
      source_type: lesson.source_type,
      raw_text: rawText,
      author: course?.author ?? null,
      niche: course?.niche ?? null,
      origin: lesson.file_name,
      course_id: course?.id ?? null,
      module_id: lesson.module_id,
      lesson_id: lesson.id,
    });

    if (!result.error && result.source) {
      await lessonsRepo.update(lessonId, { source_id: result.source.id });
    }
  }

  if (result.error || !result.source) {
    await lessonsRepo.update(lessonId, {
      status: "failed",
      metadata: {
        ...(typeof lesson.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
        error: result.error ?? "Falha no processamento.",
      } as Json,
    });
    await refreshModuleStatus(lesson.module_id);
    return { error: result.error ?? "Falha no processamento." };
  }

  await sourcesRepo.update(result.source.id, {
    course_id: course?.id ?? null,
    module_id: lesson.module_id,
    lesson_id: lesson.id,
  });

  await lessonsRepo.update(lessonId, {
    status: "ready",
    source_id: result.source.id,
    metadata: {
      ...(typeof lesson.metadata === "object" && lesson.metadata ? lesson.metadata : {}),
      frameworks_count: result.frameworks.length,
      decision_rules_count: result.decisionRules.length,
      success_patterns_count: result.successPatterns.length,
      failure_patterns_count: result.failurePatterns.length,
      processed_at: new Date().toISOString(),
    } as Json,
  });

  await refreshModuleStatus(lesson.module_id);
  return { error: null };
}

export async function processExpertBrainQueue(limit = 5): Promise<{
  processed: number;
  failed: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { processed: 0, failed: 0, error: "Usuário não autenticado." };

  const queueRepo = new ExpertProcessingQueueRepository(ctx.supabase, ctx.userId);
  const { data: pending, error: pendingError } = await queueRepo.findPending(limit);

  if (pendingError) return { processed: 0, failed: 0, error: pendingError };
  if (!pending?.length) return { processed: 0, failed: 0, error: null };

  let processed = 0;
  let failed = 0;

  for (const item of pending) {
    await queueRepo.markProcessing(item.id);

    if (item.entity_type !== "lesson") {
      await queueRepo.markFailed(item.id, "Tipo de entidade não suportado.", item.attempts + 1);
      failed += 1;
      continue;
    }

    const { error: processError } = await processLessonQueueItem(item.entity_id, item.action);
    if (processError) {
      await queueRepo.markFailed(item.id, processError, item.attempts + 1);
      failed += 1;
    } else {
      await queueRepo.markDone(item.id);
      processed += 1;
    }
  }

  return { processed, failed, error: null };
}

export async function reprocessExpertEntity(params: {
  entityType: "lesson" | "module" | "course";
  entityId: string;
}): Promise<{ processed: number; failed: number; error: string | null }> {
  const enqueueResult = await enqueueExpertReprocess(params);
  if (enqueueResult.error) {
    return { processed: 0, failed: 0, error: enqueueResult.error };
  }
  return processExpertBrainQueue(enqueueResult.queued);
}
