import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ExpertBrainCategory,
  ExpertFramework,
  ExpertKnowledgeSource,
  ExpertPattern,
  ExpertPatternType,
  ExpertPlaybook,
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
