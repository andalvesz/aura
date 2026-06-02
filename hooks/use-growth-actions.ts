"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useGrowthActions() {
  return useSupabaseCrud<"growth_actions">({
    table: "growth_actions",
    orderBy: "vertical",
    ascending: true,
  });
}
