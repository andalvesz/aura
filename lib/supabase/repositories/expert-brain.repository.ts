import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ExpertBrainCategory,
  ExpertChecklist,
  ExpertCourse,
  ExpertCourseLesson,
  ExpertCourseModule,
  ExpertCourseStatus,
  ExpertDecisionRule,
  ExpertFailurePattern,
  ExpertFramework,
  ExpertIngestionQueueItem,
  ExpertIngestionStatus,
  ExpertKnowledgeSource,
  ExpertPattern,
  ExpertPatternType,
  ExpertPlaybook,
  ExpertProcessingQueueItem,
  ExpertQueueStatus,
  ExpertSuccessPattern,
  ExpertTranscript,
  ExpertTranscriptStatus,
  TableInsert,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ExpertKnowledgeSourcesRepository extends BaseRepository<"expert_knowledge_sources"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_knowledge_sources", userId);
  }

  async findRecent(limit = 100) {
    const { data, error } = await this.supabase
      .from("expert_knowledge_sources")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertKnowledgeSource[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByStatus(status: ExpertKnowledgeSource["status"], limit = 50) {
    const { data, error } = await this.supabase
      .from("expert_knowledge_sources")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertKnowledgeSource[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("expert_knowledge_sources")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as ExpertKnowledgeSource | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class ExpertCoursesRepository extends BaseRepository<"expert_courses"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_courses", userId);
  }

  async findRecent(limit = 50) {
    const { data, error } = await this.supabase
      .from("expert_courses")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertCourse[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("expert_courses")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as ExpertCourse | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async updateStatus(id: string, status: ExpertCourseStatus) {
    return this.update(id, { status, updated_at: new Date().toISOString() });
  }
}

export class ExpertCourseModulesRepository extends BaseRepository<"expert_course_modules"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_course_modules", userId);
  }

  async findByCourseId(courseId: string) {
    const { data, error } = await this.supabase
      .from("expert_course_modules")
      .select("*")
      .eq("user_id", this.userId)
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    return {
      data: (data as ExpertCourseModule[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("expert_course_modules")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as ExpertCourseModule | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findAllRecent(limit = 500) {
    const { data, error } = await this.supabase
      .from("expert_course_modules")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertCourseModule[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async updateStatus(id: string, status: ExpertCourseStatus) {
    return this.update(id, { status, updated_at: new Date().toISOString() });
  }
}

export class ExpertCourseLessonsRepository extends BaseRepository<"expert_course_lessons"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_course_lessons", userId);
  }

  async findByModuleId(moduleId: string) {
    const { data, error } = await this.supabase
      .from("expert_course_lessons")
      .select("*")
      .eq("user_id", this.userId)
      .eq("module_id", moduleId)
      .order("sort_order", { ascending: true });

    return {
      data: (data as ExpertCourseLesson[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("expert_course_lessons")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as ExpertCourseLesson | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findAllRecent(limit = 2000) {
    const { data, error } = await this.supabase
      .from("expert_course_lessons")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertCourseLesson[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByCourseId(courseId: string) {
    const { data: modules, error: modError } = await this.supabase
      .from("expert_course_modules")
      .select("id")
      .eq("user_id", this.userId)
      .eq("course_id", courseId);

    if (modError) return { data: null, error: modError.message };
    const moduleIds = (modules ?? []).map((m) => m.id);
    if (moduleIds.length === 0) return { data: [] as ExpertCourseLesson[], error: null };

    const { data, error } = await this.supabase
      .from("expert_course_lessons")
      .select("*")
      .eq("user_id", this.userId)
      .in("module_id", moduleIds)
      .order("sort_order", { ascending: true });

    return {
      data: (data as ExpertCourseLesson[]) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class ExpertIngestionQueueRepository extends BaseRepository<"expert_ingestion_queue"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_ingestion_queue", userId);
  }

  async findRecent(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_ingestion_queue")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertIngestionQueueItem[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findPending(limit = 10) {
    return this.findWorkable(limit);
  }

  async findPendingDrive(limit = 1) {
    const effectiveLimit = Math.max(1, limit);
    const { data, error } = await this.supabase
      .from("expert_ingestion_queue")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "pending_drive")
      .order("created_at", { ascending: true })
      .limit(effectiveLimit);

    return {
      data: (data as ExpertIngestionQueueItem[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findWorkable(limit = 10) {
    const effectiveLimit = Math.max(1, limit);
    const workableStatuses: ExpertIngestionStatus[] = [
      "pending_drive",
      "uploaded",
      "transcribing",
      "extracting",
      "waiting_for_openai",
      "pending",
      "processing",
    ];

    const queryDescription = {
      table: "expert_ingestion_queue",
      select: "*",
      filters: {
        user_id: this.userId,
        status: { in: workableStatuses },
      },
      order: { created_at: "asc" },
      limit: effectiveLimit,
    };

    console.log("[queue] findWorkable query", queryDescription);

    const { data, error } = await this.supabase
      .from("expert_ingestion_queue")
      .select("*")
      .eq("user_id", this.userId)
      .in("status", workableStatuses)
      .order("created_at", { ascending: true })
      .limit(effectiveLimit);

    if (error) {
      return { data: null, error: error.message, queryDescription };
    }

    const rows = (data as ExpertIngestionQueueItem[]) ?? [];
    const sorted = [
      ...rows.filter((row) => row.status === "pending_drive"),
      ...rows.filter((row) => row.status !== "pending_drive"),
    ].slice(0, effectiveLimit);

    console.log("[queue] findWorkable result", {
      total: sorted.length,
      statuses: sorted.map((row) => ({ id: row.id, status: row.status })),
    });

    return { data: sorted, error: null, queryDescription };
  }

  async countActive() {
    const statuses: ExpertIngestionStatus[] = [
      "pending_drive",
      "uploaded",
      "transcribing",
      "extracting",
      "waiting_for_openai",
      "pending",
      "processing",
    ];

    const { count, error } = await this.supabase
      .from("expert_ingestion_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .in("status", statuses);

    return { count: count ?? 0, error: error?.message ?? null };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("expert_ingestion_queue")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as ExpertIngestionQueueItem | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async update(id: string, payload: import("@/types/database").TableUpdate<"expert_ingestion_queue">) {
    const { data, error } = await this.supabase
      .from("expert_ingestion_queue")
      .update(payload)
      .eq("user_id", this.userId)
      .eq("id", id)
      .select()
      .maybeSingle();

    return {
      data: (data as ExpertIngestionQueueItem | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async countByStatus(status: ExpertIngestionStatus) {
    const { count, error } = await this.supabase
      .from("expert_ingestion_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .eq("status", status);

    return { count: count ?? 0, error: error?.message ?? null };
  }

  async updateProgress(id: string, progress: number, status?: ExpertIngestionStatus) {
    return this.update(id, {
      progress,
      ...(status ? { status } : {}),
    });
  }

  async markProcessing(id: string) {
    return this.update(id, { status: "processing", progress: 50, error: null });
  }

  async markUploaded(id: string) {
    return this.update(id, { status: "uploaded", progress: 0, error: null });
  }

  async markTranscribing(id: string) {
    return this.update(id, { status: "transcribing", progress: 25, error: null });
  }

  async markWaitingForOpenai(id: string) {
    return this.update(id, { status: "waiting_for_openai", progress: 25, error: null });
  }

  async markExtracting(id: string) {
    return this.update(id, { status: "extracting", progress: 50, error: null });
  }

  async markCompleted(id: string) {
    return this.update(id, {
      status: "completed",
      progress: 100,
      processed_at: new Date().toISOString(),
      error: null,
    });
  }

  async markDone(id: string) {
    return this.markCompleted(id);
  }

  async markFailed(id: string, errorMessage: string) {
    return this.update(id, {
      status: "failed",
      error: errorMessage,
      processed_at: new Date().toISOString(),
    });
  }

  async findFailed(limit = 200) {
    const { data, error } = await this.supabase
      .from("expert_ingestion_queue")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "failed")
      .order("created_at", { ascending: true })
      .limit(Math.max(1, limit));

    return {
      data: (data as ExpertIngestionQueueItem[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async resetToPendingDrive(id: string) {
    return this.update(id, {
      status: "pending_drive",
      progress: 0,
      error: null,
      processed_at: null,
    });
  }
}

export class ExpertTranscriptsRepository extends BaseRepository<"expert_transcripts"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_transcripts", userId);
  }

  async findRecent(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_transcripts")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertTranscript[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("expert_transcripts")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as ExpertTranscript | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByLessonId(lessonId: string) {
    const { data, error } = await this.supabase
      .from("expert_transcripts")
      .select("*")
      .eq("user_id", this.userId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as ExpertTranscript | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByIngestionId(ingestionId: string) {
    const { data, error } = await this.supabase
      .from("expert_transcripts")
      .select("*")
      .eq("user_id", this.userId)
      .eq("ingestion_id", ingestionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as ExpertTranscript | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async updateStatus(id: string, status: ExpertTranscriptStatus, error?: string | null) {
    return this.update(id, {
      status,
      error: error ?? null,
    });
  }
}

export class ExpertProcessingQueueRepository extends BaseRepository<"expert_processing_queue"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_processing_queue", userId);
  }

  async findPending(limit = 50) {
    const { data, error } = await this.supabase
      .from("expert_processing_queue")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);

    return {
      data: (data as ExpertProcessingQueueItem[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findRecent(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_processing_queue")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertProcessingQueueItem[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async countByStatus(status: ExpertQueueStatus) {
    const { count, error } = await this.supabase
      .from("expert_processing_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .eq("status", status);

    return { count: count ?? 0, error: error?.message ?? null };
  }

  async markProcessing(id: string) {
    return this.update(id, { status: "processing" });
  }

  async markDone(id: string) {
    return this.update(id, {
      status: "done",
      processed_at: new Date().toISOString(),
      error: null,
    });
  }

  async markFailed(id: string, errorMessage: string, attempts: number) {
    return this.update(id, {
      status: "failed",
      error: errorMessage,
      attempts,
      processed_at: new Date().toISOString(),
    });
  }
}

export class ExpertFrameworksRepository extends BaseRepository<"expert_frameworks"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_frameworks", userId);
  }

  async findByCategory(category: ExpertBrainCategory, limit = 20) {
    const { data, error } = await this.supabase
      .from("expert_frameworks")
      .select("*")
      .eq("user_id", this.userId)
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertFramework[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findBySourceId(sourceId: string) {
    const { data, error } = await this.supabase
      .from("expert_frameworks")
      .select("*")
      .eq("user_id", this.userId)
      .eq("source_id", sourceId)
      .order("created_at", { ascending: false });

    return {
      data: (data as ExpertFramework[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findRecent(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_frameworks")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertFramework[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteBySourceId(sourceId: string) {
    const { error } = await this.supabase
      .from("expert_frameworks")
      .delete()
      .eq("user_id", this.userId)
      .eq("source_id", sourceId);

    return { error: error?.message ?? null };
  }

  async createMany(
    rows: Array<Omit<TableInsert<"expert_frameworks">, "user_id">>
  ): Promise<{ data: ExpertFramework[]; error: string | null }> {
    if (rows.length === 0) return { data: [], error: null };

    const payload = rows.map((row) => ({ ...row, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("expert_frameworks")
      .insert(payload)
      .select("*");

    return {
      data: (data as ExpertFramework[]) ?? [],
      error: error?.message ?? null,
    };
  }
}

export class ExpertPlaybooksRepository extends BaseRepository<"expert_playbooks"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_playbooks", userId);
  }

  async findByFrameworkIds(frameworkIds: string[]) {
    if (frameworkIds.length === 0) return { data: [] as ExpertPlaybook[], error: null };

    const { data, error } = await this.supabase
      .from("expert_playbooks")
      .select("*")
      .eq("user_id", this.userId)
      .in("framework_id", frameworkIds)
      .order("created_at", { ascending: false });

    return {
      data: (data as ExpertPlaybook[]) ?? [],
      error: error?.message ?? null,
    };
  }

  async deleteByFrameworkIds(frameworkIds: string[]) {
    if (frameworkIds.length === 0) return { error: null };

    const { error } = await this.supabase
      .from("expert_playbooks")
      .delete()
      .eq("user_id", this.userId)
      .in("framework_id", frameworkIds);

    return { error: error?.message ?? null };
  }

  async createMany(
    rows: Array<Omit<TableInsert<"expert_playbooks">, "user_id">>
  ): Promise<{ data: ExpertPlaybook[]; error: string | null }> {
    if (rows.length === 0) return { data: [], error: null };

    const payload = rows.map((row) => ({ ...row, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("expert_playbooks")
      .insert(payload)
      .select("*");

    return {
      data: (data as ExpertPlaybook[]) ?? [],
      error: error?.message ?? null,
    };
  }
}

export class ExpertPatternsRepository extends BaseRepository<"expert_patterns"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_patterns", userId);
  }

  async findByType(patternType: ExpertPatternType, limit = 20) {
    const { data, error } = await this.supabase
      .from("expert_patterns")
      .select("*")
      .eq("user_id", this.userId)
      .eq("pattern_type", patternType)
      .order("confidence_score", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertPattern[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findTop(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_patterns")
      .select("*")
      .eq("user_id", this.userId)
      .order("confidence_score", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertPattern[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteBySourceId(sourceId: string) {
    const { data, error: fetchError } = await this.supabase
      .from("expert_patterns")
      .select("id, source_ids")
      .eq("user_id", this.userId);

    if (fetchError) return { error: fetchError.message };

    const idsToDelete = (data ?? [])
      .filter((row) => {
        const sourceIds = row.source_ids;
        return Array.isArray(sourceIds) && sourceIds.includes(sourceId);
      })
      .map((row) => row.id);

    if (idsToDelete.length === 0) return { error: null };

    const { error } = await this.supabase
      .from("expert_patterns")
      .delete()
      .eq("user_id", this.userId)
      .in("id", idsToDelete);

    return { error: error?.message ?? null };
  }

  async createMany(
    rows: Array<Omit<TableInsert<"expert_patterns">, "user_id">>
  ): Promise<{ data: ExpertPattern[]; error: string | null }> {
    if (rows.length === 0) return { data: [], error: null };

    const payload = rows.map((row) => ({ ...row, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("expert_patterns")
      .insert(payload)
      .select("*");

    return {
      data: (data as ExpertPattern[]) ?? [],
      error: error?.message ?? null,
    };
  }
}

export class ExpertDecisionRulesRepository extends BaseRepository<"expert_decision_rules"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_decision_rules", userId);
  }

  async findByCategory(category: ExpertBrainCategory, limit = 20) {
    const { data, error } = await this.supabase
      .from("expert_decision_rules")
      .select("*")
      .eq("user_id", this.userId)
      .eq("category", category)
      .order("priority", { ascending: false })
      .order("confidence_score", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertDecisionRule[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findTop(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_decision_rules")
      .select("*")
      .eq("user_id", this.userId)
      .order("priority", { ascending: false })
      .order("confidence_score", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertDecisionRule[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteBySourceId(sourceId: string) {
    const { error } = await this.supabase
      .from("expert_decision_rules")
      .delete()
      .eq("user_id", this.userId)
      .eq("source_id", sourceId);

    return { error: error?.message ?? null };
  }

  async createMany(
    rows: Array<Omit<TableInsert<"expert_decision_rules">, "user_id">>
  ): Promise<{ data: ExpertDecisionRule[]; error: string | null }> {
    if (rows.length === 0) return { data: [], error: null };

    const payload = rows.map((row) => ({ ...row, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("expert_decision_rules")
      .insert(payload)
      .select("*");

    return {
      data: (data as ExpertDecisionRule[]) ?? [],
      error: error?.message ?? null,
    };
  }
}

export class ExpertChecklistsRepository extends BaseRepository<"expert_checklists"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_checklists", userId);
  }

  async findByType(checklistType: ExpertChecklist["checklist_type"], limit = 20) {
    const { data, error } = await this.supabase
      .from("expert_checklists")
      .select("*")
      .eq("user_id", this.userId)
      .eq("checklist_type", checklistType)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertChecklist[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findRecent(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_checklists")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertChecklist[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteBySourceId(sourceId: string) {
    const { error } = await this.supabase
      .from("expert_checklists")
      .delete()
      .eq("user_id", this.userId)
      .eq("source_id", sourceId);

    return { error: error?.message ?? null };
  }

  async createMany(
    rows: Array<Omit<TableInsert<"expert_checklists">, "user_id">>
  ): Promise<{ data: ExpertChecklist[]; error: string | null }> {
    if (rows.length === 0) return { data: [], error: null };

    const payload = rows.map((row) => ({ ...row, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("expert_checklists")
      .insert(payload)
      .select("*");

    return {
      data: (data as ExpertChecklist[]) ?? [],
      error: error?.message ?? null,
    };
  }
}

export class ExpertFailurePatternsRepository extends BaseRepository<"expert_failure_patterns"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_failure_patterns", userId);
  }

  async findRecent(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_failure_patterns")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertFailurePattern[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteBySourceId(sourceId: string) {
    const { error } = await this.supabase
      .from("expert_failure_patterns")
      .delete()
      .eq("user_id", this.userId)
      .eq("source_id", sourceId);

    return { error: error?.message ?? null };
  }

  async createMany(
    rows: Array<Omit<TableInsert<"expert_failure_patterns">, "user_id">>
  ): Promise<{ data: ExpertFailurePattern[]; error: string | null }> {
    if (rows.length === 0) return { data: [], error: null };

    const payload = rows.map((row) => ({ ...row, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("expert_failure_patterns")
      .insert(payload)
      .select("*");

    return {
      data: (data as ExpertFailurePattern[]) ?? [],
      error: error?.message ?? null,
    };
  }
}

export class ExpertSuccessPatternsRepository extends BaseRepository<"expert_success_patterns"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "expert_success_patterns", userId);
  }

  async findRecent(limit = 30) {
    const { data, error } = await this.supabase
      .from("expert_success_patterns")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExpertSuccessPattern[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteBySourceId(sourceId: string) {
    const { error } = await this.supabase
      .from("expert_success_patterns")
      .delete()
      .eq("user_id", this.userId)
      .eq("source_id", sourceId);

    return { error: error?.message ?? null };
  }

  async createMany(
    rows: Array<Omit<TableInsert<"expert_success_patterns">, "user_id">>
  ): Promise<{ data: ExpertSuccessPattern[]; error: string | null }> {
    if (rows.length === 0) return { data: [], error: null };

    const payload = rows.map((row) => ({ ...row, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("expert_success_patterns")
      .insert(payload)
      .select("*");

    return {
      data: (data as ExpertSuccessPattern[]) ?? [],
      error: error?.message ?? null,
    };
  }
}
