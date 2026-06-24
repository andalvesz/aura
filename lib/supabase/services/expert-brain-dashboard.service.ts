import type { Json } from "@/types/database";
import {
  ExpertCourseLessonsRepository,
  ExpertCourseModulesRepository,
  ExpertCoursesRepository,
  ExpertDecisionRulesRepository,
  ExpertFailurePatternsRepository,
  ExpertFrameworksRepository,
  ExpertIngestionQueueRepository,
  ExpertKnowledgeSourcesRepository,
  ExpertProcessingQueueRepository,
  ExpertSuccessPatternsRepository,
  ExpertTranscriptsRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import {
  requeueExpertBrainIngestionFromLesson,
} from "@/lib/supabase/services/expert-brain-ingestion.service";
import {
  ingestKnowledgeSource,
  reprocessKnowledgeSource,
} from "@/lib/supabase/services/expert-brain.service";
import { getOptionalDataContext } from "./context";
import {
  buildCourseTree,
  countByStatus,
  emptyExpertBrainDashboard,
  mapDecisionRuleArtifact,
  mapFailurePatternArtifact,
  mapFrameworkArtifact,
  mapSuccessPatternArtifact,
  type ExpertBrainDashboard,
  type ExpertBrainDashboardQueryWarning,
} from "@/utils/expert-brain-dashboard";

function extractQueryError(err: unknown): { message: string; code?: string } {
  if (err && typeof err === "object") {
    const record = err as { message?: string; code?: string };
    if (record.message) {
      return { message: record.message, code: record.code };
    }
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: String(err) };
}

function logDashboardQueryFailure(
  table: string,
  err: unknown
): ExpertBrainDashboardQueryWarning {
  const { message, code } = extractQueryError(err);
  const warning: ExpertBrainDashboardQueryWarning = {
    table,
    error: message,
    code,
    message,
  };
  console.error("[expert-brain-dashboard] query failed", warning);
  return warning;
}

async function safeDashboardListQuery<T>(
  table: string,
  loader: () => Promise<{ data: T[] | null; error: string | null }>,
  warnings: ExpertBrainDashboardQueryWarning[]
): Promise<T[]> {
  try {
    const result = await loader();
    if (result.error) {
      warnings.push(logDashboardQueryFailure(table, { message: result.error }));
      return [];
    }
    return result.data ?? [];
  } catch (err) {
    warnings.push(logDashboardQueryFailure(table, err));
    return [];
  }
}

async function safeDashboardCountQuery(
  table: string,
  loader: () => Promise<{ count: number; error: string | null }>,
  warnings: ExpertBrainDashboardQueryWarning[]
): Promise<number> {
  try {
    const result = await loader();
    if (result.error) {
      warnings.push(logDashboardQueryFailure(table, { message: result.error }));
      return 0;
    }
    return result.count;
  } catch (err) {
    warnings.push(logDashboardQueryFailure(table, err));
    return 0;
  }
}

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
  dashboard: ExpertBrainDashboard;
  warnings: ExpertBrainDashboardQueryWarning[];
  error: string | null;
}> {
  const warnings: ExpertBrainDashboardQueryWarning[] = [];

  try {
    const ctx = await getOptionalDataContext();
    if (!ctx) {
      return {
        dashboard: emptyExpertBrainDashboard(),
        warnings,
        error: "Usuário não autenticado.",
      };
    }

    const coursesRepo = new ExpertCoursesRepository(ctx.supabase, ctx.userId);
    const modulesRepo = new ExpertCourseModulesRepository(ctx.supabase, ctx.userId);
    const lessonsRepo = new ExpertCourseLessonsRepository(ctx.supabase, ctx.userId);
    const queueRepo = new ExpertProcessingQueueRepository(ctx.supabase, ctx.userId);
    const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
    const transcriptsRepo = new ExpertTranscriptsRepository(ctx.supabase, ctx.userId);
    const sourcesRepo = new ExpertKnowledgeSourcesRepository(ctx.supabase, ctx.userId);
    const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
    const decisionRulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
    const successRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);
    const failureRepo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);

    const [
      courses,
      modules,
      lessons,
      queue,
      ingestionQueue,
      ingestionActiveCount,
      transcripts,
      readySources,
      pendingQueueCount,
      processingQueueCount,
      frameworks,
      decisionRules,
      successPatterns,
      failurePatterns,
    ] = await Promise.all([
      safeDashboardListQuery("expert_courses", () => coursesRepo.findRecent(100), warnings),
      safeDashboardListQuery("expert_course_modules", () => modulesRepo.findAllRecent(), warnings),
      safeDashboardListQuery("expert_course_lessons", () => lessonsRepo.findAllRecent(), warnings),
      safeDashboardListQuery("expert_processing_queue", () => queueRepo.findRecent(20), warnings),
      safeDashboardListQuery("expert_ingestion_queue", () => ingestionRepo.findRecent(30), warnings),
      safeDashboardCountQuery("expert_ingestion_queue", () => ingestionRepo.countActive(), warnings),
      safeDashboardListQuery("expert_transcripts", () => transcriptsRepo.findRecent(30), warnings),
      safeDashboardListQuery("expert_knowledge_sources", () => sourcesRepo.findByStatus("ready", 1000), warnings),
      safeDashboardCountQuery("expert_processing_queue", () => queueRepo.countByStatus("pending"), warnings),
      safeDashboardCountQuery("expert_processing_queue", () => queueRepo.countByStatus("processing"), warnings),
      safeDashboardListQuery("expert_frameworks", () => frameworksRepo.findRecent(30), warnings),
      safeDashboardListQuery("expert_decision_rules", () => decisionRulesRepo.findTop(30), warnings),
      safeDashboardListQuery("expert_success_patterns", () => successRepo.findRecent(30), warnings),
      safeDashboardListQuery("expert_failure_patterns", () => failureRepo.findRecent(30), warnings),
    ]);

    return {
      dashboard: {
        metrics: {
          courses: courses.length,
          modules: modules.length,
          lessons: lessons.length,
          sourcesReady: readySources.length,
          queuePending: pendingQueueCount + ingestionActiveCount,
          queueProcessing: processingQueueCount + ingestionActiveCount,
          frameworks: frameworks.length,
          decisionRules: decisionRules.length,
          successPatterns: successPatterns.length,
          failurePatterns: failurePatterns.length,
        },
        statusCounts: countByStatus(lessons),
        courses: buildCourseTree(courses, modules, lessons, transcripts),
        queue,
        ingestionQueue,
        transcripts,
        frameworks: frameworks.map(mapFrameworkArtifact),
        decisionRules: decisionRules.map(mapDecisionRuleArtifact),
        successPatterns: successPatterns.map(mapSuccessPatternArtifact),
        failurePatterns: failurePatterns.map(mapFailurePatternArtifact),
      },
      warnings,
      error: null,
    };
  } catch (err) {
    warnings.push(logDashboardQueryFailure("expert-brain-dashboard", err));
    return {
      dashboard: emptyExpertBrainDashboard(),
      warnings,
      error: null,
    };
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

  let queued = 0;

  for (const lessonId of lessonIds) {
    const { data: lesson } = await lessonsRepo.findById(lessonId);
    if (lesson?.file_path?.trim()) {
      const { error: ingestError } = await requeueExpertBrainIngestionFromLesson(lessonId);
      if (!ingestError) {
        queued += 1;
        continue;
      }
    }

    await queueRepo.create({
      entity_type: "lesson",
      entity_id: lessonId,
      action: "reprocess",
      priority: 10,
      status: "pending",
      metadata: { requested_entity: params.entityType } as Json,
    });
    queued += 1;
  }

  return { queued, error: null };
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

  const { processExpertBrainIngestionQueue } = await import(
    "@/lib/supabase/services/expert-brain-ingestion.service"
  );
  const ingestResult = await processExpertBrainIngestionQueue(enqueueResult.queued);
  const processResult = await processExpertBrainQueue(enqueueResult.queued);

  return {
    processed: ingestResult.processed + processResult.processed,
    failed: ingestResult.failed + processResult.failed,
    error: null,
  };
}

