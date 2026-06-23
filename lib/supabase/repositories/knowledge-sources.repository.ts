import type {
  KnowledgeJob,
  KnowledgeJobStage,
  KnowledgeSource,
  TableInsert,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class KnowledgeSourcesRepository extends BaseRepository<"knowledge_sources"> {
  constructor(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
    super(supabase, "knowledge_sources", userId);
  }

  async findByStatus(status: KnowledgeSource["status"], limit = 50) {
    const { data, error } = await this.supabase
      .from("knowledge_sources")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data: (data as KnowledgeSource[]) ?? null, error: error?.message ?? null };
  }

  async updateProgress(
    id: string,
    progress: number,
    status?: KnowledgeSource["status"]
  ) {
    const patch: Partial<KnowledgeSource> = { progress };
    if (status) patch.status = status;

    const { data, error } = await this.supabase
      .from("knowledge_sources")
      .update(patch)
      .eq("user_id", this.userId)
      .eq("id", id)
      .select()
      .single();

    return { data: (data as KnowledgeSource) ?? null, error: error?.message ?? null };
  }
}

export class KnowledgeJobsRepository extends BaseRepository<"knowledge_jobs"> {
  constructor(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
    super(supabase, "knowledge_jobs", userId);
  }

  async findPending(limit = 5) {
    const { data, error } = await this.supabase
      .from("knowledge_jobs")
      .select("*")
      .eq("user_id", this.userId)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: true })
      .limit(limit);

    return { data: (data as KnowledgeJob[]) ?? null, error: error?.message ?? null };
  }

  async findBySourceId(sourceId: string) {
    const { data, error } = await this.supabase
      .from("knowledge_jobs")
      .select("*")
      .eq("user_id", this.userId)
      .eq("source_id", sourceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data: (data as KnowledgeJob) ?? null, error: error?.message ?? null };
  }

  async updateStage(
    id: string,
    stage: KnowledgeJobStage,
    patch: Partial<TableInsert<"knowledge_jobs">> = {}
  ) {
    const { data, error } = await this.supabase
      .from("knowledge_jobs")
      .update({ stage, ...patch })
      .eq("user_id", this.userId)
      .eq("id", id)
      .select()
      .single();

    return { data: (data as KnowledgeJob) ?? null, error: error?.message ?? null };
  }
}

export class KnowledgeInfluenceLogsRepository extends BaseRepository<"knowledge_influence_logs"> {
  constructor(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
    super(supabase, "knowledge_influence_logs", userId);
  }

  async findRecentByModule(module: string, limit = 5) {
    const { data, error } = await this.supabase
      .from("knowledge_influence_logs")
      .select("*")
      .eq("user_id", this.userId)
      .eq("module", module)
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data: data ?? null, error: error?.message ?? null };
  }
}
