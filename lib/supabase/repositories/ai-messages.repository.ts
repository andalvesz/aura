import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiMessage, AiModule, Database, TableInsert } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AiMessagesRepository extends BaseRepository<"ai_messages"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "ai_messages", userId);
  }

  async findByModule(module: AiModule, limit = 50) {
    const { data, error } = await this.supabase
      .from("ai_messages")
      .select("*")
      .eq("user_id", this.userId)
      .eq("module", module)
      .order("created_at", { ascending: true })
      .limit(limit);
    return { data: (data as AiMessage[]) ?? null, error: error?.message ?? null };
  }

  async findRecentForContext(module: AiModule, limit = 20) {
    const { data, error } = await this.supabase
      .from("ai_messages")
      .select("*")
      .eq("user_id", this.userId)
      .eq("module", module)
      .order("created_at", { ascending: false })
      .limit(limit);

    const rows = ((data as AiMessage[]) ?? []).slice().reverse();
    return { data: rows, error: error?.message ?? null };
  }

  async findSinceDate(isoDate: string, modules?: AiModule[]) {
    const start = `${isoDate}T00:00:00.000Z`;
    const end = `${isoDate}T23:59:59.999Z`;
    let query = this.supabase
      .from("ai_messages")
      .select("*")
      .eq("user_id", this.userId)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true });

    if (modules?.length) {
      query = query.in("module", modules);
    }

    const { data, error } = await query;
    return { data: (data as AiMessage[]) ?? null, error: error?.message ?? null };
  }

  async findLatestAcrossModules(limit = 40) {
    const { data, error } = await this.supabase
      .from("ai_messages")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    const rows = ((data as AiMessage[]) ?? []).slice().reverse();
    return { data: rows, error: error?.message ?? null };
  }

  async searchContent(keywords: string[], limit = 10) {
    const { data, error } = await this.supabase
      .from("ai_messages")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      return { data: null, error: error.message };
    }

    const lower = keywords.map((k) => k.toLowerCase());
    const filtered = ((data as AiMessage[]) ?? []).filter((m) => {
      const content = m.content.toLowerCase();
      return lower.some((k) => content.includes(k));
    });

    return { data: filtered.slice(0, limit), error: null };
  }

  async append(
    module: AiModule,
    role: TableInsert<"ai_messages">["role"],
    content: string,
    metadata: Record<string, unknown> = {}
  ) {
    return this.create({
      module,
      role,
      content,
      metadata,
    } as Omit<TableInsert<"ai_messages">, "user_id">);
  }
}
