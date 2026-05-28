import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiModule, Database, TableInsert } from "@/types/database";
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
    return { data, error: error?.message ?? null };
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