export async function getExpertKnowledgeBySourceId(sourceId: string): Promise<{
  knowledge: {
    source: import("@/types/database").ExpertKnowledgeSource;
    frameworks: import("@/types/database").ExpertFramework[];
    playbooks: import("@/types/database").ExpertPlaybook[];
    decisionRules: import("@/types/database").ExpertDecisionRule[];
    checklists: import("@/types/database").ExpertChecklist[];
    successPatterns: import("@/types/database").ExpertSuccessPattern[];
    failurePatterns: import("@/types/database").ExpertFailurePattern[];
  } | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { knowledge: null, error: "Usuário não autenticado." };

  const sourcesRepo = new ExpertKnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const { data: source, error: sourceError } = await sourcesRepo.findById(sourceId);
  if (sourceError || !source) {
    return { knowledge: null, error: sourceError ?? "Fonte não encontrada." };
  }

  const [frameworksRes, decisionRulesRes, checklistsRes, successRes, failureRes] = await Promise.all([
    ctx.supabase.from("expert_frameworks").select("*").eq("user_id", ctx.userId).eq("source_id", sourceId),
    ctx.supabase.from("expert_decision_rules").select("*").eq("user_id", ctx.userId).eq("source_id", sourceId),
    ctx.supabase.from("expert_checklists").select("*").eq("user_id", ctx.userId).eq("source_id", sourceId),
    ctx.supabase.from("expert_success_patterns").select("*").eq("user_id", ctx.userId).eq("source_id", sourceId),
    ctx.supabase.from("expert_failure_patterns").select("*").eq("user_id", ctx.userId).eq("source_id", sourceId),
  ]);

  const frameworks = (frameworksRes.data ?? []) as import("@/types/database").ExpertFramework[];
  const frameworkIds = frameworks.map((f) => f.id);
  let playbooks: import("@/types/database").ExpertPlaybook[] = [];

  if (frameworkIds.length > 0) {
    const { data: playbookData } = await ctx.supabase
      .from("expert_playbooks")
      .select("*")
      .eq("user_id", ctx.userId)
      .in("framework_id", frameworkIds);
    playbooks = (playbookData ?? []) as import("@/types/database").ExpertPlaybook[];
  }

  return {
    knowledge: {
      source,
      frameworks,
      playbooks,
      decisionRules: (decisionRulesRes.data ?? []) as import("@/types/database").ExpertDecisionRule[],
      checklists: (checklistsRes.data ?? []) as import("@/types/database").ExpertChecklist[],
      successPatterns: (successRes.data ?? []) as import("@/types/database").ExpertSuccessPattern[],
      failurePatterns: (failureRes.data ?? []) as import("@/types/database").ExpertFailurePattern[],
    },
    error: null,
  };
}
