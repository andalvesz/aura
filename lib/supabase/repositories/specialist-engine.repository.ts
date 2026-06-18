import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Specialist, SpecialistSlug } from "@/types/database";
import { SPECIALIST_DEFINITIONS, specialistFromRow } from "@/utils/specialist-engine";

export class SpecialistsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findAllActive() {
    const { data, error } = await this.supabase
      .from("specialists")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });

    return {
      data: (data as Specialist[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findBySlug(slug: SpecialistSlug) {
    const { data, error } = await this.supabase
      .from("specialists")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    return {
      data: (data as Specialist | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export function fallbackSpecialistCatalog() {
  return SPECIALIST_DEFINITIONS;
}

export function mapSpecialistRows(rows: Specialist[] | null) {
  if (!rows?.length) return fallbackSpecialistCatalog();
  return rows.map(specialistFromRow);
}
