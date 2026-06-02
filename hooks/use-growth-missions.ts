"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useGrowthMissions() {
  return useSupabaseCrud<"growth_missions">({
    table: "growth_missions",
    orderBy: "mission_date",
  });
}
