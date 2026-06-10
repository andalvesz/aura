import type { SupabaseClient } from "@supabase/supabase-js";
import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import type {
  Database,
  KnowledgeConnector,
  KnowledgeEntry,
  KnowledgeInsight,
  KnowledgePattern,
  MarketHistory,
} from "@/types/database";

export class KnowledgeEntriesRepository extends BaseRepository<"knowledge_entries"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "knowledge_entries", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("knowledge_entries")
      .select("*")
      .eq("user_id", this.userId)
      .order("performance_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    return {
      data: (data as KnowledgeEntry[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findBySourceRef(sourceRef: string, connector: KnowledgeConnector) {
    const { data, error } = await this.supabase
      .from("knowledge_entries")
      .select("*")
      .eq("user_id", this.userId)
      .eq("source_ref", sourceRef)
      .eq("connector", connector)
      .maybeSingle();
    return {
      data: (data as KnowledgeEntry | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class KnowledgeInsightsRepository extends BaseRepository<"knowledge_insights"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "knowledge_insights", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("knowledge_insights")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    return {
      data: (data as KnowledgeInsight[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findActive() {
    const { data, error } = await this.supabase
      .from("knowledge_insights")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    return {
      data: (data as KnowledgeInsight[]) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class KnowledgePatternsRepository extends BaseRepository<"knowledge_patterns"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "knowledge_patterns", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("knowledge_patterns")
      .select("*")
      .eq("user_id", this.userId)
      .order("confidence_score", { ascending: false })
      .order("created_at", { ascending: false });
    return {
      data: (data as KnowledgePattern[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteByPatternType(patternType: KnowledgePattern["pattern_type"]) {
    const { error } = await this.supabase
      .from("knowledge_patterns")
      .delete()
      .eq("user_id", this.userId)
      .eq("pattern_type", patternType);
    return { error: error?.message ?? null };
  }
}

export class MarketHistoryRepository extends BaseRepository<"market_history"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "market_history", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("market_history")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    return {
      data: (data as MarketHistory[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
