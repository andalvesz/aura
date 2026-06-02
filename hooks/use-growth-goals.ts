"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useGrowthGoals() {
  return useSupabaseCrud<"growth_goals">({
    table: "growth_goals",
    orderBy: "mes_referencia",
  });
}
