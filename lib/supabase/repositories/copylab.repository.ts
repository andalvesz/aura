import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorCopylab, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CreatorCopylabRepository extends BaseRepository<"creator_copylab"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_copylab", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("creator_copylab")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreatorCopylab[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("creator_copylab")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as CreatorCopylab | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
