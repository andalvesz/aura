"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useGrowthAnalyses() {
  return useSupabaseCrud<"growth_analyses">({
    table: "growth_analyses",
    orderBy: "created_at",
  });
}
