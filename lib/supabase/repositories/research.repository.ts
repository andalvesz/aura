import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorResearch, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CreatorResearchRepository extends BaseRepository<"creator_research"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_research", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("creator_research")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreatorResearch[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("creator_research")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as CreatorResearch | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
