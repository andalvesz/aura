"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useGrowthProfiles() {
  return useSupabaseCrud<"growth_profiles">({
    table: "growth_profiles",
    orderBy: "created_at",
  });
}
